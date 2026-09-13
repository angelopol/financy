import { Controller, Get, Inject, Injectable, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { Resend } from 'resend';
import { Database } from './database';
import { FinanceService } from './finance';
import { dueAt, now } from './domain';
@Injectable()
export class JobsService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(FinanceService) private finance: FinanceService,
  ) {}
  async run() {
    let claimed = 0,
      failed = 0;
    // A bounded batch keeps serverless invocations finite. Already processed rows advance their anchor.
    for (const kind of ['earnings', 'expenses'] as const) {
      const rows = (
        await this.db.query(
          `SELECT * FROM ${kind} WHERE auto_claim=true AND (term IS NOT NULL OR claim_day IS NOT NULL) ORDER BY "UpdatedTerm" ASC LIMIT 200`,
        )
      ).rows;
      for (const r of rows) {
        const due = dueAt(r);
        if (due && due <= now()) {
          try {
            await this.finance.claim(r.user, kind, r.id);
            claimed++;
          } catch {
            failed++;
          }
        }
      }
    }
    const reminders = (
      await this.db.query(
        'SELECT e.*,u.email,u.email_verified_at FROM earnings e JOIN users u ON u.id=e."user" WHERE u.email_verified_at IS NOT NULL AND (e.term IS NOT NULL OR e.claim_day IS NOT NULL)',
      )
    ).rows;
    for (const r of reminders) {
      const due = dueAt(r);
      if (
        due?.toISODate() === now().plus({ days: 1 }).toISODate() &&
        !String(r.last_notified_claim_at ?? '').startsWith(due.toISODate()!)
      )
        await this.db.transaction(async (sql) => {
          await sql.query(
            'INSERT INTO financy_mail(user_id,recipient,subject,body,dedupe) VALUES($1,$2,$3,$4,$5) ON CONFLICT(dedupe) DO NOTHING',
            [
              r.user,
              r.email,
              'Tienes un ingreso próximo · Financy',
              `Mañana vence ${r.description}, por ${r.amount} ${r.currency}. Revisa tu cuenta en ${process.env.APP_URL}.`,
              `reminder:${r.id}:${due.toISODate()}`,
            ],
          );
          await sql.query('UPDATE earnings SET last_notified_claim_at=$1 WHERE id=$2', [
            due.toFormat('yyyy-MM-dd HH:mm:ss'),
            r.id,
          ]);
        });
    }
    const mail = await this.sendMail();
    await this.db.query('DELETE FROM financy_sessions WHERE expires_at<now()');
    await this.db.query('DELETE FROM financy_tokens WHERE expires_at<now()');
    await this.db.query('DELETE FROM financy_rate_limits WHERE expires_at<now()');
    return { claimed, failed, ...mail };
  }
  async sendMail() {
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
      return { sent: 0, mailConfigured: false };
    const resend = new Resend(process.env.RESEND_API_KEY);
    let sent = 0;
    for (let i = 0; i < 20; i++) {
      const found = await this.db.transaction(async (sql) => {
        const row = (
          await sql.query(
            'SELECT * FROM financy_mail WHERE sent_at IS NULL ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1',
          )
        ).rows[0];
        if (!row) return false;
        const { error } = await resend.emails.send({
          from: process.env.MAIL_FROM!,
          to: row.recipient,
          subject: row.subject,
          text: row.body,
          headers: { 'X-Entity-Ref-ID': `financy-${row.id}` },
        });
        if (error) throw new Error(error.message);
        await sql.query('UPDATE financy_mail SET sent_at=now() WHERE id=$1', [row.id]);
        return true;
      });
      if (!found) break;
      sent++;
    }
    return { sent, mailConfigured: true };
  }
}
@Controller('cron')
export class JobsController {
  constructor(@Inject(JobsService) private jobs: JobsService) {}
  @Get() run(@Req() req: Request) {
    const expected = process.env.CRON_SECRET;
    const provided = req.headers.authorization ?? '';
    if (
      !expected ||
      expected.length < 32 ||
      Buffer.byteLength(provided) !== Buffer.byteLength('Bearer ' + expected) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from('Bearer ' + expected))
    )
      throw new UnauthorizedException();
    return this.jobs.run();
  }
}
