'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore, makeStore, NOON, plain } = require('./_load');

const core = loadCore();
const B = core.bills;
const S = core.safeToSpend;
const TODAY = '2026-10-14';

function bill(over) {
  return Object.assign({
    id: 'b', name: 'Bill', amountCents: 10000, cadence: 'monthly', everyN: null, setAside: false,
    dueDate: '2026-10-20', anchorDay: 20, paid: false, debtId: null,
  }, over);
}

function state(over) {
  return Object.assign(core.schema.createEmptyState(), over);
}

/* ---------- bills ---------- */

test('nextAfter follows each cadence', () => {
  assert.equal(B.nextAfter(bill({ cadence: 'weekly' }), '2026-10-20'), '2026-10-27');
  assert.equal(B.nextAfter(bill({ cadence: 'biweekly' }), '2026-10-20'), '2026-11-03');
  assert.equal(B.nextAfter(bill({ cadence: 'monthly', anchorDay: 31 }), '2026-01-31'), '2026-02-28');
  assert.equal(B.nextAfter(bill({ cadence: 'every_n_months', everyN: 6 }), '2026-10-20'), '2027-04-20');
  assert.equal(B.nextAfter(bill({ cadence: 'one_off' }), '2026-10-20'), null);
});

test('rollForward moves a paid cycle on only once its date has passed', () => {
  const paidFuture = bill({ paid: true, dueDate: '2026-10-20' });
  assert.equal(B.rollForward(paidFuture, TODAY), paidFuture);
  const paidPast = bill({ paid: true, dueDate: '2026-10-01', anchorDay: 1 });
  const rolled = B.rollForward(paidPast, TODAY);
  assert.equal(rolled.dueDate, '2026-11-01');
  assert.equal(rolled.paid, false);
  assert.equal(paidPast.dueDate, '2026-10-01', 'does not mutate input');
});

test('rollForward never skips unpaid cycles or reopens one-offs', () => {
  const unpaidPast = bill({ dueDate: '2026-09-01' });
  assert.equal(B.rollForward(unpaidPast, TODAY), unpaidPast);
  const oneOff = bill({ cadence: 'one_off', paid: true, dueDate: '2026-09-01' });
  assert.equal(B.rollForward(oneOff, TODAY), oneOff);
  // Paid two cycles ago: rolls ONE cycle, which is then (correctly) overdue.
  const old = B.rollForward(bill({ paid: true, dueDate: '2026-08-20' }), TODAY);
  assert.equal(old.dueDate, '2026-09-20');
  assert.equal(old.paid, false);
});

test('occurrencesBefore lists every unpaid occurrence in the window', () => {
  const weekly = bill({ cadence: 'weekly', dueDate: '2026-10-15' });
  const occ = B.occurrencesBefore(weekly, '2026-10-30', TODAY);
  assert.deepEqual(plain(occ.map((o) => o.date)), ['2026-10-15', '2026-10-22', '2026-10-29']);
  assert.equal(occ[0].isCurrent, true);
  assert.equal(occ[1].isCurrent, false);
});

test('occurrencesBefore: end date is exclusive; paid current cycle is skipped', () => {
  assert.equal(B.occurrencesBefore(bill({ dueDate: '2026-10-24' }), '2026-10-24', TODAY).length, 0);
  const paidWeekly = bill({ cadence: 'weekly', dueDate: '2026-10-15', paid: true });
  assert.deepEqual(plain(B.occurrencesBefore(paidWeekly, '2026-10-30', TODAY).map((o) => o.date)), ['2026-10-22', '2026-10-29']);
});

test('occurrencesBefore flags overdue bills and still counts them', () => {
  const occ = B.occurrencesBefore(bill({ dueDate: '2026-10-01', anchorDay: 1 }), '2026-10-24', TODAY);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].overdue, true);
});

test('setAsideAccrued accrues evenly toward the due date', () => {
  const car = bill({ cadence: 'every_n_months', everyN: 6, setAside: true, amountCents: 60000, dueDate: '2027-01-14', anchorDay: 14 });
  // cycle 2026-07-14 .. 2027-01-14 = 184 days; elapsed to 2026-10-14 = 92 days -> half.
  assert.equal(B.setAsideAccrued(car, TODAY), 30000);
  assert.equal(B.setAsideAccrued(car, '2027-01-14'), 60000);
  assert.equal(B.setAsideAccrued(car, '2026-01-01'), 0);
  assert.equal(B.setAsideAccrued(Object.assign({}, car, { setAside: false }), TODAY), 0);
  assert.equal(B.setAsideAccrued(Object.assign({}, car, { paid: true }), TODAY), 0);
});

test('monthlyEquivalent', () => {
  assert.equal(B.monthlyEquivalent(bill({ cadence: 'weekly', amountCents: 1200 })), 5200);
  assert.equal(B.monthlyEquivalent(bill({ cadence: 'biweekly', amountCents: 1200 })), 2600);
  assert.equal(B.monthlyEquivalent(bill({ cadence: 'every_n_months', everyN: 3, amountCents: 30000 })), 10000);
  assert.equal(B.monthlyEquivalent(bill({ cadence: 'one_off' })), 0);
});

/* ---------- payday window ---------- */

test('effectivePayday: unset -> 30-day window', () => {
  const p = S.effectivePayday({ next: null, cadence: 'biweekly' }, TODAY);
  assert.equal(p.source, 'default');
  assert.equal(p.date, '2026-11-13');
});

test('effectivePayday: today or past rolls to the following payday', () => {
  assert.equal(S.effectivePayday({ next: TODAY, cadence: 'biweekly' }, TODAY).date, '2026-10-28');
  assert.equal(S.effectivePayday({ next: '2026-09-30', cadence: 'biweekly' }, TODAY).date, '2026-10-28');
  assert.equal(S.effectivePayday({ next: '2026-08-31', cadence: 'monthly' }, TODAY).date, '2026-10-31');
  assert.equal(S.effectivePayday({ next: '2026-10-10', cadence: 'weekly' }, TODAY).date, '2026-10-17');
});

test('effectivePayday: a passed irregular payday is flagged stale', () => {
  const p = S.effectivePayday({ next: '2026-10-01', cadence: 'irregular' }, TODAY);
  assert.equal(p.stale, true);
  assert.equal(p.source, 'default');
});

/* ---------- the number ---------- */

test('compute: balance minus bills before payday minus set-aside minus savings', () => {
  const s = state({
    balance: { cents: 250000, updatedOn: TODAY },
    payday: { next: '2026-10-24', cadence: 'biweekly' },
    bills: [
      bill({ id: 'rent', name: 'Rent', amountCents: 120000, dueDate: '2026-10-20' }),
      bill({ id: 'phone', name: 'Phone', amountCents: 5000, dueDate: '2026-10-28', anchorDay: 28 }), // after payday
      bill({ id: 'gym', name: 'Gym', amountCents: 1500, cadence: 'weekly', dueDate: '2026-10-16' }),  // 16th + 23rd
      bill({ id: 'car', name: 'Car insurance', amountCents: 60000, cadence: 'every_n_months', everyN: 6, setAside: true, dueDate: '2027-01-14', anchorDay: 14 }),
    ],
    goals: [{ id: 'g', name: 'Trip', kind: 'goal', targetCents: 100000, savedCents: 20000 }],
  });
  const r = S.compute(s, TODAY);
  assert.equal(r.billsDueCents, 120000 + 1500 * 2);
  assert.equal(r.setAsideCents, 30000);
  assert.equal(r.savingsCents, 20000);
  assert.equal(r.safeCents, 250000 - 123000 - 30000 - 20000);
  assert.equal(r.daysLeft, 10);
  assert.equal(r.perDayCents, Math.floor(77000 / 10));
  assert.deepEqual(plain(r.dueItems.map((i) => i.bill.id)), ['gym', 'rent', 'gym']);
});

test('compute: a set-aside bill due inside the window counts in full, not twice', () => {
  const s = state({
    balance: { cents: 100000, updatedOn: TODAY },
    payday: { next: '2026-10-24', cadence: 'biweekly' },
    bills: [bill({ cadence: 'every_n_months', everyN: 3, setAside: true, amountCents: 30000, dueDate: '2026-10-20' })],
  });
  const r = S.compute(s, TODAY);
  assert.equal(r.billsDueCents, 30000);
  assert.equal(r.setAsideCents, 0);
});

test('compute: paid cycles in the past roll forward before counting', () => {
  const s = state({
    balance: { cents: 100000, updatedOn: TODAY },
    payday: { next: '2026-11-05', cadence: 'monthly' },
    bills: [bill({ amountCents: 40000, dueDate: '2026-10-01', anchorDay: 1, paid: true })],
  });
  const r = S.compute(s, TODAY);
  assert.equal(r.billsDueCents, 40000); // the Nov 1 cycle
  assert.equal(r.dueItems[0].date, '2026-11-01');
});

test('compute: can go negative and never reports a per-day allowance then', () => {
  const s = state({
    balance: { cents: 10000, updatedOn: TODAY },
    payday: { next: '2026-10-24', cadence: 'biweekly' },
    bills: [bill({ amountCents: 50000 })],
  });
  const r = S.compute(s, TODAY);
  assert.equal(r.safeCents, -40000);
  assert.equal(r.perDayCents, 0);
});

test('compute: no balance yet is reported, not treated as $0 silently', () => {
  const r = S.compute(state({}), TODAY);
  assert.equal(r.hasBalance, false);
});

/* ---------- debt ---------- */

const debts = [
  { id: 'a', name: 'Card A', balanceCents: 500000, aprBps: 2499, minPaymentCents: 15000 },
  { id: 'b', name: 'Card B', balanceCents: 80000, aprBps: 1899, minPaymentCents: 3500 },
  { id: 'c', name: 'Loan', balanceCents: 300000, aprBps: 2499, minPaymentCents: 9000 },
  { id: 'd', name: 'Paid off', balanceCents: 0, aprBps: 3000, minPaymentCents: 2000 },
];

test('payoffOrder: snowball = smallest balance first, paid-off last', () => {
  assert.deepEqual(plain(core.debt.payoffOrder(debts, 'snowball').map((d) => d.id)), ['b', 'c', 'a', 'd']);
});

test('payoffOrder: avalanche = highest rate first, ties by smaller balance', () => {
  assert.deepEqual(plain(core.debt.payoffOrder(debts, 'avalanche').map((d) => d.id)), ['c', 'a', 'b', 'd']);
});

test('payoffOrder does not mutate its input', () => {
  const copy = debts.slice();
  core.debt.payoffOrder(debts, 'avalanche');
  assert.deepEqual(debts, copy);
});

test('debt totals ignore minimums on paid-off debts', () => {
  assert.deepEqual(plain(core.debt.totals(debts)), { balanceCents: 880000, minPaymentCents: 27500 });
});

test('APR parsing', () => {
  assert.equal(core.debt.parseApr('19.99'), 1999);
  assert.equal(core.debt.parseApr('19.99%'), 1999);
  assert.equal(core.debt.parseApr(''), 0);
  assert.equal(core.debt.parseApr('abc'), null);
  assert.equal(core.debt.parseApr('500'), null);
  assert.equal(core.debt.formatApr(1999), '19.99%');
  assert.equal(core.debt.formatApr(2000), '20%');
});

/* ---------- wait list ---------- */

test('wait list countdown', () => {
  const W = core.waitlist;
  const item = { addedAt: NOON };
  assert.equal(W.remainingMs(item, NOON), W.WAIT_MS);
  assert.equal(W.remainingMs(item, NOON + W.WAIT_MS + 1), 0);
  assert.equal(W.formatRemaining(W.WAIT_MS), '48h 00m');
  assert.equal(W.formatRemaining(90 * 60000), '1h 30m');
  assert.equal(W.formatRemaining(30000), 'under a minute');
  assert.equal(W.formatRemaining(0), 'Ready');
});

/* ---------- actions through the store ---------- */

test('setBalance accepts negative balances and records the date', () => {
  const store = makeStore(core);
  store.dispatch('setBalance', { amount: '-45.50' });
  assert.equal(store.getState().balance.cents, -4550);
  assert.equal(store.getState().balance.updatedOn, TODAY);
});

test('rejected input leaves state untouched', () => {
  const store = makeStore(core);
  const before = JSON.stringify(store.getState());
  assert.throws(() => store.dispatch('addBill', { name: '', amount: '10', dueDate: TODAY, cadence: 'monthly' }),
    (e) => e.name === 'ValidationError' && e.field === 'name');
  assert.throws(() => store.dispatch('addBill', { name: 'X', amount: '10.999', dueDate: TODAY, cadence: 'monthly' }),
    (e) => e.field === 'amount');
  assert.throws(() => store.dispatch('addBill', { name: 'X', amount: '10', dueDate: '2026-02-30', cadence: 'monthly' }),
    (e) => e.field === 'dueDate');
  assert.throws(() => store.dispatch('addBill', { name: 'X', amount: '10', dueDate: TODAY, cadence: 'every_n_months', everyN: '1' }),
    (e) => e.field === 'everyN');
  assert.equal(JSON.stringify(store.getState()), before);
});

test('quick log: spend and income adjust the balance; deleting reverses it', () => {
  const store = makeStore(core);
  assert.throws(() => store.dispatch('logActivity', { kind: 'spend', amount: '5' }), /balance first/);
  store.dispatch('setBalance', { amount: '100' });
  const spend = store.dispatch('logActivity', { kind: 'spend', amount: '12.50', label: 'Lunch' });
  store.dispatch('logActivity', { kind: 'income', amount: '40' });
  assert.equal(store.getState().balance.cents, 10000 - 1250 + 4000);
  assert.equal(store.getState().activity[0].label, 'Income');
  store.dispatch('deleteActivity', { id: spend.id });
  assert.equal(store.getState().balance.cents, 14000);
});

test('marking a bill paid lowers the balance; unmarking restores it', () => {
  const store = makeStore(core);
  store.dispatch('setBalance', { amount: '2000' });
  const rent = store.dispatch('addBill', { name: 'Rent', amount: '1200', dueDate: '2026-11-01', cadence: 'monthly' });
  store.dispatch('setBillPaid', { id: rent.id, paid: true });
  assert.equal(store.getState().balance.cents, 80000);
  assert.equal(store.getState().activity[0].kind, 'bill_paid');
  store.dispatch('setBillPaid', { id: rent.id, paid: true }); // idempotent
  assert.equal(store.getState().balance.cents, 80000);
  store.dispatch('setBillPaid', { id: rent.id, paid: false });
  assert.equal(store.getState().balance.cents, 200000);
  assert.equal(store.getState().activity.length, 0);
  assert.throws(() => store.dispatch('deleteActivity', { id: 'nope' }));
});

test('toggling a bill whose paid cycle has passed acts on its current cycle', () => {
  const store = makeStore(core);
  store.dispatch('setBalance', { amount: '100' });
  const b = store.dispatch('addBill', { name: 'Gym', amount: '10', dueDate: '2026-10-10', cadence: 'weekly' });
  store.dispatch('setBillPaid', { id: b.id, paid: true });   // overdue cycle paid
  assert.equal(store.getState().balance.cents, 9000);
  // Displayed now: the Oct 17 cycle, unpaid. Paying it must not be a no-op.
  store.dispatch('setBillPaid', { id: b.id, paid: true });
  assert.equal(store.getState().bills[0].dueDate, '2026-10-17');
  assert.equal(store.getState().bills[0].paid, true);
  assert.equal(store.getState().balance.cents, 8000);
});

test('the first validation error matches the first empty field', () => {
  const store = makeStore(core);
  assert.throws(() => store.dispatch('addBill', { cadence: 'monthly' }), (e) => e.field === 'name');
  assert.throws(() => store.dispatch('addDebt', {}), (e) => e.field === 'name');
});

test('editing a bill schedule resets its paid state; renaming does not', () => {
  const store = makeStore(core);
  const b = store.dispatch('addBill', { name: 'Gym', amount: '15', dueDate: '2026-10-20', cadence: 'weekly' });
  store.dispatch('setBillPaid', { id: b.id, paid: true });
  store.dispatch('updateBill', { id: b.id, name: 'Gym membership', amount: '15', dueDate: '2026-10-20', cadence: 'weekly' });
  assert.equal(store.getState().bills[0].paid, true);
  store.dispatch('updateBill', { id: b.id, name: 'Gym membership', amount: '15', dueDate: '2026-10-21', cadence: 'weekly' });
  assert.equal(store.getState().bills[0].paid, false);
});

test('demo limit caps bills, including debt payment bills', () => {
  const store = makeStore(core, { limits: { maxBills: 1 } });
  store.dispatch('addBill', { name: 'Rent', amount: '1', dueDate: TODAY, cadence: 'monthly' });
  assert.throws(() => store.dispatch('addBill', { name: 'Two', amount: '1', dueDate: TODAY, cadence: 'monthly' }), (e) => e.field === 'limit');
  const d = store.dispatch('addDebt', { name: 'Card', balance: '100', minPayment: '25' });
  assert.throws(() => store.dispatch('addDebtPaymentBill', { id: d.id, dueDate: TODAY }), (e) => e.field === 'limit');
});

test('debt payment bill: created once, renamed with the debt, unlinked on delete', () => {
  const store = makeStore(core);
  const d = store.dispatch('addDebt', { name: 'Visa', balance: '1500', apr: '22.9', minPayment: '45' });
  store.dispatch('addDebtPaymentBill', { id: d.id, dueDate: '2026-10-28' });
  assert.throws(() => store.dispatch('addDebtPaymentBill', { id: d.id, dueDate: '2026-10-28' }), /already/);
  assert.equal(store.getState().bills[0].amountCents, 4500);
  store.dispatch('updateDebt', { id: d.id, name: 'Visa card', balance: '1400', apr: '22.9', minPayment: '50' });
  assert.equal(store.getState().bills[0].name, 'Visa card payment');
  assert.equal(store.getState().bills[0].amountCents, 5000);
  store.dispatch('deleteDebt', { id: d.id });
  assert.equal(store.getState().bills.length, 1);
  assert.equal(store.getState().bills[0].debtId, null);
});

test('debt without a minimum payment cannot be added to bills', () => {
  const store = makeStore(core);
  const d = store.dispatch('addDebt', { name: 'Family loan', balance: '300' });
  assert.throws(() => store.dispatch('addDebtPaymentBill', { id: d.id, dueDate: TODAY }), (e) => e.field === 'minPayment');
});

test('goals: savings goal needs a target; money in/out with no overdraw', () => {
  const store = makeStore(core);
  assert.throws(() => store.dispatch('addGoal', { name: 'Trip', kind: 'goal' }), (e) => e.field === 'target');
  const env = store.dispatch('addGoal', { name: 'Groceries', kind: 'envelope' });
  store.dispatch('moveGoalMoney', { id: env.id, amount: '50', direction: 'in' });
  assert.throws(() => store.dispatch('moveGoalMoney', { id: env.id, amount: '60', direction: 'out' }), (e) => e.field === 'amount');
  store.dispatch('moveGoalMoney', { id: env.id, amount: '20', direction: 'out' });
  assert.equal(store.getState().goals[0].savedCents, 3000);
});

test('wait list: cannot buy before 48h, can skip anytime, buying logs a spend', () => {
  const store = makeStore(core);
  store.dispatch('setBalance', { amount: '500' });
  const item = store.dispatch('addWait', { name: 'Headphones', price: '129' });
  assert.throws(() => store.dispatch('resolveWait', { id: item.id, outcome: 'bought' }), /48 hours/);
  store.setNow(NOON + core.waitlist.WAIT_MS);
  store.dispatch('resolveWait', { id: item.id, outcome: 'bought' });
  assert.equal(store.getState().balance.cents, 50000 - 12900);
  assert.equal(store.getState().activity[0].kind, 'waitlist_bought');
  assert.throws(() => store.dispatch('resolveWait', { id: item.id, outcome: 'skipped' }), /already/);
  const other = store.dispatch('addWait', { name: 'Lamp', price: '40' });
  store.dispatch('resolveWait', { id: other.id, outcome: 'skipped' });
  assert.deepEqual(plain(core.waitlist.stats(store.getState().waitlist)), { skippedCount: 1, keptCents: 4000, boughtCount: 1 });
});

test('undo restores the previous state exactly once', () => {
  const store = makeStore(core);
  const b = store.dispatch('addBill', { name: 'Rent', amount: '1', dueDate: TODAY, cadence: 'monthly' });
  store.dispatch('deleteBill', { id: b.id });
  assert.equal(store.getState().bills.length, 0);
  assert.ok(store.undo());
  assert.equal(store.getState().bills.length, 1);
  assert.equal(store.undo(), false);
});

test('actions output always passes schema.sanitize unchanged (no invalid state reachable)', () => {
  const store = makeStore(core);
  store.dispatch('setBalance', { amount: '1000' });
  store.dispatch('setPayday', { next: '2026-10-24', cadence: 'biweekly' });
  store.dispatch('addBill', { name: 'Car', amount: '600', dueDate: '2027-01-14', cadence: 'every_n_months', everyN: '6', setAside: true });
  const d = store.dispatch('addDebt', { name: 'Visa', balance: '900', apr: '19.9', minPayment: '30' });
  store.dispatch('addDebtPaymentBill', { id: d.id, dueDate: '2026-10-28' });
  store.dispatch('addGoal', { name: 'Trip', kind: 'goal', target: '800', saved: '50' });
  store.dispatch('addWait', { name: 'Shoes', price: '89.99' });
  store.dispatch('logActivity', { kind: 'spend', amount: '9.99', label: 'Coffee' });
  store.dispatch('setCurrency', { currency: 'GBP' });
  store.dispatch('setTheme', { theme: 'dark' });
  const s = plain(store.getState());
  const { state, report } = core.schema.sanitize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(plain(state), s);
  assert.deepEqual(plain(report.dropped), {});
});
