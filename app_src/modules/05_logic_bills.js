/* Bill schedule rules — pure functions, no state access, no DOM.
 *
 * A bill stores only its CURRENT cycle: `dueDate` + `paid`. Future occurrences are
 * derived (occurrencesBefore), never stored, so they can't drift out of sync.
 * Once a paid cycle's due date is behind us, rollForward() moves the bill to its
 * next cycle, unpaid. See docs/SAFE-TO-SPEND.md for how these feed the number. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};
  var dates = App.core.dates;

  var MAX_OCCURRENCES = 120; // hard stop for any loop over a schedule

  /** The occurrence after `date` for this bill's cadence, or null for one-offs. */
  function nextAfter(bill, date) {
    switch (bill.cadence) {
      case 'weekly': return dates.addDays(date, 7);
      case 'biweekly': return dates.addDays(date, 14);
      case 'monthly': return dates.addMonths(date, 1, bill.anchorDay);
      case 'every_n_months': return dates.addMonths(date, bill.everyN, bill.anchorDay);
      default: return null;
    }
  }

  /** Returns a NEW bill moved past its paid cycle once that cycle's due date has
   *  passed. Only ever rolls one cycle: later cycles were never marked paid, so
   *  they correctly surface as overdue rather than being skipped. */
  function rollForward(bill, today) {
    if (!bill.paid || bill.cadence === 'one_off') return bill;
    if (dates.compare(bill.dueDate, today) >= 0) return bill;
    var next = nextAfter(bill, bill.dueDate);
    var copy = Object.assign({}, bill);
    copy.dueDate = next;
    copy.paid = false;
    return copy;
  }

  /**
   * Every unpaid occurrence due strictly before `end`: the current cycle (if
   * unpaid — including overdue ones) plus derived future cycles.
   * -> [{date, isCurrent, overdue}]
   */
  function occurrencesBefore(bill, end, today) {
    var out = [];
    if (!bill.paid && dates.compare(bill.dueDate, end) < 0) {
      out.push({ date: bill.dueDate, isCurrent: true, overdue: dates.compare(bill.dueDate, today) < 0 });
    }
    var d = nextAfter(bill, bill.dueDate);
    var guard = 0;
    while (d && dates.compare(d, end) < 0 && guard < MAX_OCCURRENCES) {
      out.push({ date: d, isCurrent: false, overdue: false });
      d = nextAfter(bill, d);
      guard += 1;
    }
    return out;
  }

  /**
   * For an every-N-months bill with "set aside" on: how much should already be
   * held back for its next due date, accruing evenly across the cycle — like
   * putting a little away every day, so the full amount is ready on the due date
   * instead of landing as a surprise. 0 for every other bill.
   */
  function setAsideAccrued(bill, today) {
    if (bill.cadence !== 'every_n_months' || !bill.setAside || bill.paid) return 0;
    var cycleStart = dates.addMonths(bill.dueDate, -bill.everyN, bill.anchorDay);
    var total = dates.diffDays(cycleStart, bill.dueDate);
    if (total <= 0) return bill.amountCents;
    var elapsed = Math.max(0, Math.min(total, dates.diffDays(cycleStart, today)));
    return Math.round(bill.amountCents * elapsed / total);
  }

  /** Average cost per month, for the "about $X a month in bills" summary. */
  function monthlyEquivalent(bill) {
    switch (bill.cadence) {
      case 'weekly': return Math.round(bill.amountCents * 52 / 12);
      case 'biweekly': return Math.round(bill.amountCents * 26 / 12);
      case 'monthly': return bill.amountCents;
      case 'every_n_months': return Math.round(bill.amountCents / bill.everyN);
      default: return 0;
    }
  }

  function cadenceLabel(bill) {
    switch (bill.cadence) {
      case 'weekly': return 'Every week';
      case 'biweekly': return 'Every 2 weeks';
      case 'monthly': return 'Every month';
      case 'every_n_months': return 'Every ' + bill.everyN + ' months';
      default: return 'One time';
    }
  }

  App.core.bills = {
    nextAfter: nextAfter,
    rollForward: rollForward,
    occurrencesBefore: occurrencesBefore,
    setAsideAccrued: setAsideAccrued,
    monthlyEquivalent: monthlyEquivalent,
    cadenceLabel: cadenceLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
