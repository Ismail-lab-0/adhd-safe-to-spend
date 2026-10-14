/* Date-only helpers. Every date the app stores is a local calendar date string
 * "YYYY-MM-DD" — never a Date's toISOString(), which is the UTC date and silently
 * shows "tomorrow" or "yesterday" for anyone far enough from UTC late at night.
 * All arithmetic goes through these functions so there is exactly one place that
 * knows how months of different lengths behave. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};

  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function isISODate(s) {
    if (typeof s !== 'string') return false;
    var m = ISO_RE.exec(s);
    if (!m) return false;
    var y = +m[1], mo = +m[2], d = +m[3];
    return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
  }

  function parse(s) {
    var m = ISO_RE.exec(s);
    return { y: +m[1], m: +m[2], d: +m[3] };
  }

  function format(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }

  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  /** Today's LOCAL calendar date. `now` is injectable for tests. */
  function today(now) {
    var d = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    return format(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  // Day arithmetic in UTC space so DST transitions can never add/lose an hour
  // and roll a date over.
  function toDayNumber(s) {
    var p = parse(s);
    return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }
  function fromDayNumber(n) {
    var d = new Date(n * 86400000);
    return format(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  function addDays(s, n) { return fromDayNumber(toDayNumber(s) + n); }

  /** Whole days from a to b (positive when b is later). */
  function diffDays(a, b) { return toDayNumber(b) - toDayNumber(a); }

  /**
   * Adds n months, keeping `anchorDay` (the day-of-month the series is really on)
   * so a bill due on the 31st goes Jan 31 -> Feb 28 -> Mar 31, not drifting to the
   * 28th forever after February.
   */
  function addMonths(s, n, anchorDay) {
    var p = parse(s);
    var total = p.y * 12 + (p.m - 1) + n;
    var y = Math.floor(total / 12);
    var m = (total % 12) + 1;
    var day = Math.min(anchorDay || p.d, daysInMonth(y, m));
    return format(y, m, day);
  }

  function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function weekday(s) {
    var p = parse(s);
    return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  }

  /** "Fri, Oct 24" — short, unambiguous, no locale-dependent day/month order. */
  function label(s) {
    if (!isISODate(s)) return '';
    var p = parse(s);
    return WEEKDAYS[weekday(s)] + ', ' + MONTHS[p.m - 1] + ' ' + p.d;
  }

  /** "Today", "Tomorrow", "In 3 days", "2 days ago" relative to `ref`. */
  function relative(s, ref) {
    var n = diffDays(ref, s);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n > 1) return 'In ' + n + ' days';
    return (-n) + ' days ago';
  }

  App.core.dates = {
    isISODate: isISODate,
    today: today,
    addDays: addDays,
    addMonths: addMonths,
    diffDays: diffDays,
    daysInMonth: daysInMonth,
    compare: compare,
    label: label,
    relative: relative,
    day: function (s) { return parse(s).d; },
    MONTHS: MONTHS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
