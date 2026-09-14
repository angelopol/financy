import 'reflect-metadata';
import { hash } from 'bcryptjs';
import { TestDatabase } from './test-db';
import { FinanceService } from '../src/finance';
import { PlanningService } from '../src/planning';
import { RatesService } from '../src/rates';
import { FinancialContextService } from '../src/ai/financial-context';
import { now } from '../src/domain';

async function main() {
  const db = new TestDatabase();
  await db.setup();
  const rates = new RatesService();
  rates.get = async () => ({ bcv: 36, parallel: 40, euro: 44, euro_parallel: 48 }) as any;
  const f = new FinanceService(db, rates);
  const p = new PlanningService(f);
  const ctx = new FinancialContextService(db, rates);

  const uid = (
    await db.query('INSERT INTO users(name,email,password) VALUES($1,$2,$3) RETURNING id', [
      'Stress Test',
      'stress@test.com',
      await hash('password1234', 4),
    ])
  ).rows[0].id;
  await db.query('INSERT INTO boxes("user",amount) VALUES($1,500)', [uid]);
  await db.query('INSERT INTO savings("user",amount) VALUES($1,2000)', [uid]);

  // Heavy but realistic: many projects/providers to actually approach the 101-group cap,
  // since all_time_totals aggregates by (project_id, provider, currency, recurring).
  const providers = ['box', 'savings'];
  for (let i = 0; i < 900; i++) {
    await f.save(uid, 'earnings', {
      description: `Ingreso ${i} con una descripción moderadamente larga para simular uso real`,
      amount: (50 + (i % 40)).toFixed(2),
      provider: providers[i % 2],
      currency: '$',
      project_id: i % 150 === 0 ? null : (i % 150) + 1,
    });
    await f.save(uid, 'expenses', {
      description: `Gasto ${i} en categoría variada con etiquetas de ejemplo`,
      amount: (10 + (i % 30)).toFixed(2),
      provider: providers[i % 2],
      slug: `categoria${i % 12} etiqueta${i % 7}`,
      project_id: i % 150 === 0 ? null : (i % 150) + 1,
    });
  }
  for (let i = 0; i < 15; i++)
    await p.budgetSave(uid, {
      name: `Presupuesto ${i}`,
      amount: '200',
      slug: `categoria${i} palabra${i}`,
      month: now().toFormat('yyyy-MM'),
    });
  for (let i = 0; i < 25; i++) await p.shopSave(uid, { description: `Compra planeada ${i}`, amount: '15' });

  const snapshot = await ctx.snapshot(uid);
  const snapshotJson = JSON.stringify(snapshot);
  console.log('--- Financial snapshot ---');
  console.log('bytes:', snapshotJson.length);
  console.log('earnings totals groups:', snapshot.all_time_totals.earnings.length);
  console.log('expenses totals groups:', snapshot.all_time_totals.expenses.length);
  console.log('recent_months rows:', snapshot.recent_months.length);
  console.log('truncated flag:', snapshot.totals_groups_truncated);

  const INSTRUCTIONS_APPROX_LEN = 1500; // matches the real system prompt order of magnitude
  const summary = 'x'.repeat(6000); // worst-case compacted memory
  const systemPrompt =
    'INSTRUCTIONS'.repeat(INSTRUCTIONS_APPROX_LEN / 12) +
    '\nMEMORIA:\n' +
    JSON.stringify(summary) +
    '\nSNAPSHOT:\n' +
    snapshotJson;
  console.log('\n--- System prompt (worst-case memory + real snapshot) ---');
  console.log('bytes:', Buffer.byteLength(systemPrompt));

  const longMessage = 'Respuesta detallada de Financy con cifras y contexto. '.repeat(20); // ~1.1KB
  const contents = Array.from({ length: 8 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'model',
    parts: [{ text: longMessage }],
  }));
  const fullBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 4096, temperature: 0.4 },
  };
  const total = Buffer.byteLength(JSON.stringify(fullBody));
  console.log('\n--- Full Gemini request body (8-message rolling window) ---');
  console.log('bytes:', total);
  console.log('MAX_CONTEXT_BYTES: 160000');
  console.log('margin:', 160000 - total, `(${(((160000 - total) / 160000) * 100).toFixed(1)}% free)`);

  const queryResult = await ctx.query(uid, { resource: 'earnings', page: 1 });
  const queryJson = JSON.stringify(queryResult);
  console.log('\n--- consultar_finanzas result (30-row page) ---');
  console.log('bytes:', queryJson.length);

  // Worst case within a single turn: 5 tool-calling rounds accumulate in `contents`
  // before the model gives a final text answer (see chat.ts's round loop, max 5).
  let worstContents = [...contents];
  for (let round = 0; round < 5; round++) {
    worstContents = [
      ...worstContents,
      { role: 'model', parts: [{ functionCall: { name: 'consultar_finanzas', args: { resource: 'earnings', page: round + 1 } } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'consultar_finanzas', response: queryResult } }] },
    ];
  }
  const worstBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: worstContents,
    generationConfig: { maxOutputTokens: 4096, temperature: 0.4 },
    tools: [{ functionDeclarations: [] }],
  };
  const worstTotal = Buffer.byteLength(JSON.stringify(worstBody));
  console.log('\n--- Worst case: 5 tool-calling rounds in one turn + worst-case snapshot/memory ---');
  console.log('bytes:', worstTotal);
  console.log('margin:', 160000 - worstTotal, `(${(((160000 - worstTotal) / 160000) * 100).toFixed(1)}% free)`);
  console.log(
    worstTotal > 160000
      ? '\nThis alone would exceed MAX_CONTEXT_BYTES if every round actually reached this size.\n' +
          "chat.ts's TOOL_ROUND_BUDGET guard exists precisely for this: once a round's request\n" +
          'would eat into the last ~40KB of headroom, it stops offering tools so the model must\n' +
          "answer in text with what it already has, instead of the request hard-failing.\n" +
          "See the 'chat degrades to a text answer...' test in finance.test.ts for the proof."
      : '\nStill under MAX_CONTEXT_BYTES even in this heavy scenario.',
  );

  await db.onModuleDestroy();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
