import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../database';
import { FinanceService } from '../finance';
import { PlanningService } from '../planning';
import { ActivityService } from '../activity';
import { amountSchema, currencySchema, now } from '../domain';

const earningExpenseArgs = z
  .object({
    description: z.string().trim().min(1).max(500),
    amount: amountSchema,
    provider: z.enum(['box', 'savings']).default('box'),
    currency: currencySchema.default('$'),
    recurrence_type: z.enum(['one_time', 'days', 'monthly']).default('one_time'),
    term: z.number().int().min(1).max(3650).optional(),
    claim_day: z.number().int().min(1).max(31).optional(),
    auto_claim: z.boolean().default(false),
  })
  .strict()
  .refine(
    (v) => v.recurrence_type !== 'days' || !!v.term,
    'Indica el intervalo en días (term) para una recurrencia por días.',
  )
  .refine(
    (v) => v.recurrence_type !== 'monthly' || !!v.claim_day,
    'Indica el día del mes (claim_day) para una recurrencia mensual.',
  );
const transferArgs = z
  .object({ amount: amountSchema, from: z.enum(['box', 'savings']) })
  .strict();
const budgetArgs = z
  .object({
    name: z.string().trim().min(1).max(120),
    amount: amountSchema,
    slug: z.string().trim().min(1).max(1800),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'El mes debe tener el formato YYYY-MM')
      .optional(),
  })
  .strict();
const shoppingArgs = z
  .object({
    description: z.string().trim().min(1).max(500),
    amount: amountSchema,
    currency: currencySchema.default('$'),
  })
  .strict();

const ARG_SCHEMAS: Record<string, z.ZodType<any>> = {
  registrar_ingreso: earningExpenseArgs,
  registrar_gasto: earningExpenseArgs,
  transferir_dinero: transferArgs,
  crear_presupuesto: budgetArgs,
  agregar_compra: shoppingArgs,
};
export const ACTION_NAMES = Object.keys(ARG_SCHEMAS);
export const ACTION_TOOLS = [
  {
    name: 'registrar_ingreso',
    description:
      'Prepara el registro de un ingreso para que el usuario lo confirme en la interfaz. No se aplica hasta que el usuario lo confirme explícitamente; nunca digas que ya se registró.',
    parameters: {
      type: 'OBJECT',
      properties: {
        description: { type: 'STRING' },
        amount: { type: 'NUMBER' },
        provider: {
          type: 'STRING',
          enum: ['box', 'savings'],
          description: 'Cuenta destino: caja (box) o ahorros (savings). Por defecto caja.',
        },
        currency: { type: 'STRING', enum: ['$', 'bs', '$bcv', '$parallel', '€'] },
        recurrence_type: { type: 'STRING', enum: ['one_time', 'days', 'monthly'] },
        term: { type: 'INTEGER', description: 'Días entre repeticiones, solo si recurrence_type=days' },
        claim_day: { type: 'INTEGER', description: 'Día del mes 1-31, solo si recurrence_type=monthly' },
        auto_claim: { type: 'BOOLEAN', description: 'Si se cobra automáticamente al vencer' },
      },
      required: ['description', 'amount'],
    },
  },
  {
    name: 'registrar_gasto',
    description:
      'Prepara el registro de un gasto para que el usuario lo confirme en la interfaz. No se aplica hasta que el usuario lo confirme explícitamente; nunca digas que ya se registró.',
    parameters: {
      type: 'OBJECT',
      properties: {
        description: { type: 'STRING' },
        amount: { type: 'NUMBER' },
        provider: {
          type: 'STRING',
          enum: ['box', 'savings'],
          description: 'Cuenta de origen: caja (box) o ahorros (savings). Por defecto caja.',
        },
        currency: { type: 'STRING', enum: ['$', 'bs', '$bcv', '$parallel', '€'] },
        recurrence_type: { type: 'STRING', enum: ['one_time', 'days', 'monthly'] },
        term: { type: 'INTEGER', description: 'Días entre repeticiones, solo si recurrence_type=days' },
        claim_day: { type: 'INTEGER', description: 'Día del mes 1-31, solo si recurrence_type=monthly' },
        auto_claim: { type: 'BOOLEAN', description: 'Si se cobra automáticamente al vencer' },
      },
      required: ['description', 'amount'],
    },
  },
  {
    name: 'transferir_dinero',
    description:
      'Prepara una transferencia entre caja y ahorros para que el usuario la confirme en la interfaz. No se aplica hasta que el usuario la confirme explícitamente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        amount: { type: 'NUMBER' },
        from: { type: 'STRING', enum: ['box', 'savings'], description: 'Cuenta de origen' },
      },
      required: ['amount', 'from'],
    },
  },
  {
    name: 'crear_presupuesto',
    description:
      'Prepara una categoría de presupuesto mensual para que el usuario la confirme en la interfaz. No se aplica hasta que el usuario la confirme explícitamente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        amount: { type: 'NUMBER', description: 'Límite del presupuesto' },
        slug: {
          type: 'STRING',
          description: 'Palabras clave separadas por espacio para asociar gastos a esta categoría',
        },
        month: { type: 'STRING', description: 'Mes YYYY-MM; si se omite usa el mes actual' },
      },
      required: ['name', 'amount', 'slug'],
    },
  },
  {
    name: 'agregar_compra',
    description:
      'Prepara un artículo en la lista de compras para que el usuario lo confirme en la interfaz. No se aplica hasta que el usuario lo confirme explícitamente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        description: { type: 'STRING' },
        amount: { type: 'NUMBER' },
        currency: { type: 'STRING', enum: ['$', 'bs', '$bcv', '$parallel', '€'] },
      },
      required: ['description', 'amount'],
    },
  },
];
function summarize(name: string, v: any): string {
  const money = (a: unknown, c?: string) => `${a} ${c ?? '$'}`;
  switch (name) {
    case 'registrar_ingreso':
      return `Registrar ingreso: "${v.description}" por ${money(v.amount, v.currency)} en ${v.provider === 'savings' ? 'Ahorros' : 'Caja'}${v.recurrence_type !== 'one_time' ? ' (recurrente)' : ''}`;
    case 'registrar_gasto':
      return `Registrar gasto: "${v.description}" por ${money(v.amount, v.currency)} desde ${v.provider === 'savings' ? 'Ahorros' : 'Caja'}${v.recurrence_type !== 'one_time' ? ' (recurrente)' : ''}`;
    case 'transferir_dinero':
      return `Transferir ${money(v.amount)} de ${v.from === 'box' ? 'Caja' : 'Ahorros'} a ${v.from === 'box' ? 'Ahorros' : 'Caja'}`;
    case 'crear_presupuesto':
      return `Crear presupuesto "${v.name}" por ${money(v.amount)}${v.month ? ` para ${v.month}` : ''}`;
    case 'agregar_compra':
      return `Agregar a la lista de compras: "${v.description}" por ${money(v.amount, v.currency)}`;
    default:
      return name;
  }
}
export type ActionRow = {
  id: string;
  kind: string;
  summary: string;
  status: 'pending' | 'executing' | 'confirmed' | 'cancelled';
};
@Injectable()
export class ActionsService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(FinanceService) private finance: FinanceService,
    @Inject(PlanningService) private planning: PlanningService,
    @Inject(ActivityService) private activity: ActivityService,
  ) {}
  async propose(user: string, name: string, rawArgs: unknown): Promise<{ error: string } | ActionRow> {
    const schema = ARG_SCHEMAS[name];
    if (!schema) return { error: 'Herramienta no disponible.' };
    const parsed = schema.safeParse(rawArgs ?? {});
    if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('. ') };
    const summary = summarize(name, parsed.data);
    const row = (
      await this.db.query(
        `INSERT INTO financy_ai_actions(user_id,kind,payload,summary) VALUES($1,$2,$3,$4) RETURNING id,kind,summary,status`,
        [user, name, JSON.stringify(parsed.data), summary],
      )
    ).rows[0];
    return row;
  }
  async confirm(user: string, id: string) {
    const claimed = await this.db.query(
      `UPDATE financy_ai_actions SET status='executing' WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING *`,
      [id, user],
    );
    const row = claimed.rows[0];
    if (!row) throw new ConflictException('Esta acción ya fue resuelta o no existe.');
    try {
      const v = JSON.parse(row.payload);
      let result: any;
      switch (row.kind) {
        case 'registrar_ingreso':
          result = await this.finance.save(user, 'earnings', v);
          break;
        case 'registrar_gasto':
          result = await this.finance.save(user, 'expenses', v);
          break;
        case 'transferir_dinero':
          result = await this.planning.transfer(user, v);
          break;
        case 'crear_presupuesto':
          result = await this.planning.budgetSave(user, {
            ...v,
            month: v.month || now().toFormat('yyyy-MM'),
          });
          break;
        case 'agregar_compra':
          result = await this.planning.shopSave(user, v);
          break;
        default:
          throw new ConflictException('Acción no soportada.');
      }
      await this.db.query(
        `UPDATE financy_ai_actions SET status='confirmed',result=$1,resolved_at=now() WHERE id=$2`,
        [JSON.stringify(result), id],
      );
      const activityKind: Record<string, string> = {
        registrar_ingreso: 'earning_created',
        registrar_gasto: 'expense_created',
        transferir_dinero: 'transfer',
        crear_presupuesto: 'budget_created',
        agregar_compra: 'shopping_created',
      };
      await this.activity.log(
        user,
        'ai',
        activityKind[row.kind] ?? row.kind,
        result?.id ?? null,
        row.summary,
        row.kind === 'transferir_dinero' ? v : {},
      );
      return { ok: true, summary: row.summary, result };
    } catch (error) {
      await this.db.query(`UPDATE financy_ai_actions SET status='pending' WHERE id=$1`, [id]);
      throw error;
    }
  }
  async cancel(user: string, id: string) {
    const r = await this.db.query(
      `UPDATE financy_ai_actions SET status='cancelled',resolved_at=now() WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING id`,
      [id, user],
    );
    if (!r.rows.length) throw new ConflictException('Esta acción ya fue resuelta o no existe.');
    return { ok: true };
  }
}
