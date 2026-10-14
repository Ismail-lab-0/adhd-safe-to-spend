'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./_load');

const core = loadCore();
const { money, dates, schema } = core;

test('parseCents accepts common formats as exact integer cents', () => {
  assert.equal(money.parseCents('2450'), 245000);
  assert.equal(money.parseCents('2,450.5'), 245050);
  assert.equal(money.parseCents('$1,200.00'), 120000);
  assert.equal(money.parseCents(' 0.1 '), 10);
  assert.equal(money.parseCents('.99'), 99);
  assert.equal(money.parseCents(12.34), 1234);
});

test('parseCents rejects negatives, junk and over-precise input', () => {
  for (const bad of ['-5', 'abc', '', '   ', '1.234', '1.2.3', '1e5', null, undefined, NaN, Infinity, -1]) {
    assert.equal(money.parseCents(bad), null, String(bad));
  }
});

test('parseCents allows negatives only when asked (balance)', () => {
  assert.equal(money.parseCents('-120.50', { allowNegative: true }), -12050);
  assert.equal(money.parseCents('-120.50'), null);
});

test('parseCents caps absurd values', () => {
  assert.equal(money.parseCents('99999999999999'), null);
});

test('centsToInput round-trips through parseCents', () => {
  for (const c of [0, 5, 99, 100, 123456, -4520]) {
    assert.equal(money.parseCents(money.centsToInput(c), { allowNegative: true }), c);
  }
});

test('formatCents formats currency and never shows float drift', () => {
  const s = money.formatCents(30, 'USD'); // 0.1 + 0.2 territory
  assert.match(s, /0\.30/);
  assert.match(money.formatCents(123456, 'EUR'), /1,234\.56|1\.234,56|1 234,56/);
  assert.doesNotThrow(() => money.formatCents(100, 'NOT-A-CURRENCY'));
});

test('dates: today() is the LOCAL calendar date, not the UTC one', () => {
  const lateNight = new Date(2026, 0, 31, 23, 59, 0); // local
  assert.equal(dates.today(lateNight), '2026-01-31');
});

test('dates: validation rejects impossible dates', () => {
  assert.ok(dates.isISODate('2028-02-29'));
  assert.ok(!dates.isISODate('2026-02-29'));
  assert.ok(!dates.isISODate('2026-13-01'));
  assert.ok(!dates.isISODate('2026-1-01'));
  assert.ok(!dates.isISODate(20261001));
});

test('dates: addMonths clamps to month end but keeps the anchor day', () => {
  assert.equal(dates.addMonths('2026-01-31', 1, 31), '2026-02-28');
  assert.equal(dates.addMonths('2026-02-28', 1, 31), '2026-03-31');
  assert.equal(dates.addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(dates.addMonths('2026-03-31', -1, 31), '2026-02-28');
});

test('dates: day arithmetic is DST-safe', () => {
  assert.equal(dates.addDays('2026-03-07', 2), '2026-03-09');
  assert.equal(dates.addDays('2026-10-31', 7), '2026-11-07');
  assert.equal(dates.diffDays('2026-10-14', '2026-10-24'), 10);
  assert.equal(dates.diffDays('2026-12-31', '2027-01-01'), 1);
});

test('dates: labels', () => {
  assert.equal(dates.label('2026-10-24'), 'Sat, Oct 24');
  assert.equal(dates.relative('2026-10-15', '2026-10-14'), 'Tomorrow');
  assert.equal(dates.relative('2026-10-11', '2026-10-14'), '3 days ago');
});

test('schema: empty state survives a sanitize round trip unchanged', () => {
  const empty = schema.createEmptyState();
  const { state, report } = schema.sanitize(JSON.parse(JSON.stringify(empty)));
  assert.deepEqual(JSON.parse(JSON.stringify(state)), JSON.parse(JSON.stringify(empty)));
  assert.deepEqual(Object.keys(report.dropped), []);
});

test('schema: rejects non-objects, missing version and newer versions', () => {
  assert.throws(() => schema.sanitize(null), /invalid/);
  assert.throws(() => schema.sanitize([]), /invalid/);
  assert.throws(() => schema.sanitize({ bills: [] }), /invalid/);
  assert.throws(() => schema.sanitize({ schemaVersion: 99 }), /newer/);
});

test('schema: drops malformed items, keeps good ones, reports counts', () => {
  const raw = {
    schemaVersion: 1,
    bills: [
      { id: 'a', name: 'Rent', amountCents: 120000, cadence: 'monthly', dueDate: '2026-11-01' },
      { id: 'b', name: '', amountCents: 100, cadence: 'monthly', dueDate: '2026-11-01' },
      { id: 'c', name: 'Float', amountCents: 10.5, cadence: 'monthly', dueDate: '2026-11-01' },
      { id: 'd', name: 'Bad date', amountCents: 100, cadence: 'monthly', dueDate: '2026-02-30' },
      { id: 'e', name: 'No N', amountCents: 100, cadence: 'every_n_months', dueDate: '2026-11-01' },
      { id: 'a', name: 'Duplicate id', amountCents: 1, cadence: 'monthly', dueDate: '2026-11-01' },
      'nonsense',
    ],
    goals: [{ id: 'g', name: 'Trip', savedCents: -5 }],
    settings: { currency: 'XXX', theme: 'neon' },
    balance: { cents: '100' },
  };
  const { state, report } = schema.sanitize(raw);
  assert.equal(state.bills.length, 1);
  assert.equal(state.bills[0].name, 'Rent');
  assert.equal(state.bills[0].anchorDay, 1);
  assert.equal(report.dropped.bills, 6);
  assert.equal(report.dropped.goals, 1);
  assert.equal(state.settings.currency, 'USD');
  assert.equal(state.settings.theme, 'system');
  assert.equal(state.balance.cents, null);
});

test('schema: strips markup-ish whitespace and truncates long names', () => {
  const long = 'x'.repeat(200);
  const { state } = schema.sanitize({
    schemaVersion: 1,
    debts: [{ id: 'd1', name: '  Card\n\n  one ', balanceCents: 0 }, { id: 'd2', name: long, balanceCents: 1 }],
  });
  assert.equal(state.debts[0].name, 'Card one');
  assert.equal(state.debts[1].name.length, schema.NAME_MAX);
});

test('schema: bill links to deleted debts are cleared', () => {
  const { state } = schema.sanitize({
    schemaVersion: 1,
    bills: [{ id: 'b', name: 'Card payment', amountCents: 2500, cadence: 'monthly', dueDate: '2026-11-01', debtId: 'gone' }],
  });
  assert.equal(state.bills[0].debtId, null);
});

function fakeBackend(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test('storage: fresh install loads an empty state with no problem', () => {
  const st = core.createStorage({ key: 'k', backend: fakeBackend() });
  const res = st.load();
  assert.equal(res.problem, null);
  assert.equal(res.state.bills.length, 0);
});

test('storage: corrupt JSON is preserved under a recovery key, never lost', () => {
  const be = fakeBackend({ k: '{not json' });
  const res = core.createStorage({ key: 'k', backend: be }).load();
  assert.equal(res.problem, 'corrupt');
  assert.equal(be.data['k:recovery'], '{not json');
});

test('storage: data from a newer app version is preserved and reported', () => {
  const be = fakeBackend({ k: JSON.stringify({ schemaVersion: 7 }) });
  const res = core.createStorage({ key: 'k', backend: be }).load();
  assert.equal(res.problem, 'newer');
  assert.ok(be.data['k:recovery']);
});

test('storage: partially bad data loads the good part and keeps the original', () => {
  const blob = JSON.stringify({ schemaVersion: 1, bills: [{ id: 'x' }], goals: [] });
  const be = fakeBackend({ k: blob });
  const res = core.createStorage({ key: 'k', backend: be }).load();
  assert.equal(res.problem, 'partial');
  assert.equal(be.data['k:recovery'], blob);
});

test('storage: unavailable localStorage degrades to in-memory', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const res = core.createStorage({ key: 'k', backend: throwing }).load();
  assert.equal(res.problem, 'unavailable');
});

test('storage: quota errors are reported, not thrown', () => {
  let reported = null;
  const full = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); } };
  const st = core.createStorage({ key: 'k', backend: full, onProblem: (p) => { reported = p; } });
  assert.equal(st.save({ a: 1 }), false);
  assert.equal(reported, 'quota');
});

test('storage: save then load round-trips exactly', () => {
  const be = fakeBackend();
  const st = core.createStorage({ key: 'k', backend: be });
  const s = schema.createEmptyState();
  s.balance = { cents: -1250, updatedOn: '2026-10-14' };
  s.bills.push({ id: 'b1', name: 'Rent', amountCents: 120000, cadence: 'monthly', everyN: null, setAside: false, dueDate: '2026-11-01', anchorDay: 1, paid: false, debtId: null });
  st.save(s);
  assert.deepEqual(JSON.parse(JSON.stringify(st.load().state)), JSON.parse(JSON.stringify(s)));
});
