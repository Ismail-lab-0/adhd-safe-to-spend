/* Money utilities. Every amount the app stores is an integer number of cents —
 * never a float — so 0.1 + 0.2 style drift can never creep into a number the
 * user is trusting to decide what they can spend. See docs/DATA-MODEL.md §2.
 *
 * Classic script (not an ES module): tools/app_bundle.js concatenates every
 * app_src/modules/*.js file in filename order, and tests/ load the same files into
 * a Node vm context in the same order. Everything hangs off window.App.core. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};

  var MAX_CENTS = 100000000000; // $1,000,000,000.00 — a sanity ceiling, not a feature limit

  /**
   * Parses user input ("2450", "2,450.50", "$1,200", 12.5) into integer cents.
   * Rejects negatives, non-numbers, and more than 2 decimal places rather than
   * silently rounding away what the user typed. Returns null when invalid.
   */
  function parseCents(input, opts) {
    var allowNegative = !!(opts && opts.allowNegative);
    if (typeof input === 'number') {
      if (!isFinite(input)) return null;
      if (input < 0 && !allowNegative) return null;
      var c = Math.round(input * 100);
      return Math.abs(c) > MAX_CENTS ? null : c;
    }
    if (typeof input !== 'string') return null;
    var s = input.trim().replace(/[\s,$€£¥₹]/g, '');
    if (s === '') return null;
    var negative = false;
    if (s.charAt(0) === '-') {
      if (!allowNegative) return null;
      negative = true;
      s = s.slice(1);
    }
    if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
    var parts = s.split('.');
    var whole = parseInt(parts[0] || '0', 10);
    var frac = parseInt(((parts[1] || '') + '00').slice(0, 2), 10);
    var cents = whole * 100 + frac;
    if (cents > MAX_CENTS) return null;
    return negative ? -cents : cents;
  }

  function isCents(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && Math.abs(v) <= MAX_CENTS;
  }

  var formatterCache = {};
  function formatter(currency) {
    if (!formatterCache[currency]) {
      try {
        formatterCache[currency] = new Intl.NumberFormat(undefined, { style: 'currency', currency: currency });
      } catch (e) {
        formatterCache[currency] = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
      }
    }
    return formatterCache[currency];
  }

  /** Formats integer cents for display in the user's chosen currency. */
  function formatCents(cents, currency) {
    var v = isCents(cents) ? cents : 0;
    return formatter(currency || 'USD').format(v / 100);
  }

  /** Cents -> a plain "1234.50" string for pre-filling an input. */
  function centsToInput(cents) {
    if (!isCents(cents)) return '';
    var neg = cents < 0;
    var abs = Math.abs(cents);
    return (neg ? '-' : '') + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
  }

  // The currencies offered in Settings. Only the display symbol/format changes —
  // no conversion happens anywhere (there is no exchange-rate source offline).
  var CURRENCIES = [
    ['USD', 'US dollar'], ['CAD', 'Canadian dollar'], ['GBP', 'British pound'],
    ['EUR', 'Euro'], ['AUD', 'Australian dollar'], ['NZD', 'New Zealand dollar'],
    ['CHF', 'Swiss franc'], ['SEK', 'Swedish krona'], ['NOK', 'Norwegian krone'],
    ['DKK', 'Danish krone'], ['JPY', 'Japanese yen'], ['INR', 'Indian rupee'],
    ['ZAR', 'South African rand'], ['MXN', 'Mexican peso'], ['SGD', 'Singapore dollar'],
  ];

  App.core.money = {
    parseCents: parseCents,
    isCents: isCents,
    formatCents: formatCents,
    centsToInput: centsToInput,
    CURRENCIES: CURRENCIES,
    MAX_CENTS: MAX_CENTS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
