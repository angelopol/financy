import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Database } from './database';
const db = new Database();
async function main() {
  await db.transaction(async (sql) => {
    await sql.query('SELECT pg_advisory_xact_lock(71492001)');
    const existing = await sql.query("SELECT to_regclass('public.users') AS name");
    if (existing.rows[0].name) {
      const required: Record<string, string[]> = {
        users: ['monthly_expense_limit'],
        earnings: [
          'project_id',
          'slug',
          'recurrence_type',
          'claim_day',
          'auto_claim',
          'last_notified_claim_at',
          'NextClaim',
          'UpdatedTerm',
        ],
        expenses: [
          'project_id',
          'slug',
          'recurrence_type',
          'claim_day',
          'auto_claim',
          'shop_list_item_id',
        ],
        shop_list_items: ['not_discount'],
        monthly_budgets: ['month'],
        budget_categories: ['slug'],
        expense_splits: ['paid_amount'],
      };
      for (const [table, columns] of Object.entries(required)) {
        const found = await sql.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
          [table],
        );
        if (columns.some((c) => !found.rows.some((r) => r.column_name === c)))
          throw new Error(
            'Esquema Laravel incompleto en ' +
              table +
              '. Ejecuta las migraciones Laravel pendientes sobre la copia de destino primero.',
          );
      }
    }
    await sql.query(readFileSync(resolve('database/001_schema.sql'), 'utf8'));
    await sql.query(readFileSync(resolve('database/002_ai.sql'), 'utf8'));
  });
  console.log('Esquema listo. Datos y contraseñas existentes conservados.');
}
main()
  .catch(() => {
    console.error(
      'Migración cancelada. Verifica conexión y esquema Laravel completo; no se aplicaron cambios parciales.',
    );
    process.exitCode = 1;
  })
  .finally(() => db.onModuleDestroy());
