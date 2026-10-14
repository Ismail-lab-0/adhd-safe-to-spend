/* App state store: one in-memory state tree, changed only by named actions
 * (App.core.actions, 09_actions.js), persisted through the storage adapter, with
 * subscribers re-rendering from the new state.
 *
 * dispatch() runs the action against a deep copy and only commits if it returns
 * without throwing — an action that rejects its input (throws a ValidationError)
 * leaves state untouched. The pre-action snapshot is kept for a single-level
 * undo(), which the UI offers after destructive or balance-changing actions. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};

  function ValidationError(field, message) {
    this.name = 'ValidationError';
    this.field = field;
    this.message = message;
  }
  ValidationError.prototype = Object.create(Error.prototype);

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /**
   * @param {object} opts
   * @param {object} opts.state        initial (already sanitized) state
   * @param {object} opts.actions      name -> fn(state, payload, ctx) mutating state
   * @param {object} [opts.storage]    adapter from createStorage (optional in tests)
   * @param {function} [opts.now]      clock, ms — injectable for tests
   * @param {function} [opts.newId]    id generator — injectable for tests
   * @param {object} [opts.limits]     e.g. {maxBills: 3} in the demo build
   */
  function createStore(opts) {
    var state = opts.state;
    var actions = opts.actions;
    var storage = opts.storage || null;
    var now = opts.now || function () { return Date.now(); };
    var limits = opts.limits || {};
    var counter = 0;
    var newId = opts.newId || function () {
      counter += 1;
      return now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6);
    };
    var listeners = [];
    var undoSnapshot = null;

    function ctx() {
      var t = now();
      return { now: t, today: App.core.dates.today(t), newId: newId, limits: limits };
    }

    function notify(meta) { listeners.slice().forEach(function (fn) { fn(state, meta); }); }

    function dispatch(name, payload) {
      var fn = actions[name];
      if (!fn) throw new Error('Unknown action: ' + name);
      var draft = clone(state);
      var result = fn(draft, payload || {}, ctx());
      undoSnapshot = state;
      state = draft;
      if (storage) storage.scheduleSave(state);
      notify({ action: name });
      return result;
    }

    function undo() {
      if (!undoSnapshot) return false;
      state = undoSnapshot;
      undoSnapshot = null;
      if (storage) storage.scheduleSave(state);
      notify({ action: 'undo' });
      return true;
    }

    /** Wholesale replacement (backup import / erase). Not undoable by design —
     *  the UI confirms before calling this. */
    function replace(next) {
      state = next;
      undoSnapshot = null;
      if (storage) { storage.save(state); }
      notify({ action: 'replace' });
    }

    return {
      getState: function () { return state; },
      dispatch: dispatch,
      undo: undo,
      canUndo: function () { return !!undoSnapshot; },
      replace: replace,
      subscribe: function (fn) {
        listeners.push(fn);
        return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
      },
      now: now,
      today: function () { return App.core.dates.today(now()); },
      limits: limits,
    };
  }

  App.core.ValidationError = ValidationError;
  App.core.createStore = createStore;
})(typeof window !== 'undefined' ? window : globalThis);
