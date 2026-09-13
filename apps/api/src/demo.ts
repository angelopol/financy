// Local, ephemeral preview only. Never loaded by the production entrypoint.
import 'dotenv/config';
import { TestDatabase } from '../test/test-db';
import { createApp } from './app';
import { FinanceService } from './finance';
import { PlanningService } from './planning';
import { RatesService } from './rates';
import { now } from './domain';
import { hash } from 'bcryptjs';
async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL)
    throw new Error('El modo demo es exclusivamente local');
  const db = new TestDatabase();
  await db.setup();
  const user = (
    await db.query(
      'INSERT INTO users(name,email,password,email_verified_at,monthly_expense_limit) VALUES($1,$2,$3,now(),$4) RETURNING id',
      ['Andrea Molina', 'demo@financy.local', await hash('FinancyDemo2026!', 10), '1800'],
    )
  ).rows[0].id;
  await db.query('INSERT INTO boxes("user",amount) VALUES($1,0)', [user]);
  await db.query('INSERT INTO savings("user",amount) VALUES($1,0)', [user]);
  const f = new FinanceService(db, new RatesService()),
    p = new PlanningService(f);
  const entries = [
    ['earnings', 'Salario · Estudio creativo', '2450', 'box', 1, 'salario'],
    ['earnings', 'Proyecto freelance', '680', 'box', 8, 'freelance'],
    ['earnings', 'Ahorros anteriores', '1850', 'savings', 1, 'ahorro'],
    ['expenses', 'Compra del supermercado', '86.50', 'box', 2, 'alimentacion mercado'],
    ['expenses', 'Café y una buena charla', '12.50', 'box', 4, 'ocio cafe'],
    ['expenses', 'Suscripción a herramientas', '24', 'box', 5, 'trabajo'],
    ['expenses', 'Alquiler de septiembre', '550', 'box', 6, 'hogar alquiler'],
    ['expenses', 'Cena con amigos', '42', 'box', 9, 'ocio comida'],
    ['expenses', 'Internet del hogar', '35', 'box', 10, 'hogar servicios'],
    ['expenses', 'Mercado de la semana', '67.80', 'box', 12, 'alimentacion mercado'],
  ];
  for (const [type, description, amount, provider, day, slug] of entries) {
    const e = await f.save(user, type as 'earnings' | 'expenses', {
      description,
      amount,
      provider,
      currency: '$',
      slug,
    });
    await db.query(`UPDATE ${type} SET created_at=$1 WHERE id=$2`, [
      now()
        .startOf('month')
        .plus({ days: Number(day) - 1, hours: 10 })
        .toFormat('yyyy-MM-dd HH:mm:ss'),
      e.id,
    ]);
  }
  await p.transfer(user, { amount: '300', from: 'box' });
  for (const [type, description, amount, day] of [
    ['earnings', 'Proyecto de diseño', '450', 18],
    ['expenses', 'Suscripción de música', '5.99', 20],
    ['expenses', 'Internet del hogar', '35', 26],
  ])
    await f.save(user, type as 'earnings' | 'expenses', {
      description,
      amount,
      provider: 'box',
      currency: '$',
      recurrence_type: 'monthly',
      claim_day: day,
      auto_claim: false,
    });
  for (const [name, amount, slug] of [
    ['Alimentación', '350', 'alimentacion mercado'],
    ['Hogar y servicios', '800', 'hogar servicios'],
    ['Tiempo para ti', '150', 'ocio cafe'],
  ])
    await p.budgetSave(user, { name, amount, slug, month: now().toFormat('yyyy-MM') });
  for (const [description, amount] of [
    ['Un escritorio para crear', '180'],
    ['Auriculares inalámbricos', '65'],
    ['Un libro pendiente', '22'],
  ])
    await p.shopSave(user, { description, amount });
  process.env.APP_URL = 'http://localhost:5173';
  const app = await createApp(db);
  await app.listen(3000, '127.0.0.1');
  console.log(
    'DEMO LOCAL · http://localhost:5173 · demo@financy.local / FinancyDemo2026! · Datos efímeros',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
