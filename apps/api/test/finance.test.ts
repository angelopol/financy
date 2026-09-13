import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { hash } from 'bcryptjs';
import { TestDatabase } from './test-db';
import { FinanceService } from '../src/finance';
import { PlanningService } from '../src/planning';
import { RatesService } from '../src/rates';
import { JobsService } from '../src/jobs';
import { ActionsService } from '../src/ai/actions';
import { ActivityService } from '../src/activity';
import { GeminiService } from '../src/ai/gemini';
import { dueAt, now } from '../src/domain';
import { csvCell } from '../src/controllers';
import { createApp } from '../src/app';
const db = new TestDatabase(),
  rates = new RatesService();
rates.get = async () =>
  ({ bcv: 36, parallel: 40, euro: 44, euro_parallel: 48, source: 'test' }) as any;
const f = new FinanceService(db, rates),
  p = new PlanningService(f),
  activity = new ActivityService(db, f, p),
  actions = new ActionsService(db, f, p, activity);
let sequence = 0;
async function user(box = 0, savings = 0) {
  const id = (
    await db.query('INSERT INTO users(name,email,password) VALUES($1,$2,$3) RETURNING id', [
      'Prueba',
      `u${sequence++}@test.com`,
      await hash('password1234', 4),
    ])
  ).rows[0].id;
  await db.query('INSERT INTO boxes("user",amount) VALUES($1,$2)', [id, box]);
  await db.query('INSERT INTO savings("user",amount) VALUES($1,$2)', [id, savings]);
  return id;
}
const entry = (amount: string, extra: any = {}) => ({
  description: 'Mercado',
  amount,
  currency: '$',
  provider: 'box',
  recurrence_type: 'one_time',
  ...extra,
});
before(() => db.setup());
after(() => db.onModuleDestroy());
test('schema can be applied twice without deleting balances', async () => {
  const u = await user(10);
  await db.setup();
  assert.equal((await f.balances(db, u)).box, '10.00');
});
test('income create, edit and delete keep balances and history consistent', async () => {
  const u = await user();
  const e = await f.save(u, 'earnings', entry('120'));
  assert.equal((await f.balances(db, u)).box, '120.00');
  await f.save(u, 'earnings', entry('90'), e.id);
  assert.equal((await f.balances(db, u)).box, '90.00');
  await f.remove(u, 'earnings', e.id);
  assert.equal((await f.balances(db, u)).box, '0.00');
  assert.equal((await db.query('SELECT * FROM movements WHERE "user"=$1', [u])).rows.length, 0);
});
test('split debit refunds exact original allocations', async () => {
  const u = await user(40, 100);
  const e = await f.save(u, 'expenses', entry('120', { provider: 'auto' }));
  assert.equal(e.provider, 'savings');
  assert.deepEqual(await f.balances(db, u), { box: '20.00', savings: '0.00' });
  await f.remove(u, 'expenses', e.id);
  assert.deepEqual(await f.balances(db, u), { box: '40.00', savings: '100.00' });
});
test('insufficient funds roll back an expense and its history', async () => {
  const u = await user(10, 5);
  await assert.rejects(f.save(u, 'expenses', entry('20')), /Saldo insuficiente/);
  assert.deepEqual(await f.balances(db, u), { box: '10.00', savings: '5.00' });
  assert.equal((await f.list(u, 'expenses', {})).total, 0);
});
test('transfers preserve total and reject overdraw of source', async () => {
  const u = await user(100, 5);
  await p.transfer(u, { amount: '40', from: 'box' });
  assert.deepEqual(await f.balances(db, u), { box: '60.00', savings: '45.00' });
  await assert.rejects(p.transfer(u, { amount: '70', from: 'box' }));
  assert.deepEqual(await f.balances(db, u), { box: '60.00', savings: '45.00' });
});
test('purchase is idempotent, pending restores allocation, gift creates no expense', async () => {
  const u = await user(5, 30);
  const item = await p.shopSave(u, { description: 'Libro', amount: '20' });
  await p.shopAction(u, item.id, 'purchase', { amount: '20', provider: 'box' });
  await assert.rejects(p.shopAction(u, item.id, 'purchase', { amount: '20', provider: 'box' }));
  assert.deepEqual(await f.balances(db, u), { box: '0.00', savings: '15.00' });
  await p.shopAction(u, item.id, 'pending', {});
  assert.deepEqual(await f.balances(db, u), { box: '5.00', savings: '30.00' });
  await p.shopAction(u, item.id, 'gift', {});
  assert.equal((await f.list(u, 'expenses', {})).total, 0);
});
test('not_discount purchase leaves both accounts unchanged', async () => {
  const u = await user(75, 25);
  const item = await p.shopSave(u, { description: 'Regalo', amount: '20' });
  await p.shopAction(u, item.id, 'purchase', {
    amount: '20',
    provider: 'auto',
    not_discount: true,
  });
  assert.deepEqual(await f.balances(db, u), { box: '75.00', savings: '25.00' });
  assert.equal((await f.list(u, 'expenses', {})).total, 0);
});
test('recurrences clamp day 31 and duplicate claims do not credit twice', async () => {
  assert.equal(
    dueAt({
      UpdatedTerm: '2027-01-31 12:00:00',
      claim_day: 31,
      recurrence_type: 'monthly',
    })?.toISODate(),
    '2027-02-28',
  );
  const u = await user();
  const e = await f.save(
    u,
    'earnings',
    entry('20', { recurrence_type: 'days', term: 15, nextterm: 0 }),
  );
  await db.query('UPDATE earnings SET "UpdatedTerm"=$1 WHERE id=$2', [
    now().minus({ days: 2 }).toFormat('yyyy-MM-dd HH:mm:ss'),
    e.id,
  ]);
  await f.claim(u, 'earnings', e.id);
  await assert.rejects(f.claim(u, 'earnings', e.id));
  assert.equal((await f.balances(db, u)).box, '20.00');
  assert.equal((await f.list(u, 'earnings', { mode: 'history' })).total, 1);
});
test('manual early claim requires the displayed anchor and cannot repeat its period', async () => {
  const u = await user();
  const e = await f.save(u, 'earnings', entry('20', { recurrence_type: 'days', term: 15 }));
  await assert.rejects(f.claim(u, 'earnings', e.id));
  await f.claim(u, 'earnings', e.id, e.UpdatedTerm);
  await assert.rejects(f.claim(u, 'earnings', e.id, e.UpdatedTerm));
  assert.equal((await f.balances(db, u)).box, '20.00');
});
test('monthly projection preserves the legacy cycle multiplier and converts foreign income', async () => {
  const u = await user();
  await f.save(u, 'earnings', entry('400', { currency: 'bs', recurrence_type: 'days', term: 15 }));
  await f.save(u, 'expenses', entry('5', { recurrence_type: 'days', term: 23 }));
  assert.equal((await f.dashboard(u)).projected, '15.00');
});
test('cron honors manual-only entries and deduplicates reminder outbox', async () => {
  const u = await user();
  await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [u]);
  for (const auto of [true, false]) {
    const e = await f.save(
      u,
      'earnings',
      entry('15', { recurrence_type: 'days', term: 1, auto_claim: auto }),
    );
    await db.query('UPDATE earnings SET "UpdatedTerm"=$1 WHERE id=$2', [
      now().minus({ days: 2 }).toFormat('yyyy-MM-dd HH:mm:ss'),
      e.id,
    ]);
  }
  const jobs = new JobsService(db, f);
  await jobs.run();
  await jobs.run();
  assert.equal((await f.balances(db, u)).box, '15.00');
  assert.equal((await db.query('SELECT * FROM financy_mail WHERE user_id=$1', [u])).rows.length, 1);
});
test('project scope always includes owner and does not touch personal accounts', async () => {
  const u = await user(),
    other = await user();
  const e = await f.save(u, 'earnings', entry('90', { project_id: 42 }));
  assert.equal((await f.list(other, 'earnings', { project_id: 42 })).total, 0);
  await assert.rejects(f.remove(other, 'earnings', e.id));
  assert.equal((await f.balances(db, u)).box, '0.00');
});
test('budget uses normalized shared keywords within selected month', async () => {
  const u = await user(100);
  await f.save(u, 'expenses', entry('25', { slug: 'Alimentación mercado' }));
  await p.budgetSave(u, {
    name: 'Comida',
    amount: '100',
    slug: 'alimentacion',
    month: now().toFormat('yyyy-MM'),
  });
  const b = await p.budgets(u, now().toFormat('yyyy-MM'));
  assert.equal(b[0].spent, '25.00');
  assert.equal(b[0].remaining, '75.00');
});
test('AI actions stay inert until confirmed, validate args and cannot be resolved twice', async () => {
  const u = await user(100);
  const invalid = await actions.propose(u, 'registrar_ingreso', { description: '', amount: '10' });
  assert.ok('error' in invalid);
  const proposal = await actions.propose(u, 'registrar_ingreso', {
    description: 'Freelance',
    amount: '25',
  });
  assert.ok('id' in proposal);
  assert.equal((await f.balances(db, u)).box, '100.00');
  const confirmed = await actions.confirm(u, proposal.id);
  assert.equal(confirmed.ok, true);
  assert.equal((await f.balances(db, u)).box, '125.00');
  await assert.rejects(actions.confirm(u, proposal.id));
  await assert.rejects(actions.cancel(u, proposal.id));
});
test('AI actions revert to pending and can be retried after a failed confirm', async () => {
  const u = await user(10);
  const proposal = await actions.propose(u, 'registrar_gasto', {
    description: 'Compra grande',
    amount: '999',
  });
  assert.ok('id' in proposal);
  await assert.rejects(actions.confirm(u, proposal.id));
  const row = (
    await db.query('SELECT status FROM financy_ai_actions WHERE id=$1', [proposal.id])
  ).rows[0];
  assert.equal(row.status, 'pending');
  const cancelled = await actions.cancel(u, proposal.id);
  assert.equal(cancelled.ok, true);
});
test('AI actions are scoped to their own user', async () => {
  const owner = await user(50),
    intruder = await user();
  const proposal = await actions.propose(owner, 'transferir_dinero', { amount: '10', from: 'box' });
  assert.ok('id' in proposal);
  await assert.rejects(actions.confirm(intruder, proposal.id));
  await assert.rejects(actions.cancel(intruder, proposal.id));
  assert.equal((await actions.confirm(owner, proposal.id)).ok, true);
});
test('chat proposes an action through a mocked Gemini call, and only the confirm endpoint applies it', async () => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.GEMINI_API_KEY = 'test-key';
  const userRow = { email: `chat${sequence++}@test.com`, password: 'password1234' };
  const app = await createApp(db);
  const gemini = app.get(GeminiService);
  let call = 0;
  gemini.generate = (async () => {
    call++;
    if (call === 1)
      return {
        role: 'model',
        parts: [{ functionCall: { name: 'registrar_ingreso', args: { description: 'Freelance', amount: 30 } } }],
      };
    return { role: 'model', parts: [{ text: 'Preparé el ingreso; confírmalo cuando quieras.' }] };
  }) as any;
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  let cookie = '';
  const request = async (path: string, method = 'GET', body?: any) =>
    fetch(base + '/api' + path, {
      method,
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    const registered = await request('/auth/register', 'POST', {
      name: 'Chat User',
      ...userRow,
    });
    cookie = registered.headers.get('set-cookie')!.split(';')[0];
    const uid = (await registered.json()).id;
    await db.query('UPDATE boxes SET amount=100 WHERE "user"=$1', [uid]);
    const sent = await request('/ai/messages', 'POST', {
      request_id: crypto.randomUUID(),
      message: 'Registra un ingreso de 30 por freelance',
    });
    assert.equal(sent.status, 201);
    const { messages } = await sent.json();
    const modelMessage = messages.find((m: any) => m.role === 'model');
    assert.ok(modelMessage.action);
    assert.equal(modelMessage.action.status, 'pending');
    assert.equal((await f.balances(db, uid)).box, '100.00');
    const unauthenticated = await fetch(base + '/api/ai/actions/' + modelMessage.action.id + '/confirm', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    });
    assert.equal(unauthenticated.status, 401);
    const confirmed = await request('/ai/actions/' + modelMessage.action.id + '/confirm', 'POST', {});
    assert.equal(confirmed.status, 201);
    assert.equal((await f.balances(db, uid)).box, '130.00');
    const again = await request('/ai/actions/' + modelMessage.action.id + '/confirm', 'POST', {});
    assert.equal(again.status, 409);
  } finally {
    await app.getHttpServer().close();
  }
});
test('manual actions are logged and can be undone through the HTTP API', async () => {
  process.env.APP_URL = 'http://localhost:5173';
  const app = await createApp(db);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  let cookie = '';
  const request = async (path: string, method = 'GET', body?: any) =>
    fetch(base + '/api' + path, {
      method,
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    const registered = await request('/auth/register', 'POST', {
      name: 'Activity User',
      email: `activity${sequence++}@test.com`,
      password: 'password1234',
    });
    cookie = registered.headers.get('set-cookie')!.split(';')[0];
    const uid = (await registered.json()).id;
    await db.query('UPDATE boxes SET amount=100 WHERE "user"=$1', [uid]);

    const created = await request('/entries/earnings', 'POST', entry('30', { provider: 'box' }));
    assert.equal(created.status, 201);
    const earningId = (await created.json()).id;
    assert.equal((await f.balances(db, uid)).box, '130.00');

    const list = await (await request('/activity')).json();
    const earningActivity = list.activity.find((a: any) => a.kind === 'earning_created');
    assert.ok(earningActivity);
    assert.equal(earningActivity.can_undo, true);

    const unauthenticated = await fetch(base + '/api/activity/' + earningActivity.id + '/undo', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    });
    assert.equal(unauthenticated.status, 401);

    const undone = await request('/activity/' + earningActivity.id + '/undo', 'POST', {});
    assert.equal(undone.status, 201);
    assert.equal((await f.balances(db, uid)).box, '100.00');
    assert.equal((await request('/entries/earnings/' + earningId)).status, 404);
    assert.equal((await request('/activity/' + earningActivity.id + '/undo', 'POST', {})).status, 409);

    await request('/accounts/transfer', 'POST', { amount: '20', from: 'box' });
    assert.deepEqual(await f.balances(db, uid), { box: '80.00', savings: '20.00' });
    const transferActivity = (await (await request('/activity')).json()).activity.find(
      (a: any) => a.kind === 'transfer',
    );
    assert.equal((await request('/activity/' + transferActivity.id + '/undo', 'POST', {})).status, 201);
    assert.deepEqual(await f.balances(db, uid), { box: '100.00', savings: '0.00' });

    const secondEarning = await request('/entries/earnings', 'POST', entry('5'));
    const secondActivity = (await (await request('/activity')).json()).activity.find(
      (a: any) => a.kind === 'earning_created' && a.id !== earningActivity.id,
    );
    const intruder = await request('/auth/register', 'POST', {
      name: 'Intruder',
      email: `activity${sequence++}@test.com`,
      password: 'password1234',
    });
    const intruderCookie = intruder.headers.get('set-cookie')!.split(';')[0];
    const asIntruder = await fetch(base + '/api/activity/' + secondActivity.id + '/undo', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', Cookie: intruderCookie },
    });
    assert.equal(asIntruder.status, 409);
    assert.equal((await secondEarning.json()).amount, '5.00');
  } finally {
    await app.getHttpServer().close();
  }
});
test('expense splits validate total, paid amounts and ownership', async () => {
  const u = await user(100),
    other = await user();
  const e = await f.save(u, 'expenses', entry('10'));
  await assert.rejects(p.splits(u, e.id, { splits: [{ user_id: u, amount: '9' }] }));
  await p.splits(u, e.id, {
    splits: [
      { user_id: u, amount: '5', paid_amount: 5 },
      { user_id: other, amount: '5' },
    ],
  });
  assert.equal((await p.splits(u, e.id))[0].status, 'paid');
  await assert.rejects(p.splits(other, e.id));
});
test('currency conversions preserve legacy formulas and fail closed', async () => {
  assert.equal(await rates.convert('bs', '400'), '10.00');
  assert.equal(await rates.convert('$bcv', '100'), '90.00');
  assert.equal(await rates.convert('€', '100'), '110.00');
  assert.equal(await rates.convert('EUR', '36'), '44.00');
  const broken = new RatesService();
  broken.get = async () => ({}) as any;
  await assert.rejects(broken.convert('bs', '5'));
  assert.equal(await broken.convert('$', '5'), '5.00');
});
test('CSV neutralizes spreadsheet formulas and quotes embedded delimiters', () => {
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('  =SUM(A1)'), '"\'  =SUM(A1)"');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
});
test('HTTP authentication supports Laravel bcrypt, CSRF, sessions, reset and owner protection', async () => {
  process.env.APP_URL = 'http://localhost:5173';
  const u = await user(100);
  const userRow = (await db.query('SELECT * FROM users WHERE id=$1', [u])).rows[0];
  await db.query('UPDATE users SET password=$1 WHERE id=$2', [
    userRow.password.replace('$2b$', '$2y$'),
    u,
  ]);
  const app = await createApp(db);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  let cookie = '';
  const request = async (
    path: string,
    method = 'GET',
    body?: any,
    origin = 'http://localhost:5173',
  ) =>
    fetch(base + '/api' + path, {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    assert.equal((await request('/auth/me')).status, 401);
    assert.equal(
      (
        await request(
          '/auth/login',
          'POST',
          { email: userRow.email, password: 'password1234' },
          'https://evil.test',
        )
      ).status,
      403,
    );
    const login = await request('/auth/login', 'POST', {
      email: userRow.email,
      password: 'password1234',
    });
    assert.equal(login.status, 201);
    cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.match(login.headers.get('set-cookie')!, /HttpOnly/);
    assert.equal((await login.json()).password, undefined);
    assert.equal((await request('/auth/me')).status, 200);
    assert.equal((await request('/entries/expenses', 'POST', entry('-1'))).status, 400);
    const other = await user();
    const foreign = await f.save(other, 'earnings', entry('20'));
    assert.equal((await request('/entries/earnings/' + foreign.id, 'DELETE', {})).status, 404);
    await request('/auth/forgot-password', 'POST', { email: userRow.email });
    const mail = (
      await db.query(
        "SELECT body FROM financy_mail WHERE user_id=$1 AND subject LIKE 'Restablece%'",
        [u],
      )
    ).rows[0];
    const token = new URL(mail.body.match(/http\S+/)[0]).searchParams.get('token');
    assert.equal(
      (await request('/auth/reset-password', 'POST', { token, password: 'newpassword123' })).status,
      201,
    );
    assert.equal((await request('/auth/me')).status, 401);
    assert.equal(
      (await request('/auth/reset-password', 'POST', { token, password: 'otherpassword123' }))
        .status,
      403,
    );
    const registered = await request('/auth/register', 'POST', {
      name: 'Nueva cuenta',
      email: 'registration@test.com',
      password: 'StrongPassword123',
    });
    assert.equal(registered.status, 201);
    cookie = registered.headers.get('set-cookie')!.split(';')[0];
    const account = await registered.json();
    assert.deepEqual(await f.balances(db, account.id), { box: '0.00', savings: '0.00' });
    const verification = (
      await db.query('SELECT body FROM financy_mail WHERE user_id=$1', [account.id])
    ).rows[0];
    const verifyToken = new URL(verification.body.match(/http\S+/)[0]).searchParams.get('token');
    assert.equal((await request('/auth/verify-email', 'POST', { token: verifyToken })).status, 201);
    assert.ok((await (await request('/auth/me')).json()).email_verified_at);
    assert.equal(
      (await request('/auth/profile', 'DELETE', { password: 'StrongPassword123' })).status,
      200,
    );
    assert.equal((await request('/auth/me')).status, 401);
    assert.equal(
      (await db.query('SELECT * FROM boxes WHERE "user"=$1', [account.id])).rows.length,
      0,
    );
  } finally {
    await app.getHttpServer().close();
  }
});
