import { ConflictException, Injectable, Inject, ServiceUnavailableException } from '@nestjs/common';
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
    for (const s of subs) await this.deliver(s, payload);
  }
  // Unlike send(), this reports whether the push actually reached the browser's push
  // service, so the "Probar" button in Settings can tell the user it truly worked.
  async sendTest(user: string) {
    if (!this.configured)
      throw new ServiceUnavailableException(
        'Las notificaciones push no están configuradas en el servidor.',
      );
    this.vapid();
    const subs = (
      await this.db.query('SELECT * FROM financy_push_subscriptions WHERE user_id=$1', [user])
    ).rows;
    if (!subs.length)
      throw new ConflictException('No tienes notificaciones push activas en este dispositivo.');
    const payload: PushPayload = {
      title: 'Financy · Notificación de prueba',
      body: 'Si ves esto, tus notificaciones push funcionan correctamente.',
    };
    let sent = 0;
    let lastError: any = null;
    for (const s of subs) {
      const error = await this.deliver(s, payload);
      if (error) lastError = error;
      else sent++;
    }
    if (!sent)
      throw new ServiceUnavailableException(
        'No se pudo entregar la notificación de prueba. Intenta desactivar y volver a activar las notificaciones.',
      );
    return { ok: true, sent };
  }
  private async deliver(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      return null;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410)
        await this.db.query('DELETE FROM financy_push_subscriptions WHERE id=$1', [sub.id]);
      return error;
    }
  }
}
