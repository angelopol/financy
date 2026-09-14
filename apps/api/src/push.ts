import { Injectable, Inject } from '@nestjs/common';
import webpush from 'web-push';
import { Database } from './database';
export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushPayload = { title: string; body: string; url?: string };
@Injectable()
export class PushService {
  get configured() {
    return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
  }
  get publicKey() {
    return process.env.VAPID_PUBLIC_KEY?.trim() || null;
  }
  constructor(@Inject(Database) private db: Database) {}
  private vapid() {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:soporte@financy.app',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }
  async subscribe(user: string, sub: PushSubscriptionInput) {
    await this.db.query(
      `INSERT INTO financy_push_subscriptions(user_id,endpoint,p256dh,auth) VALUES($1,$2,$3,$4)
       ON CONFLICT(endpoint) DO UPDATE SET user_id=$1,p256dh=$3,auth=$4`,
      [user, sub.endpoint, sub.keys.p256dh, sub.keys.auth],
    );
    return { ok: true };
  }
  async unsubscribe(user: string, endpoint: string) {
    await this.db.query(
      'DELETE FROM financy_push_subscriptions WHERE user_id=$1 AND endpoint=$2',
      [user, endpoint],
    );
    return { ok: true };
  }
  async isSubscribed(user: string) {
    const rows = (
      await this.db.query('SELECT 1 FROM financy_push_subscriptions WHERE user_id=$1 LIMIT 1', [
        user,
      ])
    ).rows;
    return rows.length > 0;
  }
  // Best-effort: a push failure never breaks the caller (cron, dashboard actions, etc).
  async send(user: string, payload: PushPayload) {
    if (!this.configured) return;
    this.vapid();
    const subs = (
      await this.db.query('SELECT * FROM financy_push_subscriptions WHERE user_id=$1', [user])
    ).rows;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410)
          await this.db.query('DELETE FROM financy_push_subscriptions WHERE id=$1', [s.id]);
      }
    }
  }
}
