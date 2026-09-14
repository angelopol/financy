import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { z } from 'zod';
import { Database, Sql } from './database';
import { dueAt, entrySchema, kind, money, now, parse, recurring, words } from './domain';
import { RatesService } from './rates';
export type Entry = z.infer<typeof entrySchema>;
// Auto-picks the account to move money to/from: income goes to whichever
// account already has the higher balance, expenses come out of whichever
// has the lower balance.
const pickAuto = (balances: { box: string; savings: string }, credit: boolean) =>
  credit === new Decimal(balances.box).gte(balances.savings) ? 'box' : 'savings';
@Injectable()
export class FinanceService {
  constructor(
    @Inject(Database) readonly db: Database,
    @Inject(RatesService) readonly rates: RatesService,
  ) {}
  async lock(sql: Sql, user: string) {
    await sql.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user]);
    for (const t of ['boxes', 'savings'])
      await sql.query(
        `INSERT INTO ${t}("user",amount,created_at,updated_at) SELECT $1,0,now(),now() WHERE NOT EXISTS(SELECT 1 FROM ${t} WHERE "user"=$1)`,
        [user],
      );
  }
  async balances(sql: Sql, user: string) {
    const b = await sql.query('SELECT amount FROM boxes WHERE "user"=$1 ORDER BY id', [user]);
    const s = await sql.query('SELECT amount FROM savings WHERE "user"=$1 ORDER BY id', [user]);
    if (b.rows.length !== 1 || s.rows.length !== 1)
      throw new ConflictException(
        'Se requiere una única caja y cuenta de ahorros por usuario. Revisa los datos migrados.',
      );
    return { box: money(b.rows[0].amount), savings: money(s.rows[0].amount) };
  }
  async apply(sql: Sql, user: string, amount: string, provider: string, credit: boolean) {
    const balances = await this.balances(sql, user);
    const a = new Decimal(amount);
    if (provider === 'auto') provider = pickAuto(balances, credit);
    const p = provider as 'box' | 'savings';
    const other = p === 'box' ? 'savings' : 'box';
    const allocation = { box: '0.00', savings: '0.00' };
    if (credit) allocation[p] = money(a);
    else {
      if (a.gt(new Decimal(balances.box).plus(balances.savings)))
        throw new BadRequestException('Saldo insuficiente entre caja y ahorros');
      allocation[p] = money(Decimal.min(a, balances[p]));
      allocation[other] = money(a.minus(allocation[p]));
    }
    for (const account of ['box', 'savings'] as const)
      await sql.query(
        `UPDATE ${account === 'box' ? 'boxes' : 'savings'} SET amount=amount+$1,updated_at=now() WHERE "user"=$2`,
        [new Decimal(allocation[account]).mul(credit ? 1 : -1).toFixed(2), user],
      );
    if (!credit && new Decimal(allocation[other]).gt(allocation[p])) provider = other;
    return { provider, allocation };
  }
  async owned(sql: Sql, table: string, id: string, user: string) {
    const item = (
      await sql.query(`SELECT * FROM ${table} WHERE id=$1 AND "user"=$2 FOR UPDATE`, [id, user])
    ).rows[0];
    if (!item) throw new NotFoundException('Registro no encontrado');
    return item;
  }
  async create(
    sql: Sql,
    user: string,
    table: 'earnings' | 'expenses',
    v: Entry,
    extra: { recurring_id?: string; shop_list_item_id?: string } = {},
  ) {
    const repeat = v.recurrence_type !== 'one_time';
    let amount = v.amount;
    let currency = v.currency;
    if (
      table === 'expenses' ||
      !repeat ||
      !['$', 'bs', '$bcv', '€', 'EUR_PARALLEL'].includes(currency)
    ) {
      amount = await this.rates.convert(currency, amount);
      currency = '$';
    }
    let provider: string = v.provider;
    let allocation: any;
    if (!repeat && v.project_id === null) {
      const result = await this.apply(sql, user, amount, provider, table === 'earnings');
      provider = result.provider;
      allocation = result.allocation;
    } else if (provider === 'auto') {
      const b = await this.balances(sql, user);
      provider = pickAuto(b, table === 'earnings');
    }
    const columns = [
      'user',
      'description',
      'amount',
      'provider',
      'project_id',
      'slug',
      'recurrence_type',
      'term',
      'claim_day',
      'NextClaim',
      'UpdatedTerm',
      'auto_claim',
      'recurring_id',
      'created_at',
      'updated_at',
    ];
    const stamp = now().toFormat('yyyy-MM-dd HH:mm:ss');
    const values: any[] = [
      user,
      v.description,
      amount,
      provider,
      v.project_id,
      words(v.slug || v.description).join(' '),
      v.recurrence_type,
      v.recurrence_type === 'days' ? v.term : null,
      v.recurrence_type === 'monthly' ? v.claim_day : null,
      v.recurrence_type === 'days' ? (v.nextterm ?? v.term) : null,
      repeat ? stamp : null,
      v.auto_claim,
      extra.recurring_id ?? null,
      stamp,
      stamp,
    ];
    if (table === 'earnings') {
      columns.push('currency', 'OneTimeTase');
      values.push(
        currency,
        !repeat && v.currency !== '$' ? (await this.rates.get()).parallel : null,
      );
    } else {
      columns.push('shop_list_item_id');
      values.push(extra.shop_list_item_id ?? null);
    }
    const item = (
      await sql.query(
        `INSERT INTO ${table}(${columns.map((c) => '"' + c + '"').join(',')}) VALUES(${values.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
        values,
      )
    ).rows[0];
    if (!repeat) {
      await this.movement(sql, table, item);
      if (allocation)
        await sql.query(
          'INSERT INTO financy_allocations(kind,reference_id,box,savings) VALUES($1,$2,$3,$4)',
          [table, item.id, allocation.box, allocation.savings],
        );
    }
    return item;
  }
  async movement(sql: Sql, table: string, item: any) {
    await sql.query('DELETE FROM movements WHERE type=$1 AND reference_id=$2', [
      table === 'earnings' ? 'earning' : 'expense',
      item.id,
    ]);
    await sql.query(
      'INSERT INTO movements("user",project_id,type,reference_id,description,amount,provider,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())',
      [
        item.user,
        item.project_id,
        table === 'earnings' ? 'earning' : 'expense',
        item.id,
        item.description,
        item.amount,
        item.provider,
        item.created_at,
      ],
    );
  }
  async reverse(sql: Sql, table: string, item: any) {
    if (recurring(item) || item.project_id !== null) return;
    let a = (
      await sql.query(
        'SELECT box,savings FROM financy_allocations WHERE kind=$1 AND reference_id=$2',
        [table, item.id],
      )
    ).rows[0];
    // Legacy rows never recorded split debits. Their stored provider is the only available source.
    a ??= {
      box: item.provider === 'box' ? item.amount : '0',
      savings: item.provider === 'savings' ? item.amount : '0',
    };
    const b = await this.balances(sql, item.user);
    for (const account of ['box', 'savings'] as const) {
      if (table === 'earnings' && new Decimal(a[account]).gt(b[account]))
        throw new BadRequestException('No hay saldo suficiente para revertir este ingreso');
      await sql.query(
        `UPDATE ${account === 'box' ? 'boxes' : 'savings'} SET amount=amount+$1,updated_at=now() WHERE "user"=$2`,
        [new Decimal(a[account]).mul(table === 'earnings' ? -1 : 1).toFixed(2), item.user],
      );
    }
    await sql.query('DELETE FROM financy_allocations WHERE kind=$1 AND reference_id=$2', [
      table,
      item.id,
    ]);
  }
  async save(user: string, table: 'earnings' | 'expenses', body: unknown, id?: string) {
    const v = parse(entrySchema, body);
    return this.db.transaction(async (sql) => {
      await this.lock(sql, user);
      if (!id) return this.create(sql, user, table, v);
      const old = await this.owned(sql, table, id, user);
      if (table === 'expenses' && old.shop_list_item_id)
        throw new ConflictException('Devuelve la compra a pendiente para modificarla');
      if (recurring(old) !== (v.recurrence_type !== 'one_time'))
        throw new BadRequestException(
          'Crea un registro nuevo para cambiar entre único y recurrente',
        );
      if (
        table === 'expenses' &&
        (await sql.query('SELECT 1 FROM expense_splits WHERE expense_id=$1', [id])).rows.length
      )
        throw new ConflictException('Elimina el reparto antes de modificar el gasto');
      await this.reverse(sql, table, old);
      let amount = v.amount,
        currency = v.currency;
      let provider: string = v.provider;
      if (
        table === 'expenses' ||
        !recurring(old) ||
        !['$', 'bs', '$bcv', '€', 'EUR_PARALLEL'].includes(currency)
      ) {
        amount = await this.rates.convert(currency, amount);
        currency = '$';
      }
      if (!recurring(old) && v.project_id === null) {
        const result = await this.apply(sql, user, amount, provider, table === 'earnings');
        provider = result.provider;
        await sql.query(
          'INSERT INTO financy_allocations(kind,reference_id,box,savings) VALUES($1,$2,$3,$4)',
          [table, id, result.allocation.box, result.allocation.savings],
        );
      } else if (provider === 'auto') provider = old.provider;
      const vals: any[] = [
        v.description,
        amount,
        provider,
        words(v.slug || v.description).join(' '),
        v.auto_claim,
        v.project_id,
        v.recurrence_type,
        v.recurrence_type === 'days' ? v.term : null,
        v.recurrence_type === 'monthly' ? v.claim_day : null,
        id,
        user,
      ];
      let extra = '';
      if (table === 'earnings') {
        vals.push(
          currency,
          !recurring(old) && !['$', 'USD'].includes(v.currency)
            ? (await this.rates.get()).parallel
            : null,
        );
        extra = ',currency=$12,"OneTimeTase"=$13';
      }
      const updated = (
        await sql.query(
          `UPDATE ${table} SET description=$1,amount=$2,provider=$3,slug=$4,auto_claim=$5,project_id=$6,recurrence_type=$7::varchar,term=$8::integer,claim_day=$9,"NextClaim"=CASE WHEN $7::varchar='days' THEN $8::integer ELSE NULL END,updated_at=now()${extra} WHERE id=$10 AND "user"=$11 RETURNING *`,
          vals,
        )
      ).rows[0];
      if (!recurring(updated)) await this.movement(sql, table, updated);
      return updated;
    });
  }
  async remove(user: string, table: 'earnings' | 'expenses', id: string, sqlArg?: Sql) {
    const work = async (sql: Sql) => {
      await this.lock(sql, user);
      const item = await this.owned(sql, table, id, user);
      if (item.shop_list_item_id && !sqlArg)
        throw new ConflictException('Devuelve la compra a pendiente primero');
      await this.reverse(sql, table, item);
      await sql.query('DELETE FROM movements WHERE type=$1 AND reference_id=$2', [
        table === 'earnings' ? 'earning' : 'expense',
        id,
      ]);
      // A deleted deposit/withdraw expense or earning must stop counting toward its
      // shopping item's saved amount, whether removed directly or via Activity's undo
      // (which also calls remove()).
      await sql.query('DELETE FROM financy_shop_savings WHERE reference_type=$1 AND reference_id=$2', [
        table,
        id,
      ]);
      await sql.query(`DELETE FROM ${table} WHERE id=$1 AND "user"=$2`, [id, user]);
      return { ok: true };
    };
    return sqlArg ? work(sqlArg) : this.db.transaction(work);
  }
  async claim(user: string, table: 'earnings' | 'expenses', id: string, expectedAnchor?: string) {
    return this.db.transaction(async (sql) => {
      await this.lock(sql, user);
      const item = await this.owned(sql, table, id, user);
      const due = dueAt(item);
      if (expectedAnchor !== undefined && String(item.UpdatedTerm) !== expectedAnchor)
        throw new ConflictException('Este movimiento cambió. Actualiza la página.');
      if (!due || (!expectedAnchor && due > now()))
        throw new ConflictException('Este movimiento todavía no vence');
      const inserted = await sql.query(
        'INSERT INTO financy_claims(kind,reference_id,due_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING reference_id',
        [table, id, due.toISO()],
      );
      if (!inserted.rows.length) throw new ConflictException('Este período ya fue registrado');
      const history = await this.create(
        sql,
        user,
        table,
        {
          description: item.description,
          amount: String(item.amount),
          currency: item.currency ?? '$',
          provider: item.provider,
          slug: item.slug ?? '',
          recurrence_type: 'one_time',
          auto_claim: false,
          project_id: item.project_id,
        },
        { recurring_id: id },
      );
      await sql.query(
        `UPDATE ${table} SET "UpdatedTerm"=$1,"NextClaim"=term,updated_at=now() WHERE id=$2`,
        [now().toFormat('yyyy-MM-dd HH:mm:ss'), id],
      );
      return history;
    });
  }
  // Re-anchors an overdue recurring entry to today without booking a
  // transaction: a manual fix for items left stuck by a cron outage, distinct
  // from claim() which both books the money and advances the schedule.
  async resync(user: string, table: 'earnings' | 'expenses', id: string) {
    return this.db.transaction(async (sql) => {
      const item = await this.owned(sql, table, id, user);
      if (!recurring(item)) throw new ConflictException('Este movimiento no es recurrente.');
      const due = dueAt(item);
      if (due && due > now()) throw new ConflictException('Este movimiento no está atrasado.');
      const previousAnchor = String(item.UpdatedTerm);
      await sql.query(
        `UPDATE ${table} SET "UpdatedTerm"=$1,"NextClaim"=term,updated_at=now() WHERE id=$2`,
        [now().toFormat('yyyy-MM-dd HH:mm:ss'), id],
      );
      return { ok: true, previous_anchor: previousAnchor };
    });
  }
  async list(user: string, table: 'earnings' | 'expenses', query: any, report = false) {
    const v = parse(
      z.object({
        q: z.string().max(200).default(''),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        provider: z.enum(['box', 'savings']).optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        amount_min: z.coerce.number().min(0).optional(),
        amount_max: z.coerce.number().min(0).optional(),
        project_id: z.coerce.number().int().positive().optional(),
        mode: z.enum(['all', 'recurring', 'history']).default('all'),
      }),
      query,
    );
    const params: any[] = [user, v.project_id ?? null];
    let where = '"user"=$1 AND project_id IS NOT DISTINCT FROM $2';
    const add = (sql: string, value: any) => {
      params.push(value);
      where += ' AND ' + sql.replace('?', `$${params.length}`);
    };
    if (v.q)
      add("lower(description || ' ' || COALESCE(slug,'')) LIKE ?", '%' + v.q.toLowerCase() + '%');
    if (v.provider) add('provider=?', v.provider);
    if (v.from) add('created_at>=?::date', v.from);
    if (v.to) add("created_at<?::date+interval '1 day'", v.to);
    if (v.amount_min !== undefined) add('amount>=?', v.amount_min);
    if (v.amount_max !== undefined) add('amount<=?', v.amount_max);
    if (report || v.mode === 'history') where += ' AND term IS NULL AND claim_day IS NULL';
    else if (v.mode === 'recurring') where += ' AND (term IS NOT NULL OR claim_day IS NOT NULL)';
    const total = (
      await this.db.query(
        `SELECT count(*) AS count,COALESCE(sum(amount),0) AS amount FROM ${table} WHERE ${where}`,
        params,
      )
    ).rows[0];
    const result = await this.db.query(
      `SELECT * FROM ${table} WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $${params.length + 1}`,
      [...params, (v.page - 1) * 20],
    );
    return {
      items: result.rows.map((r) => ({ ...r, due_at: dueAt(r)?.toISO() ?? null })),
      total: Number(total.count),
      totalAmount: total.amount,
      page: v.page,
      pages: Math.ceil(Number(total.count) / 20),
    };
  }
  async dashboard(user: string, month = now().toFormat('yyyy-MM')) {
    return this.db.transaction(async (sql) => {
      await this.lock(sql, user);
      const balances = await this.balances(sql, user);
      const totals: any = {};
      for (const t of ['earnings', 'expenses'])
        totals[t] = (
          await sql.query(
            `SELECT COALESCE(sum(amount),0) AS total FROM ${t} WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL AND created_at>=$2::date AND created_at<$2::date+interval '1 month'`,
            [user, month + '-01'],
          )
        ).rows[0].total;
      const recent = await sql.query(
        `SELECT id,'earning' AS type,description,amount,provider,created_at FROM earnings WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL UNION ALL SELECT id,'expense' AS type,description,amount,provider,created_at FROM expenses WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL ORDER BY created_at DESC LIMIT 6`,
        [user],
      );
      const upcoming: any[] = [];
      const projectedByType = { earnings: new Decimal(0), expenses: new Decimal(0) };
      let projectionAvailable = true;
      for (const t of ['earnings', 'expenses'] as const) {
        const rows = await sql.query(
          `SELECT * FROM ${t} WHERE "user"=$1 AND project_id IS NULL AND (term IS NOT NULL OR claim_day IS NOT NULL)`,
          [user],
        );
        for (const r of rows.rows) {
          const due = dueAt(r);
          upcoming.push({ ...r, type: t, due_at: due?.toISO() });
          try {
            const amount =
              t === 'earnings' ? await this.rates.convert(r.currency, String(r.amount)) : r.amount;
            projectedByType[t] = projectedByType[t].plus(
              new Decimal(amount).mul(r.claim_day ? 1 : r.term <= 22 ? 2 : 1),
            );
          } catch {
            projectionAvailable = false;
          }
        }
      }
      const projected = projectedByType.earnings.minus(projectedByType.expenses);
      const trend = await sql.query(
        `SELECT to_char(created_at,'YYYY-MM-DD') AS day, sum(amount) AS amount,type FROM (SELECT created_at,amount,'earning' AS type FROM earnings WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL UNION ALL SELECT created_at,amount,'expense' AS type FROM expenses WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL) t WHERE created_at>=$2::date AND created_at<$2::date+interval '1 month' GROUP BY day,type ORDER BY day`,
        [user, month + '-01'],
      );
      return {
        ...balances,
        total: money(new Decimal(balances.box).plus(balances.savings)),
        income: totals.earnings,
        expenses: totals.expenses,
        net: money(new Decimal(totals.earnings).minus(totals.expenses)),
        projected: projectionAvailable ? money(projected) : null,
        projected_income: projectionAvailable ? money(projectedByType.earnings) : null,
        projected_expenses: projectionAvailable ? money(projectedByType.expenses) : null,
        recent: recent.rows,
        upcoming: upcoming
          .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
          .slice(0, 5),
        trend: trend.rows,
      };
    });
  }
  // Powers the notification bell: recurring items due within a week (including
  // overdue ones) and the current month's spending-limit status. Read-only and
  // separate from dashboard() since it's polled from every page, not just /dashboard.
  async notifications(user: string) {
    return this.db.transaction(async (sql) => {
      const profile = (
        await sql.query('SELECT monthly_expense_limit FROM users WHERE id=$1', [user])
      ).rows[0];
      const month = now().toFormat('yyyy-MM');
      const spent = (
        await sql.query(
          `SELECT COALESCE(sum(amount),0) AS total FROM expenses WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL AND created_at>=$2::date AND created_at<$2::date+interval '1 month'`,
          [user, month + '-01'],
        )
      ).rows[0].total;
      const limit = Number(profile.monthly_expense_limit || 0);
      const budget =
        limit > 0
          ? {
              limit: money(limit),
              spent: money(spent),
              percent: Math.round((Number(spent) / limit) * 100),
              level:
                Number(spent) >= limit ? 'exceeded' : Number(spent) >= limit * 0.8 ? 'warning' : 'ok',
            }
          : null;
      const items: any[] = [];
      for (const t of ['earnings', 'expenses'] as const) {
        const rows = await sql.query(
          `SELECT * FROM ${t} WHERE "user"=$1 AND project_id IS NULL AND (term IS NOT NULL OR claim_day IS NOT NULL)`,
          [user],
        );
        for (const r of rows.rows) {
          const due = dueAt(r);
          if (due && due <= now().plus({ days: 7 }))
            items.push({
              id: r.id,
              type: t,
              description: r.description,
              amount: r.amount,
              currency: r.currency ?? '$',
              due_at: due.toISO(),
              overdue: due < now(),
            });
        }
      }
      items.sort((a, b) => a.due_at.localeCompare(b.due_at));
      return { as_of: now().toISO(), items: items.slice(0, 10), budget };
    });
  }
}
