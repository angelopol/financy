import {
  ConflictException,
  Controller,
  Get,
  Inject,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Database } from './database';
import { FinanceService } from './finance';
import { PlanningService } from './planning';
import { AuthGuard, AuthRequest, AuthService } from './auth';
import { idSchema, parse } from './domain';

export type ActivitySource = 'user' | 'ai';
@Injectable()
export class ActivityService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(FinanceService) private finance: FinanceService,
    @Inject(PlanningService) private planning: PlanningService,
    @Inject(AuthService) private auth: AuthService,
  ) {}
  async log(
    user: string,
    source: ActivitySource,
    kind: string,
    targetId: string | number | null,
    summary: string,
    undoPayload: unknown = {},
  ) {
    await this.db.query(
      `INSERT INTO financy_activity(user_id,source,kind,target_id,summary,undo_payload) VALUES($1,$2,$3,$4,$5,$6)`,
      [user, source, kind, targetId, summary, JSON.stringify(undoPayload)],
    );
  }
  async list(user: string, before?: string) {
    const params: any[] = [user];
    let where = 'user_id=$1';
    if (before) {
      params.push(parse(idSchema, before));
      where += ` AND id<$${params.length}`;
    }
    const rows = (
      await this.db.query(
        `SELECT id,source,kind,summary,created_at,undone_at,(undone_at IS NULL AND kind IN ('earning_created','expense_created','shopping_created','budget_created','transfer','shopping_purchased','limit_updated','shop_saving_deposit','shop_saving_withdraw')) AS can_undo FROM financy_activity WHERE ${where} ORDER BY id DESC LIMIT 21`,
        params,
      )
    ).rows;
    return { activity: rows.slice(0, 20), has_more: rows.length > 20 };
  }
  async undo(user: string, id: string) {
    const claimed = await this.db.query(
      `UPDATE financy_activity SET undone_at=now() WHERE id=$1 AND user_id=$2 AND undone_at IS NULL RETURNING *`,
      [id, user],
    );
    const row = claimed.rows[0];
    if (!row) throw new ConflictException('Esta acción ya fue deshecha o no existe.');
    try {
      const payload = JSON.parse(row.undo_payload);
      switch (row.kind) {
        case 'earning_created':
          await this.finance.remove(user, 'earnings', row.target_id);
          break;
        case 'expense_created':
          await this.finance.remove(user, 'expenses', row.target_id);
          break;
        case 'shopping_created':
          await this.planning.shopAction(user, row.target_id, 'delete', {});
          break;
        case 'budget_created':
          await this.planning.budgetDelete(user, row.target_id);
          break;
        case 'transfer':
          await this.planning.transfer(user, {
            amount: payload.amount,
            from: payload.from === 'box' ? 'savings' : 'box',
          });
          break;
        case 'shopping_purchased':
          await this.planning.shopAction(user, row.target_id, 'pending', {});
          break;
        case 'limit_updated':
          await this.auth.updateMonthlyLimit(user, payload.previous_limit);
          break;
        case 'shop_saving_deposit':
          await this.finance.remove(user, 'expenses', row.target_id);
          break;
        case 'shop_saving_withdraw':
          await this.finance.remove(user, 'earnings', row.target_id);
          break;
        default:
          throw new ConflictException('Esta acción no se puede deshacer.');
      }
      return { ok: true };
    } catch (error) {
      await this.db.query(`UPDATE financy_activity SET undone_at=NULL WHERE id=$1`, [id]);
      throw error;
    }
  }
}
@Controller('activity')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(@Inject(ActivityService) private activity: ActivityService) {}
  @Get() list(@Req() r: AuthRequest, @Query('before') before?: string) {
    return this.activity.list(r.user.id, before);
  }
  @Post(':id/undo') undo(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.activity.undo(r.user.id, parse(idSchema, id));
  }
}
