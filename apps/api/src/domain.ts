import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { DateTime } from 'luxon';
import { z } from 'zod';
export const zone = 'America/Caracas';
export const now = () => DateTime.now().setZone(zone);
export const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2).toFixed(2);
export const words = (s: string) => [
  ...new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[\p{L}\p{N}]+/gu) ?? [],
  ),
];
export const recurring = (r: any) => r.term != null || r.claim_day != null;
export function dueAt(r: any) {
  if (!r.UpdatedTerm || !recurring(r)) return null;
  const anchor =
    r.UpdatedTerm instanceof Date
      ? DateTime.fromJSDate(r.UpdatedTerm, { zone: 'UTC' }).setZone(zone)
      : DateTime.fromISO(String(r.UpdatedTerm).replace(' ', 'T'), { zone });
  if (r.recurrence_type === 'monthly' && r.claim_day) {
    let d = anchor.startOf('month').set({ day: Math.min(r.claim_day, anchor.daysInMonth!) });
    if (d <= anchor) {
      d = anchor.plus({ months: 1 }).startOf('month');
      d = d.set({ day: Math.min(r.claim_day, d.daysInMonth!) });
    }
    return d;
  }
  return r.NextClaim == null ? null : anchor.plus({ days: r.NextClaim });
}
export const amountSchema = z
  .union([z.string(), z.number()])
  .transform(String)
  .refine(
    (v) => /^\d{1,10}(\.\d{1,2})?$/.test(v) && Number(v) > 0,
    'Introduce un importe positivo con hasta 2 decimales',
  );
export const providerSchema = z.enum(['box', 'savings', 'auto']);
export const currencySchema = z.enum([
  '$',
  'bs',
  '$bcv',
  '$parallel',
  '€',
  'USD',
  'VES_BCV',
  'EUR',
  'EUR_PARALLEL',
]);
export const entrySchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    amount: amountSchema,
    provider: providerSchema.default('box'),
    currency: currencySchema.default('$'),
    slug: z.string().max(1800).default(''),
    recurrence_type: z.enum(['one_time', 'days', 'monthly']).default('one_time'),
    term: z.number().int().min(1).max(3650).nullable().optional(),
    claim_day: z.number().int().min(1).max(31).nullable().optional(),
    nextterm: z.number().int().min(0).max(3650).optional(),
    auto_claim: z.boolean().default(false),
    project_id: z.number().int().positive().nullable().default(null),
  })
  .refine((v) => v.recurrence_type !== 'days' || !!v.term, 'Indica el intervalo en días')
  .refine((v) => v.recurrence_type !== 'monthly' || !!v.claim_day, 'Indica el día del mes');
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(result.error.issues.map((i) => i.message).join('. '));
  return result.data;
}
export function kind(value: string): 'earnings' | 'expenses' {
  if (value !== 'earnings' && value !== 'expenses')
    throw new BadRequestException('Tipo de movimiento inválido');
  return value;
}
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const idSchema = z.string().regex(/^[1-9]\d{0,14}$/);
