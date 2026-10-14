/* Storage adapter — the ONLY code that touches localStorage. Feature code reads
 * and writes state through App.core.store, which persists through this.
 *
 * - One namespaced key per build (full vs demo use different keys — see main.js).
 *   The demo and the full app are served from the same github.io origin, as are
 *   this account's other apps, so a generic key would let them overwrite each
 *   other's data.
 * - Corrupt or unreadable data is copied to "<key>:recovery" before anything is
 *   overwritten, and reported via onProblem — never silently discarded.
 * - Writes are debounced; flush() is called on pagehide so nothing is lost.
 * - The backend is injected (defaults to window.localStorage) so tests can run
 *   under Node with an in-memory fake. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};
  var schema = App.core.schema;

  var SOFT_LIMIT_BYTES = 4 * 1024 * 1024;

  function createStorage(opts) {
    var key = opts.key;
    var backend = opts.backend;
    var debounceMs = opts.debounceMs == null ? 250 : opts.debounceMs;
    var onProblem = opts.onProblem || function () {};
    var pending = null;
    var timer = null;

    if (!backend) {
      try { backend = g.localStorage; } catch (e) { backend = null; }
    }

    function preserve(raw) {
      try { backend.setItem(key + ':recovery', raw); } catch (e) { /* best effort */ }
    }

    /** -> {state, report, problem} ; problem is null | 'unavailable' | 'corrupt' | 'newer' */
    function load() {
      var raw = null;
      if (!backend) return { state: schema.createEmptyState(), report: { dropped: {} }, problem: 'unavailable' };
      try {
        raw = backend.getItem(key);
      } catch (e) {
        return { state: schema.createEmptyState(), report: { dropped: {} }, problem: 'unavailable' };
      }
      if (raw == null) return { state: schema.createEmptyState(), report: { dropped: {} }, problem: null };
      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) {
        preserve(raw);
        return { state: schema.createEmptyState(), report: { dropped: {} }, problem: 'corrupt' };
      }
      try {
        var res = schema.sanitize(parsed);
        var dropped = Object.keys(res.report.dropped).length > 0;
        if (dropped) preserve(raw);
        return { state: res.state, report: res.report, problem: dropped ? 'partial' : null };
      } catch (e) {
        preserve(raw);
        return { state: schema.createEmptyState(), report: { dropped: {} }, problem: e.message === 'newer' ? 'newer' : 'corrupt' };
      }
    }

    function save(state) {
      if (!backend) return false;
      var s = JSON.stringify(state);
      try {
        backend.setItem(key, s);
      } catch (e) {
        onProblem('quota');
        return false;
      }
      if (s.length * 2 > SOFT_LIMIT_BYTES) onProblem('nearQuota');
      return true;
    }

    function scheduleSave(state) {
      pending = state;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    }

    function flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (pending) { var s = pending; pending = null; save(s); }
    }

    function clear() {
      pending = null;
      if (timer) { clearTimeout(timer); timer = null; }
      try { backend && backend.removeItem(key); } catch (e) { /* ignore */ }
    }

    return { load: load, save: save, scheduleSave: scheduleSave, flush: flush, clear: clear, key: key };
  }

  App.core.createStorage = createStorage;
})(typeof window !== 'undefined' ? window : globalThis);
