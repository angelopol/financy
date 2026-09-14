import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, AuthRequest } from './auth';
import { FinanceService } from './finance';
import { PushService } from './push';
import { parse } from './domain';
const subscriptionSchema = z
  .object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }).strict(),
  })
  .strict();
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    @Inject(FinanceService) private finance: FinanceService,
    @Inject(PushService) private push: PushService,
  ) {}
  @Get() async list(@Req() r: AuthRequest) {
    const [data, pushEnabled] = await Promise.all([
      this.finance.notifications(r.user.id),
      this.push.isSubscribed(r.user.id),
    ]);
    return { ...data, push_enabled: pushEnabled, push_supported: this.push.configured };
  }
  @Get('vapid-key') vapidKey() {
    return { key: this.push.publicKey };
  }
  @Post('subscribe') subscribe(@Req() r: AuthRequest, @Body() body: unknown) {
    return this.push.subscribe(r.user.id, parse(subscriptionSchema, body));
  }
  @Post('unsubscribe') unsubscribe(@Req() r: AuthRequest, @Body() body: unknown) {
    const v = parse(z.object({ endpoint: z.string().url() }).strict(), body);
    return this.push.unsubscribe(r.user.id, v.endpoint);
  }
}
