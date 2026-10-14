/* The Safe-to-Spend calculation — the single source of truth for the number the
 * whole product exists to show. Pure: (state, today) -> breakdown. Nothing here
 * is ever stored; it's recomputed from the entities on every render.
 *
 *   safe = balance
 *        − every unpaid bill occurrence due before the next payday (incl. overdue)
 *        − money accrued toward "set aside" every-N-months bills not already due
 *        − money held in savings goals and envelopes
 *
 * docs/SAFE-TO-SPEND.md walks through the rules and the reasoning. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};
  var dates = App.core.dates;
  var billsLogic = App.core.bills;

  var DEFAULT_WINDOW_DAYS = 30;

  /**
   * The first payday strictly AFTER today. A payday that is today (or already
   * passed) is treated as received — the window runs to the one after it.
   * -> {date, source: 'payday'|'default', stale: boolean}
   *    stale = an "irregular" payday that has passed and needs a new date.
   */
  function effectivePayday(payday, today) {
    if (!payday || !payday.next) {
      return { date: dates.addDays(today, DEFAULT_WINDOW_DAYS), source: 'default', stale: false };
    }
    var d = payday.next;
    if (dates.compare(d, today) > 0) return { date: d, source: 'payday', stale: false };
    if (payday.cadence === 'irregular') {
      return { date: dates.addDays(today, DEFAULT_WINDOW_DAYS), source: 'default', stale: true };
    }
    var anchor = dates.day(payday.next);
    var guard = 0;
    while (dates.compare(d, today) <= 0 && guard < 600) {
      if (payday.cadence === 'weekly') d = dates.addDays(d, 7);
      else if (payday.cadence === 'monthly') d = dates.addMonths(d, 1, anchor);
      else d = dates.addDays(d, 14);
      guard += 1;
    }
    return { date: d, source: 'payday', stale: false };
  }

  function compute(state, today) {
    var pay = effectivePayday(state.payday, today);
    var end = pay.date;
    var daysLeft = Math.max(1, dates.diffDays(today, end));

    var dueItems = [];
    var setAsideItems = [];
    state.bills.forEach(function (raw) {
      var bill = billsLogic.rollForward(raw, today);
      var occ = billsLogic.occurrencesBefore(bill, end, today);
      occ.forEach(function (o) {
        dueItems.push({ bill: bill, date: o.date, isCurrent: o.isCurrent, overdue: o.overdue, amountCents: bill.amountCents });
      });
      if (occ.length === 0) {
        var accrued = billsLogic.setAsideAccrued(bill, today);
        if (accrued > 0) setAsideItems.push({ bill: bill, amountCents: accrued });
      }
    });
    dueItems.sort(function (a, b) {
      return dates.compare(a.date, b.date) || a.bill.name.localeCompare(b.bill.name);
    });

    var sum = function (list, key) { return list.reduce(function (s, x) { return s + x[key]; }, 0); };
    var billsDueCents = sum(dueItems, 'amountCents');
    var setAsideCents = sum(setAsideItems, 'amountCents');
    var savingsCents = sum(state.goals, 'savedCents');
    var hasBalance = state.balance.cents !== null;
    var balanceCents = hasBalance ? state.balance.cents : 0;
    var safeCents = balanceCents - billsDueCents - setAsideCents - savingsCents;

    return {
      hasBalance: hasBalance,
      balanceCents: balanceCents,
      payday: pay,
      daysLeft: daysLeft,
      dueItems: dueItems,
      billsDueCents: billsDueCents,
      setAsideItems: setAsideItems,
      setAsideCents: setAsideCents,
      savingsCents: savingsCents,
      safeCents: safeCents,
      perDayCents: safeCents > 0 ? Math.floor(safeCents / daysLeft) : 0,
      overdueCount: dueItems.filter(function (i) { return i.overdue; }).length,
    };
  }

  App.core.safeToSpend = {
    compute: compute,
    effectivePayday: effectivePayday,
    DEFAULT_WINDOW_DAYS: DEFAULT_WINDOW_DAYS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
