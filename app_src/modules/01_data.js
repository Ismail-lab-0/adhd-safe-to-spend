/* Shared data helpers used by multiple views (dashboard, bills, debt, savings).
 * Defines App.data.* — no view registration here, just pure functions over the
 * same App.store state every view reads/writes. Loaded before the view modules
 * (filename order 01_ < 02_..07_) so App.data exists when they run. */
window.App = window.App || { views: {}, nav: [] };

App.data = {
  /* A bill's "effective" amount for safe-to-spend purposes: an every-N-months
   * bill with setAside=true is spread across its cadence (e.g. $372/6mo = $62/mo
   * held back monthly); everything else counts at its full face amount. */
  effectiveAmount: function (bill) {
    if (bill.cadence === 'every_n_months' && bill.setAside && bill.everyNMonths > 0) {
      return bill.amount / bill.everyNMonths;
    }
    return bill.amount;
  },

  unpaidBillsTotal: function (bills) {
    return (bills || [])
      .filter(function (b) { return !b.paid; })
      .reduce(function (sum, b) { return sum + App.data.effectiveAmount(b); }, 0);
  },

  savingsReservedTotal: function (goals) {
    return (goals || []).reduce(function (sum, g) { return sum + (g.saved || 0); }, 0);
  },

  safeToSpend: function () {
    var balance = App.store.get('balance', 0);
    var bills = App.store.get('bills', []);
    var goals = App.store.get('savings', []);
    return balance - App.data.unpaidBillsTotal(bills) - App.data.savingsReservedTotal(goals);
  },

  /* Advance a bill's dueDate (YYYY-MM-DD) to its next occurrence per cadence.
   * one_off bills never advance — caller should treat them as done once paid. */
  nextDueDate: function (bill) {
    var d = new Date(bill.dueDate + 'T00:00:00');
    if (isNaN(d.getTime())) return bill.dueDate;
    switch (bill.cadence) {
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'biweekly': d.setDate(d.getDate() + 14); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'every_n_months': d.setMonth(d.getMonth() + (bill.everyNMonths || 1)); break;
      case 'one_off': default: return bill.dueDate;
    }
    return d.toISOString().slice(0, 10);
  },

  /* Debt payoff order: snowball = smallest balance first, avalanche = highest
   * interest rate first. Returns a NEW sorted array; never mutates. */
  debtPayoffOrder: function (debts, strategy) {
    var list = (debts || []).slice();
    if (strategy === 'avalanche') {
      list.sort(function (a, b) { return (b.rate || 0) - (a.rate || 0); });
    } else {
      list.sort(function (a, b) { return (a.balance || 0) - (b.balance || 0); });
    }
    return list;
  },

  formatMoney: function (n) {
    var symbol = App.store.get('currencySymbol', '$');
    var v = isFinite(n) ? n : 0;
    return symbol + v.toFixed(2);
  },

  escapeHtml: function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },

  uid: function () {
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
};
