/* The persisted state shape, its version, and the one function that turns any
 * untrusted blob (localStorage contents, an imported backup file) into a valid
 * state tree. docs/DATA-MODEL.md is the human-readable version of this file.
 *
 * sanitize() never throws on bad *content* — a malformed item is dropped and
 * counted, so one corrupted bill can't take the whole app down. It throws only
 * when the blob is unusable as a whole (not an object, or written by a newer
 * version of the app than this one), which callers handle explicitly. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};
  var money = App.core.money;
  var dates = App.core.dates;

  var SCHEMA_VERSION = 1;

  var CADENCES = ['weekly', 'biweekly', 'monthly', 'every_n_months', 'one_off'];
  var PAYDAY_CADENCES = ['weekly', 'biweekly', 'monthly', 'irregular'];
  var THEMES = ['system', 'light', 'dark'];
  var STRATEGIES = ['snowball', 'avalanche'];
  var GOAL_KINDS = ['goal', 'envelope'];
  var WAIT_STATUSES = ['waiting', 'bought', 'skipped'];
  var ACTIVITY_KINDS = ['spend', 'income', 'bill_paid', 'waitlist_bought'];

  var NAME_MAX = 60;

  function createEmptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      settings: { currency: 'USD', theme: 'system', lastBackupAt: null, onboardingDismissed: false },
      balance: { cents: null, updatedOn: null },
      payday: { next: null, cadence: 'biweekly' },
      bills: [],
      debts: [],
      debtStrategy: 'snowball',
      goals: [],
      waitlist: [],
      activity: [],
    };
  }

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function oneOf(v, list, fallback) { return list.indexOf(v) !== -1 ? v : fallback; }
  function cleanName(v) {
    if (typeof v !== 'string') return null;
    var s = v.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
    return s || null;
  }
  function cleanId(v) { return typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null; }
  function nonNegCents(v) { return money.isCents(v) && v >= 0 ? v : null; }
  function dateOrNull(v) { return dates.isISODate(v) ? v : null; }
  function intIn(v, lo, hi) { return typeof v === 'number' && Math.floor(v) === v && v >= lo && v <= hi; }

  var sanitizers = {
    bill: function (b) {
      if (!isObj(b)) return null;
      var id = cleanId(b.id), name = cleanName(b.name), amount = nonNegCents(b.amountCents);
      var due = dateOrNull(b.dueDate), cadence = oneOf(b.cadence, CADENCES, null);
      if (!id || !name || amount === null || !due || !cadence) return null;
      var everyN = cadence === 'every_n_months' ? (intIn(b.everyN, 2, 24) ? b.everyN : null) : null;
      if (cadence === 'every_n_months' && everyN === null) return null;
      return {
        id: id, name: name, amountCents: amount, cadence: cadence, everyN: everyN,
        setAside: cadence === 'every_n_months' && b.setAside === true,
        dueDate: due,
        anchorDay: intIn(b.anchorDay, 1, 31) ? b.anchorDay : dates.day(due),
        paid: b.paid === true,
        debtId: cleanId(b.debtId),
      };
    },
    debt: function (d) {
      if (!isObj(d)) return null;
      var id = cleanId(d.id), name = cleanName(d.name), bal = nonNegCents(d.balanceCents);
      if (!id || !name || bal === null) return null;
      return {
        id: id, name: name, balanceCents: bal,
        // APR stored as basis points (19.99% -> 1999) so it stays an integer too.
        aprBps: intIn(d.aprBps, 0, 20000) ? d.aprBps : 0,
        minPaymentCents: nonNegCents(d.minPaymentCents) || 0,
      };
    },
    goal: function (x) {
      if (!isObj(x)) return null;
      var id = cleanId(x.id), name = cleanName(x.name), saved = nonNegCents(x.savedCents);
      if (!id || !name || saved === null) return null;
      var target = nonNegCents(x.targetCents);
      return { id: id, name: name, kind: oneOf(x.kind, GOAL_KINDS, 'goal'), targetCents: target || null, savedCents: saved };
    },
    wait: function (w) {
      if (!isObj(w)) return null;
      var id = cleanId(w.id), name = cleanName(w.name), price = nonNegCents(w.priceCents);
      if (!id || !name || price === null || !intIn(w.addedAt, 0, 8.64e15)) return null;
      return {
        id: id, name: name, priceCents: price, addedAt: w.addedAt,
        status: oneOf(w.status, WAIT_STATUSES, 'waiting'),
        resolvedOn: dateOrNull(w.resolvedOn),
      };
    },
    activity: function (a) {
      if (!isObj(a)) return null;
      var id = cleanId(a.id), kind = oneOf(a.kind, ACTIVITY_KINDS, null);
      var amt = nonNegCents(a.amountCents), date = dateOrNull(a.date);
      if (!id || !kind || amt === null || !date) return null;
      return { id: id, kind: kind, amountCents: amt, label: cleanName(a.label) || '', date: date, refId: cleanId(a.refId) };
    },
  };

  function sanitizeList(list, fn, report, key) {
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    list.forEach(function (item) {
      var clean = fn(item);
      if (!clean || seen[clean.id]) { report.dropped[key] = (report.dropped[key] || 0) + 1; return; }
      seen[clean.id] = true;
      out.push(clean);
    });
    return out;
  }

  /**
   * Untrusted blob -> {state, report}. report.dropped counts discarded items per
   * collection so the UI can say so honestly instead of silently losing data.
   * Throws Error('newer') / Error('invalid') for blobs that can't be used at all.
   */
  function sanitize(raw) {
    if (!isObj(raw)) throw new Error('invalid');
    var version = raw.schemaVersion;
    if (typeof version !== 'number') throw new Error('invalid');
    if (version > SCHEMA_VERSION) throw new Error('newer');
    raw = migrate(raw);

    var base = createEmptyState();
    var report = { dropped: {} };
    var s = isObj(raw.settings) ? raw.settings : {};
    var currencyCodes = money.CURRENCIES.map(function (c) { return c[0]; });
    base.settings = {
      currency: oneOf(s.currency, currencyCodes, 'USD'),
      theme: oneOf(s.theme, THEMES, 'system'),
      lastBackupAt: dateOrNull(s.lastBackupAt),
      onboardingDismissed: s.onboardingDismissed === true,
    };
    var bal = isObj(raw.balance) ? raw.balance : {};
    base.balance = {
      cents: money.isCents(bal.cents) ? bal.cents : null,
      updatedOn: dateOrNull(bal.updatedOn),
    };
    var pd = isObj(raw.payday) ? raw.payday : {};
    base.payday = { next: dateOrNull(pd.next), cadence: oneOf(pd.cadence, PAYDAY_CADENCES, 'biweekly') };
    base.bills = sanitizeList(raw.bills, sanitizers.bill, report, 'bills');
    base.debts = sanitizeList(raw.debts, sanitizers.debt, report, 'debts');
    base.debtStrategy = oneOf(raw.debtStrategy, STRATEGIES, 'snowball');
    base.goals = sanitizeList(raw.goals, sanitizers.goal, report, 'goals');
    base.waitlist = sanitizeList(raw.waitlist, sanitizers.wait, report, 'waitlist');
    base.activity = sanitizeList(raw.activity, sanitizers.activity, report, 'activity');

    // A bill can only stay linked to a debt that still exists.
    var debtIds = {};
    base.debts.forEach(function (d) { debtIds[d.id] = true; });
    base.bills.forEach(function (b) { if (b.debtId && !debtIds[b.debtId]) b.debtId = null; });
    return { state: base, report: report };
  }

  /**
   * Step-by-step upgrades from older schema versions. There is only v1 so far;
   * a future v2 adds `if (raw.schemaVersion === 1) { ...; raw.schemaVersion = 2; }`
   * here, never an in-place reinterpretation of an existing field.
   */
  function migrate(raw) {
    return raw;
  }

  App.core.schema = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    CADENCES: CADENCES,
    PAYDAY_CADENCES: PAYDAY_CADENCES,
    THEMES: THEMES,
    NAME_MAX: NAME_MAX,
    createEmptyState: createEmptyState,
    sanitize: sanitize,
    cleanName: cleanName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
