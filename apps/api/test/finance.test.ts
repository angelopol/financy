import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { hash } from 'bcryptjs';
import { TestDatabase } from './test-db';
import { FinanceService } from '../src/finance';
import { PlanningService } from '../src/planning';
import { RatesService } from '../src/rates';
import { JobsService } from '../src/jobs';
import { PushService } from '../src/push';
import { AuthService } from '../src/auth';
import { ActionsService } from '../src/ai/actions';
import { ActivityService } from '../src/activity';
import { GeminiService, MAX_CONTEXT_BYTES } from '../src/ai/gemini';
import { FinancialContextService } from '../src/ai/financial-context';
import { dueAt, now, words } from '../src/domain';
import { csvCell } from '../src/controllers';
import { createApp } from '../src/app';
const db = new TestDatabase(),
  rates = new RatesService();
rates.get = async () =>
  ({ bcv: 36, parallel: 40, euro: 44, euro_parallel: 48, source: 'test' }) as any;
const f = new FinanceService(db, rates),
  p = new PlanningService(f),
  auth = new AuthService(db),
  activity = new ActivityService(db, f, p, auth),
  actions = new ActionsService(db, f, p, activity, auth),
  financialContext = new FinancialContextService(db, rates, f),
  push = new PushService(db);
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
  // Expenses auto-select the lower-balance account (box, 40 < 100) first; once
  // that's drained, the remainder comes from savings. The recorded `provider`
  // still ends up 'savings' since it contributed the larger share.
  const e = await f.save(u, 'expenses', entry('120', { provider: 'auto' }));
  assert.equal(e.provider, 'savings');
  assert.deepEqual(await f.balances(db, u), { box: '0.00', savings: '20.00' });
  await f.remove(u, 'expenses', e.id);
  assert.deepEqual(await f.balances(db, u), { box: '40.00', savings: '100.00' });
});
test('auto account selection favors the higher balance for income and the lower balance for expenses', async () => {
  const u = await user(30, 100);
  const income = await f.save(u, 'earnings', entry('10', { provider: 'auto' }));
  assert.equal(income.provider, 'savings');
  assert.deepEqual(await f.balances(db, u), { box: '30.00', savings: '110.00' });
  const expense = await f.save(u, 'expenses', entry('10', { provider: 'auto' }));
  assert.equal(expense.provider, 'box');
  assert.deepEqual(await f.balances(db, u), { box: '20.00', savings: '110.00' });
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
test('resync re-anchors an overdue recurrence to today without booking money', async () => {
  const u = await user();
  const e = await f.save(u, 'earnings', entry('20', { recurrence_type: 'days', term: 15 }));
  await assert.rejects(f.resync(u, 'earnings', e.id)); // not due yet, nothing to fix
  await db.query('UPDATE earnings SET "UpdatedTerm"=$1 WHERE id=$2', [
    now().minus({ days: 40 }).toFormat('yyyy-MM-dd HH:mm:ss'),
    e.id,
  ]);
  const before = await f.balances(db, u);
  const result = await f.resync(u, 'earnings', e.id);
  assert.equal(result.ok, true);
  assert.deepEqual(await f.balances(db, u), before);
  assert.equal((await f.list(u, 'earnings', { mode: 'history' })).total, 0);
  const refreshed = (await f.list(u, 'earnings', {})).items[0];
  assert.ok(dueAt(refreshed)! > now());
  const oneOff = await f.save(u, 'earnings', entry('5'));
  await assert.rejects(f.resync(u, 'earnings', oneOff.id));
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
  const jobs = new JobsService(db, f, push);
  await jobs.run();
  await jobs.run();
  assert.equal((await f.balances(db, u)).box, '15.00');
  assert.equal((await db.query('SELECT * FROM financy_mail WHERE user_id=$1', [u])).rows.length, 1);
});
test('cron sends a push reminder for expenses too, and only once per due date', async () => {
  const u = await user(100);
  await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [u]);
  const e = await f.save(u, 'expenses', entry('12', { recurrence_type: 'days', term: 1 }));
  await db.query('UPDATE expenses SET "UpdatedTerm"=$1 WHERE id=$2', [
    now().toFormat('yyyy-MM-dd HH:mm:ss'),
    e.id,
  ]);
  const sends: any[] = [];
  const testPush = new PushService(db);
  testPush.send = (async (user: string, payload: any) => {
    sends.push({ user, payload });
  }) as any;
  const jobs = new JobsService(db, f, testPush);
  await jobs.run();
  await jobs.run();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].user, u);
  assert.match(sends[0].payload.title, /Gasto/);
});
test('notifications() surfaces recurring items due within a week and the spending-limit status', async () => {
  const u = await user(200);
  await db.query('UPDATE users SET monthly_expense_limit=100 WHERE id=$1', [u]);
  const soon = await f.save(u, 'earnings', entry('50', { recurrence_type: 'days', term: 3 }));
  const far = await f.save(u, 'expenses', entry('10', { recurrence_type: 'days', term: 60 }));
  await f.save(u, 'expenses', entry('120'));
  const result = await f.notifications(u);
  assert.ok(result.items.some((i: any) => i.id === soon.id && i.type === 'earnings'));
  assert.ok(!result.items.some((i: any) => i.id === far.id));
  assert.equal(result.budget!.level, 'exceeded');
  assert.equal(result.budget!.spent, '120.00');
});
test('notifications() has no budget block when no limit is set', async () => {
  const u = await user();
  assert.equal((await f.notifications(u)).budget, null);
});
test('push subscriptions can be saved, deduplicated by endpoint and removed', async () => {
  const u = await user(),
    other = await user();
  const sub = { endpoint: 'https://push.test/a', keys: { p256dh: 'p1', auth: 'a1' } };
  await push.subscribe(u, sub);
  assert.equal(await push.isSubscribed(u), true);
  assert.equal(await push.isSubscribed(other), false);
  // Re-subscribing the same endpoint under another user reassigns it rather than duplicating it.
  await push.subscribe(other, sub);
  assert.equal(await push.isSubscribed(u), false);
  assert.equal(await push.isSubscribed(other), true);
  await push.unsubscribe(other, sub.endpoint);
  assert.equal(await push.isSubscribed(other), false);
  await assert.doesNotReject(push.send(other, { title: 'x', body: 'y' }));
});
test('sendTest reports whether the push actually reached a subscription', async () => {
  const u = await user();
  await assert.rejects(push.sendTest(u)); // VAPID keys unset in tests: reported as not configured
  process.env.VAPID_PUBLIC_KEY =
    'BNPvH76WFxuS3zpqLx0CNAQ_gQdWm0FhMJUmqzZvHTFe7usdvgdxsBwzSkwRz24i5G7-HSEQF6fVzBRy7SXz5X0';
  process.env.VAPID_PRIVATE_KEY = 'fFauSE0uvIgOGE3XRFeTTy27WEqknspomJl29S0NMi0';
  try {
    await assert.rejects(push.sendTest(u)); // configured, but no subscription on this device
    await push.subscribe(u, {
      endpoint: 'https://push.test/sendtest',
      keys: { p256dh: 'p', auth: 'a' },
    });
    const webpush = (await import('web-push')).default;
    const original = webpush.sendNotification;
    webpush.sendNotification = (async () => {}) as any;
    try {
      const result = await push.sendTest(u);
      assert.equal(result.ok, true);
      assert.equal(result.sent, 1);
    } finally {
      webpush.sendNotification = original;
    }
    // A dead subscription (410 Gone) is pruned instead of reported as success.
    webpush.sendNotification = (async () => {
      throw Object.assign(new Error('Gone'), { statusCode: 410 });
    }) as any;
    try {
      await assert.rejects(push.sendTest(u));
      assert.equal(await push.isSubscribed(u), false);
    } finally {
      webpush.sendNotification = original;
    }
  } finally {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  }
});
test('the notifications endpoints list items, expose push status and manage subscriptions over HTTP', async () => {
  process.env.APP_URL = 'http://localhost:5173';
  const u = await user(100);
  const userRow = (await db.query('SELECT email FROM users WHERE id=$1', [u])).rows[0];
  await f.save(u, 'expenses', entry('20', { recurrence_type: 'days', term: 2 }));
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
    const login = await request('/auth/login', 'POST', {
      email: userRow.email,
      password: 'password1234',
    });
    cookie = login.headers.get('set-cookie')!.split(';')[0];
    const before = await (await request('/notifications')).json();
    assert.equal(before.push_enabled, false);
    assert.equal(before.items.length, 1);
    const sub = { endpoint: 'https://push.test/http-' + u, keys: { p256dh: 'p', auth: 'a' } };
    assert.equal((await request('/notifications/subscribe', 'POST', sub)).status, 201);
    const after = await (await request('/notifications')).json();
    assert.equal(after.push_enabled, true);
    assert.equal(
      (await request('/notifications/unsubscribe', 'POST', { endpoint: sub.endpoint })).status,
      201,
    );
    const disabled = await (await request('/notifications')).json();
    assert.equal(disabled.push_enabled, false);
  } finally {
    await app.getHttpServer().close();
  }
});
test('project scope always includes owner and does not touch personal accounts', async () => {
  const u = await user(),
    other = await user();
  const e = await f.save(u, 'earnings', entry('90', { project_id: 42 }));
  assert.equal((await f.list(other, 'earnings', { project_id: 42 })).total, 0);
  await assert.rejects(f.remove(other, 'earnings', e.id));
  assert.equal((await f.balances(db, u)).box, '0.00');
});
test('words() drops short filler words like Laravel\'s SlugNormalizer (>= 3 chars, deduped)', () => {
  assert.deepEqual(
    words('Compra de mercado en la panadería del barrio'),
    ['compra', 'mercado', 'panaderia', 'del', 'barrio'],
  );
  assert.deepEqual(words('la el de un'), []);
  assert.deepEqual(words('Pan pan PAN'), ['pan']);
});
test('creating an entry without an explicit slug auto-tags it from the description', async () => {
  const u = await user(100);
  const e = await f.save(u, 'expenses', entry('12', { slug: undefined, description: 'Mercado del barrio' }));
  assert.equal(e.slug, 'mercado del barrio');
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
test('AI can update the monthly limit and mark a purchase as bought, both undoable', async () => {
  const u = await user(100);
  const limitProposal = await actions.propose(u, 'actualizar_limite_mensual', {
    monthly_expense_limit: 500,
  });
  assert.ok('id' in limitProposal);
  await actions.confirm(u, limitProposal.id);
  assert.equal(await auth.currentMonthlyLimit(u), '500.00');
  const limitActivity = (
    await db.query(`SELECT * FROM financy_activity WHERE user_id=$1 AND kind='limit_updated'`, [u])
  ).rows[0];
  await activity.undo(u, limitActivity.id);
  assert.equal(await auth.currentMonthlyLimit(u), null);

  const item = await p.shopSave(u, { description: 'Auriculares', amount: '20' });
  const missingItem = await actions.propose(u, 'marcar_compra_comprada', {
    shop_list_item_id: '999999',
    amount: '20',
  });
  assert.ok('error' in missingItem);
  const purchaseProposal = await actions.propose(u, 'marcar_compra_comprada', {
    shop_list_item_id: item.id,
    amount: '20',
  });
  assert.ok('id' in purchaseProposal);
  assert.match(purchaseProposal.summary, /Auriculares/);
  await actions.confirm(u, purchaseProposal.id);
  assert.equal((await f.balances(db, u)).box, '80.00');
  assert.equal((await p.shopList(u, {})).items[0].status, 'purchased');
  const purchaseActivity = (await activity.list(u)).activity.find((a: any) => a.kind === 'shopping_purchased');
  assert.equal(purchaseActivity.can_undo, true);
  await activity.undo(u, purchaseActivity.id);
  assert.equal((await p.shopList(u, {})).items[0].status, 'pending');
  assert.equal((await f.balances(db, u)).box, '100.00');
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
    assert.equal(modelMessage.actions.length, 1);
    const [action] = modelMessage.actions;
    assert.equal(action.status, 'pending');
    assert.equal((await f.balances(db, uid)).box, '100.00');
    const unauthenticated = await fetch(base + '/api/ai/actions/' + action.id + '/confirm', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    });
    assert.equal(unauthenticated.status, 401);
    const confirmed = await request('/ai/actions/' + action.id + '/confirm', 'POST', {});
    assert.equal(confirmed.status, 201);
    assert.equal((await f.balances(db, uid)).box, '130.00');
    const again = await request('/ai/actions/' + action.id + '/confirm', 'POST', {});
    assert.equal(again.status, 409);
  } finally {
    await app.getHttpServer().close();
  }
});
test('chat proposes every operation described in one message, all in a single pending reply', async () => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.GEMINI_API_KEY = 'test-key';
  const uid = await user(100);
  const userRow = (await db.query('SELECT email FROM users WHERE id=$1', [uid])).rows[0];
  const app = await createApp(db);
  const gemini = app.get(GeminiService);
  let call = 0;
  gemini.generate = (async () => {
    call++;
    if (call === 1)
      return {
        role: 'model',
        parts: [
          { functionCall: { name: 'registrar_ingreso', args: { description: 'Freelance', amount: 30 } } },
          { functionCall: { name: 'registrar_gasto', args: { description: 'Mercado', amount: 15 } } },
          { functionCall: { name: 'actualizar_limite_mensual', args: { monthly_expense_limit: 500 } } },
        ],
      };
    return {
      role: 'model',
      parts: [{ text: 'Preparé las tres operaciones; confírmalas cuando quieras.' }],
    };
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
    const login = await request('/auth/login', 'POST', {
      email: userRow.email,
      password: 'password1234',
    });
    cookie = login.headers.get('set-cookie')!.split(';')[0];
    const sent = await request('/ai/messages', 'POST', {
      request_id: crypto.randomUUID(),
      message: 'Registra un ingreso de 30 por freelance, un gasto de 15 en mercado y sube mi límite mensual a 500',
    });
    assert.equal(sent.status, 201);
    const { messages } = await sent.json();
    const modelMessage = messages.find((m: any) => m.role === 'model');
    assert.equal(modelMessage.actions.length, 3);
    assert.deepEqual(
      modelMessage.actions.map((a: any) => a.kind).sort(),
      ['actualizar_limite_mensual', 'registrar_gasto', 'registrar_ingreso'],
    );
    assert.ok(modelMessage.actions.every((a: any) => a.status === 'pending'));
    for (const action of modelMessage.actions)
      assert.equal((await request('/ai/actions/' + action.id + '/confirm', 'POST', {})).status, 201);
    assert.equal((await f.balances(db, uid)).box, '115.00');
    assert.equal(await auth.currentMonthlyLimit(uid), '500.00');
    // Re-fetching history should still surface all three actions on that same message.
    const history = await (await request('/ai/messages')).json();
    const persisted = history.messages.find((m: any) => m.id === modelMessage.id);
    assert.equal(persisted.actions.length, 3);
    assert.ok(persisted.actions.every((a: any) => a.status === 'confirmed'));
  } finally {
    await app.getHttpServer().close();
  }
});
test('chat can call the currency calculator tool to convert an amount to USD', async () => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.GEMINI_API_KEY = 'test-key';
  const app = await createApp(db);
  const gemini = app.get(GeminiService);
  const finances = app.get(FinancialContextService);
  let calledWith: any = null;
  finances.convert = (async (args: any) => {
    calledWith = args;
    return { amount: args.amount, currency: args.currency, usd: '478.35', date: '2026-09-14' };
  }) as any;
  let call = 0;
  gemini.generate = (async () => {
    call++;
    if (call === 1)
      return {
        role: 'model',
        parts: [{ functionCall: { name: 'convertir_moneda', args: { amount: 543, currency: '€' } } }],
      };
    return { role: 'model', parts: [{ text: '543 euros a BCV son USD 478,35 al paralelo.' }] };
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
    const u = await user();
    const userRow = (await db.query('SELECT email FROM users WHERE id=$1', [u])).rows[0];
    const login = await request('/auth/login', 'POST', {
      email: userRow.email,
      password: 'password1234',
    });
    cookie = login.headers.get('set-cookie')!.split(';')[0];
    const sent = await request('/ai/messages', 'POST', {
      request_id: crypto.randomUUID(),
      message: 'Cuantos son 543 euros a BCV',
    });
    assert.equal(sent.status, 201);
    assert.deepEqual(calledWith, { amount: 543, currency: '€' });
    const { messages } = await sent.json();
    const modelMessage = messages.find((m: any) => m.role === 'model');
    assert.match(modelMessage.content, /478,35|478\.35/);
  } finally {
    await app.getHttpServer().close();
  }
});
test('chat answers "how much did I spend under $40" for a large history with one aggregate call, not by paginating', async () => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.GEMINI_API_KEY = 'test-key';
  const u = await user(10000);
  const userRow = (await db.query('SELECT email FROM users WHERE id=$1', [u])).rows[0];
  // A history large enough that listing rows with consultar_finanzas (30/page) would take
  // many calls; resumir_finanzas should answer it in one, from real seeded data (not mocked).
  for (let i = 0; i < 60; i++) await f.save(u, 'expenses', entry(String(10 + (i % 5) * 10)));
  const app = await createApp(db);
  const gemini = app.get(GeminiService);
  let call = 0;
  gemini.generate = (async () => {
    call++;
    if (call === 1)
      return {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'resumir_finanzas',
              args: { resource: 'expenses', amount_max: 39.99 },
            },
          },
        ],
      };
    return { role: 'model', parts: [{ text: 'Gastaste 720,00 $ en movimientos menores a 40 $.' }] };
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
    const login = await request('/auth/login', 'POST', {
      email: userRow.email,
      password: 'password1234',
    });
    cookie = login.headers.get('set-cookie')!.split(';')[0];
    const sent = await request('/ai/messages', 'POST', {
      request_id: crypto.randomUUID(),
      message: 'Cuanto gasté en movimientos menores a 40 dólares este año',
    });
    assert.equal(sent.status, 201);
    assert.equal(call, 2); // one tool round, then the final answer: no pagination loop
    const { messages } = await sent.json();
    const modelMessage = messages.find((m: any) => m.role === 'model');
    assert.match(modelMessage.content, /720,00|720\.00/);
  } finally {
    await app.getHttpServer().close();
  }
});
test('chat degrades to a text answer instead of exceeding Gemini\'s request cap when tool results are heavy', async () => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.GEMINI_API_KEY = 'test-key';
  const app = await createApp(db);
  const gemini = app.get(GeminiService);
  const finances = app.get(FinancialContextService);
  const heavyRow = { id: 1, description: 'x'.repeat(2000), amount: '10.00' };
  finances.query = (async () => ({
    resource: 'earnings',
    rows: Array.from({ length: 30 }, () => heavyRow),
  })) as any;
  let biggestRequestBytes = 0;
  gemini.generate = (async (system: string, contents: unknown, _signal: unknown, tools?: unknown[]) => {
    const bytes = Buffer.byteLength(system) + Buffer.byteLength(JSON.stringify(contents));
    biggestRequestBytes = Math.max(biggestRequestBytes, bytes);
    assert.ok(bytes < MAX_CONTEXT_BYTES, `request body ${bytes} exceeded MAX_CONTEXT_BYTES`);
    if (tools && tools.length)
      return { role: 'model', parts: [{ functionCall: { name: 'consultar_finanzas', args: { resource: 'earnings' } } }] };
    return { role: 'model', parts: [{ text: 'Esto es lo que pude revisar con la información disponible.' }] };
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
      name: 'Heavy Context User',
      email: `heavy${sequence++}@test.com`,
      password: 'password1234',
    });
    cookie = registered.headers.get('set-cookie')!.split(';')[0];
    const sent = await request('/ai/messages', 'POST', {
      request_id: crypto.randomUUID(),
      message: 'Revisa todo mi historial de ingresos con el mayor detalle posible',
    });
    assert.equal(sent.status, 201);
    const { messages } = await sent.json();
    const modelMessage = messages.find((m: any) => m.role === 'model');
    assert.equal(modelMessage.content, 'Esto es lo que pude revisar con la información disponible.');
    assert.ok(biggestRequestBytes > MAX_CONTEXT_BYTES - 40_000 - 5_000);
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
  assert.equal(await rates.convert('EUR_PARALLEL', '36'), '43.20');
  // '$parallel' (duplicated 'bs'), 'VES_BCV' and 'EUR' (which broke the "always
  // ends up USD at the parallel rate" rule) were dropped from the currency
  // picker, but old recurring entries already saved with those codes still
  // need to convert on every dashboard/projection read, so their original
  // formulas stay supported even though nothing can write them anymore.
  assert.equal(await rates.convert('$parallel', '400'), '10.00');
  assert.equal(await rates.convert('VES_BCV', '360'), '10.00');
  assert.equal(await rates.convert('EUR', '36'), '44.00');
  const broken = new RatesService();
  broken.get = async () => ({}) as any;
  await assert.rejects(broken.convert('bs', '5'));
  assert.equal(await broken.convert('$', '5'), '5.00');
});
test('financial context calculator tool converts using the same rates as the app conversor', async () => {
  const usd = await financialContext.convert({ amount: 543, currency: '€' });
  assert.equal(usd.result, '597.30');
  assert.equal(usd.unit, 'USD');
  assert.equal(usd.currency, '€');
  await assert.rejects(financialContext.convert({ amount: 543, currency: 'not-a-currency' }));
});
test('the calculator can target bolívares directly, without chaining through USD', async () => {
  // Same math as convert() then multiplying by the parallel rate, but in one
  // rounding step: this is what lets the AI answer "en bolívares" in a single call.
  assert.equal(await rates.toBs('bs', '250'), '250.00');
  assert.equal(await rates.toBs('$', '10'), '400.00');
  assert.equal(await rates.toBs('$bcv', '10'), '360.00');
  assert.equal(await rates.toBs('€', '543'), '23892.00');
  assert.equal(await rates.toBs('EUR_PARALLEL', '100'), '4800.00');
  await assert.rejects(rates.toBs('not-a-currency', '10'));
  const bs = await financialContext.convert({ amount: 543, currency: '€', target: 'bs' });
  assert.equal(bs.result, '23892.00');
  assert.equal(bs.unit, 'Bs');
  assert.equal(bs.target, 'bs');
});
test('resumir_finanzas sums, counts and averages a filter without fetching every row', async () => {
  const u = await user(1000);
  for (const amount of ['10', '15', '25', '55', '90']) await f.save(u, 'expenses', entry(amount));
  const under40 = await financialContext.aggregate(u, { resource: 'expenses', amount_max: 39.99 });
  assert.equal(under40.total_count, 3);
  assert.equal(under40.by_currency.length, 1);
  assert.equal(under40.by_currency[0].currency, '$');
  assert.equal(under40.by_currency[0].sum, '50.00');
  const all = await financialContext.aggregate(u, { resource: 'expenses' });
  assert.equal(all.total_count, 5);
  assert.equal(all.by_currency[0].sum, '195.00');
  assert.equal(all.by_currency[0].avg, '39.00');
  assert.equal(all.by_currency[0].min, '10.00');
  assert.equal(all.by_currency[0].max, '90.00');
  const none = await financialContext.aggregate(u, { resource: 'expenses', amount_min: 1000 });
  assert.equal(none.total_count, 0);
  assert.equal(none.by_currency.length, 0);
});
test('resumir_finanzas flags mixed-currency earnings instead of summing them together, and rejects amounts on allocations', async () => {
  const u = await user(100);
  await f.save(u, 'earnings', entry('400', { currency: 'bs', recurrence_type: 'days', term: 15 }));
  await f.save(u, 'earnings', entry('50'));
  const mixed = await financialContext.aggregate(u, { resource: 'earnings' });
  assert.equal(mixed.total_count, 2);
  assert.equal(mixed.by_currency.length, 2);
  assert.match(mixed.notes, /conviértelos con convertir_moneda/);
  const noAmount = await financialContext.aggregate(u, { resource: 'allocations' });
  assert.ok('error' in noAmount);
});
test('list() supports amount_min/amount_max, used by both the Reports page and generar_reporte', async () => {
  const u = await user(1000);
  for (const amount of ['12', '38', '70']) await f.save(u, 'expenses', entry(amount));
  const under40 = await f.list(u, 'expenses', { amount_max: '39.99' });
  assert.equal(under40.total, 2);
  assert.equal(under40.totalAmount, '50.00');
  const over40 = await f.list(u, 'expenses', { amount_min: '40' });
  assert.equal(over40.total, 1);
  assert.equal(over40.totalAmount, '70.00');
});
test('generar_reporte reuses the exact Reports-page generator and points to a matching report_url', async () => {
  const u = await user(1000);
  await f.save(u, 'expenses', entry('12', { provider: 'box' }));
  await f.save(u, 'expenses', entry('38', { provider: 'box' }));
  await f.save(u, 'expenses', entry('70', { provider: 'box' }));
  const report = await financialContext.report(u, {
    kind: 'expenses',
    amount_max: 39.99,
    provider: 'box',
  });
  assert.equal(report.total, 2);
  assert.equal(report.totalAmount, '50.00');
  assert.equal(report.items.length, 2);
  assert.equal(report.kind, 'expenses');
  assert.match(report.report_url, /^\/reports\?kind=expenses&/);
  assert.match(report.report_url, /provider=box/);
  await assert.rejects(financialContext.report(u, { kind: 'not-a-kind' }));
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
