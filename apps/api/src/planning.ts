import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { FinanceService } from './finance';
import {
  amountSchema,
  currencySchema,
  money,
  monthSchema,
  now,
  parse,
  providerSchema,
  words,
} from './domain';
const shoppingSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: amountSchema,
  currency: currencySchema.default('$'),
});
const budgetSchema = z.object({
  month: monthSchema,
  name: z.string().trim().min(1).max(120),
  amount: amountSchema,
  slug: z.string().min(1).max(1800),
});
@Injectable()
export class PlanningService {
  constructor(@Inject(FinanceService) readonly finance: FinanceService) {}
  async shopList(user: string, query: any) {
    const v = parse(z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }), query);
    const total = (
      await this.finance.db.query('SELECT count(*) AS count FROM shop_list_items WHERE "user"=$1', [
        user,
      ])
    ).rows[0];
    const pending = (
      await this.finance.db.query(
        `SELECT count(*) AS count,COALESCE(sum(amount),0) AS amount FROM shop_list_items WHERE "user"=$1 AND status='pending'`,
        [user],
      )
    ).rows[0];
    const result = await this.finance.db.query(
      'SELECT * FROM shop_list_items WHERE "user"=$1 ORDER BY status,created_at DESC LIMIT 20 OFFSET $2',
      [user, (v.page - 1) * 20],
    );
    return {
      items: result.rows,
      total: Number(total.count),
      pending_count: Number(pending.count),
      pending_amount: pending.amount,
      page: v.page,
      pages: Math.ceil(Number(total.count) / 20),
    };
  }
  async shopSave(user: string, body: unknown, id?: string) {
    const v = parse(shoppingSchema, body);
    const amount = await this.finance.rates.convert(v.currency, v.amount);
    return this.finance.db.transaction(async (sql) => {
      await this.finance.lock(sql, user);
      if (id) {
        const old = await this.finance.owned(sql, 'shop_list_items', id, user);
        if (old.status !== 'pending')
          throw new ConflictException('Devuelve el artículo a pendiente para editarlo');
        return (
          await sql.query(
            'UPDATE shop_list_items SET description=$1,amount=$2,updated_at=now() WHERE id=$3 RETURNING *',
            [v.description, amount, id],
          )
        ).rows[0];
      }
      return (
        await sql.query(
          'INSERT INTO shop_list_items("user",description,amount,status,created_at,updated_at) VALUES($1,$2,$3,\'pending\',now(),now()) RETURNING *',
          [user, v.description, amount],
        )
      ).rows[0];
    });
  }
  async shopAction(user: string, id: string, action: string, body: unknown) {
    return this.finance.db.transaction(async (sql) => {
      await this.finance.lock(sql, user);
      const item = await this.finance.owned(sql, 'shop_list_items', id, user);
      if (action === 'pending') {
        const expenses = (
          await sql.query('SELECT id FROM expenses WHERE shop_list_item_id=$1 AND "user"=$2', [
            id,
            user,
          ])
        ).rows;
        for (const e of expenses) await this.finance.remove(user, 'expenses', e.id, sql);
        await sql.query(
          "UPDATE shop_list_items SET status='pending',provider=NULL,not_discount=false,updated_at=now() WHERE id=$1",
          [id],
        );
      } else if (action === 'delete') {
        if (item.status === 'purchased' && !item.not_discount)
          throw new ConflictException('Devuelve el artículo a pendiente antes de eliminarlo');
        await sql.query('DELETE FROM shop_list_items WHERE id=$1', [id]);
      } else if (action === 'purchase' || action === 'gift') {
        if (item.status !== 'pending') throw new ConflictException('La compra ya está registrada');
        const v =
          action === 'gift'
            ? { amount: String(item.amount), provider: 'box' as const, not_discount: true }
            : parse(
                z.object({
                  amount: amountSchema,
                  provider: providerSchema,
                  not_discount: z.boolean().default(false),
                }),
                body,
              );
        let provider = null;
        if (!v.not_discount) {
          const e = await this.finance.create(
            sql,
            user,
            'expenses',
            {
              description: item.description,
              amount: v.amount,
              provider: v.provider,
              currency: '$',
              slug: item.description,
              recurrence_type: 'one_time',
              auto_claim: false,
              project_id: null,
            },
            { shop_list_item_id: id },
          );
          provider = e.provider;
        }
        await sql.query(
          "UPDATE shop_list_items SET status='purchased',amount=$1,provider=$2,not_discount=$3,updated_at=now() WHERE id=$4",
          [v.amount, provider, v.not_discount, id],
        );
      } else throw new BadRequestException('Acción inválida');
      return { ok: true };
    });
  }
  async transfer(user: string, body: unknown) {
    const v = parse(z.object({ amount: amountSchema, from: z.enum(['box', 'savings']) }), body);
    return this.finance.db.transaction(async (sql) => {
      await this.finance.lock(sql, user);
      const b = await this.finance.balances(sql, user);
      if (new Decimal(v.amount).gt(b[v.from]))
        throw new BadRequestException('Saldo insuficiente en la cuenta de origen');
      for (const a of ['box', 'savings'])
        await sql.query(
          `UPDATE ${a === 'box' ? 'boxes' : 'savings'} SET amount=amount+$1,updated_at=now() WHERE "user"=$2`,
          [new Decimal(v.amount).mul(a === v.from ? -1 : 1).toFixed(2), user],
        );
      return this.finance.balances(sql, user);
    });
  }
  async budgets(user: string, month: string) {
    parse(monthSchema, month);
    const categories = (
      await this.finance.db.query(
        'SELECT c.* FROM budget_categories c JOIN monthly_budgets b ON c.monthly_budget_id=b.id WHERE b.user_id=$1 AND b.month=$2::date ORDER BY c.id',
        [user, month + '-01'],
      )
    ).rows;
    const expenses = (
      await this.finance.db.query(
        'SELECT amount,slug FROM expenses WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL AND created_at>=$2::date AND created_at<$2::date+interval \'1 month\'',
        [user, month + '-01'],
      )
    ).rows;
    return categories.map((c) => {
      const tags = words(c.slug);
      const spent = expenses
        .filter((e) => words(e.slug ?? '').some((w) => tags.includes(w)))
        .reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
      return { ...c, spent: money(spent), remaining: money(new Decimal(c.amount).minus(spent)) };
    });
  }
  async budgetSave(user: string, body: unknown, id?: string) {
    const v = parse(budgetSchema, body);
    if (!words(v.slug).length) throw new BadRequestException('Añade al menos una palabra clave');
    return this.finance.db.transaction(async (sql) => {
      await this.finance.lock(sql, user);
      if (id) {
        const r = await sql.query(
          'UPDATE budget_categories SET name=$1,amount=$2,slug=$3,updated_at=now() WHERE id=$4 AND monthly_budget_id IN (SELECT id FROM monthly_budgets WHERE user_id=$5) RETURNING *',
          [v.name, v.amount, words(v.slug).join(' '), id, user],
        );
        if (!r.rows.length) throw new NotFoundException();
        return r.rows[0];
      }
      const b = (
        await sql.query(
          'INSERT INTO monthly_budgets(user_id,month,created_at,updated_at) VALUES($1,$2,now(),now()) ON CONFLICT(user_id,month) DO UPDATE SET updated_at=now() RETURNING id',
          [user, v.month + '-01'],
        )
      ).rows[0];
      return (
        await sql.query(
          'INSERT INTO budget_categories(monthly_budget_id,name,amount,slug,created_at,updated_at) VALUES($1,$2,$3,$4,now(),now()) RETURNING *',
          [b.id, v.name, v.amount, words(v.slug).join(' ')],
        )
      ).rows[0];
    });
  }
  async budgetDelete(user: string, id: string) {
    const r = await this.finance.db.query(
      'DELETE FROM budget_categories WHERE id=$1 AND monthly_budget_id IN(SELECT id FROM monthly_budgets WHERE user_id=$2) RETURNING id',
      [id, user],
    );
    if (!r.rows.length) throw new NotFoundException();
    return { ok: true };
  }
  async splits(user: string, id: string, body?: unknown) {
    return this.finance.db.transaction(async (sql) => {
      await this.finance.lock(sql, user);
      const expense = await this.finance.owned(sql, 'expenses', id, user);
      if (body !== undefined) {
        const v = parse(
          z.object({
            splits: z
              .array(
                z.object({
                  user_id: z.string().regex(/^[1-9]\d*$/),
                  amount: amountSchema,
                  paid_amount: z.coerce.number().min(0).default(0),
                }),
              )
              .max(50),
          }),
          body,
        );
        if (new Set(v.splits.map((s) => s.user_id)).size !== v.splits.length)
          throw new BadRequestException('No repitas participantes');
        if (
          v.splits.length &&
          !v.splits.reduce((a, s) => a.plus(s.amount), new Decimal(0)).eq(expense.amount)
        )
          throw new BadRequestException('El reparto debe sumar el total del gasto');
        await sql.query('DELETE FROM expense_splits WHERE expense_id=$1', [id]);
        for (const s of v.splits) {
          if (new Decimal(s.paid_amount).gt(s.amount))
            throw new BadRequestException('El pago supera la parte asignada');
          await sql.query(
            'INSERT INTO expense_splits(expense_id,user_id,amount,paid_amount,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,now(),now())',
            [
              id,
              s.user_id,
              s.amount,
              money(s.paid_amount),
              new Decimal(s.paid_amount).eq(s.amount) ? 'paid' : 'pending',
            ],
          );
        }
      }
      return (await sql.query('SELECT * FROM expense_splits WHERE expense_id=$1 ORDER BY id', [id]))
        .rows;
    });
  }
}
