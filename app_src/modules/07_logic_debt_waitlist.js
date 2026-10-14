/* Debt payoff ordering and Wait List timing — small pure rule sets. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};

  /**
   * Snowball: smallest balance first (quick wins). Avalanche: highest APR first
   * (least interest overall). Ties break by the other rule, then by name, so the
   * order is stable and never depends on insertion order. Debts already at $0
   * sink to the end. Returns a new array.
   */
  function payoffOrder(debts, strategy) {
    var list = debts.slice();
    list.sort(function (a, b) {
      var aDone = a.balanceCents === 0, bDone = b.balanceCents === 0;
      if (aDone !== bDone) return aDone ? 1 : -1;
      var byBalance = a.balanceCents - b.balanceCents;
      var byRate = b.aprBps - a.aprBps;
      var primary = strategy === 'avalanche' ? (byRate || byBalance) : (byBalance || byRate);
      return primary || a.name.localeCompare(b.name);
    });
    return list;
  }

  function debtTotals(debts) {
    return debts.reduce(function (t, d) {
      t.balanceCents += d.balanceCents;
      t.minPaymentCents += d.balanceCents > 0 ? d.minPaymentCents : 0;
      return t;
    }, { balanceCents: 0, minPaymentCents: 0 });
  }

  /** "19.99" <-> 1999 basis points. */
  function parseApr(input) {
    if (input === '' || input == null) return 0;
    var s = String(input).replace('%', '').trim();
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
    var bps = Math.round(parseFloat(s) * 100);
    return bps <= 20000 ? bps : null;
  }
  function formatApr(bps) {
    var s = (bps / 100).toFixed(2).replace(/\.?0+$/, '');
    return s + '%';
  }

  var WAIT_MS = 48 * 60 * 60 * 1000;

  function waitRemainingMs(item, now) {
    return Math.max(0, item.addedAt + WAIT_MS - now);
  }

  /** "47h 12m", "38m", "under a minute" */
  function formatRemaining(ms) {
    if (ms <= 0) return 'Ready';
    var totalMin = Math.ceil(ms / 60000);
    var h = Math.floor(totalMin / 60), m = totalMin % 60;
    if (h === 0) return totalMin <= 1 ? 'under a minute' : m + 'm';
    return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
  }

  function waitStats(items) {
    return items.reduce(function (s, i) {
      if (i.status === 'skipped') { s.skippedCount += 1; s.keptCents += i.priceCents; }
      if (i.status === 'bought') s.boughtCount += 1;
      return s;
    }, { skippedCount: 0, keptCents: 0, boughtCount: 0 });
  }

  App.core.debt = { payoffOrder: payoffOrder, totals: debtTotals, parseApr: parseApr, formatApr: formatApr };
  App.core.waitlist = {
    WAIT_MS: WAIT_MS,
    remainingMs: waitRemainingMs,
    formatRemaining: formatRemaining,
    stats: waitStats,
  };
})(typeof window !== 'undefined' ? window : globalThis);
