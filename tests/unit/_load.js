// Loads the app's pure core/logic modules (app_src/modules/0*_*.js — everything
// before the UI layer) into an isolated vm context, in the same filename order
// tools/app_bundle.js concatenates them. Tests exercise the real shipped source
// files, not a copy, and without a DOM.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MODULES = path.join(__dirname, '..', '..', 'app_src', 'modules');

function loadCore() {
  const sandbox = { Intl, console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  fs.readdirSync(MODULES).filter((f) => /^0\d_.*\.js$/.test(f)).sort().forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(MODULES, f), 'utf8'), sandbox, { filename: f });
  });
  return sandbox.App.core;
}

// Fixed clock: 2026-10-14 12:00 local time.
const NOON = new Date(2026, 9, 14, 12, 0, 0).getTime();

function makeStore(core, opts = {}) {
  let t = opts.now != null ? opts.now : NOON;
  let n = 0;
  const store = core.createStore({
    state: opts.state || core.schema.createEmptyState(),
    actions: core.actions,
    now: () => t,
    newId: () => 'id' + (++n),
    limits: opts.limits || {},
  });
  store.setNow = (v) => { t = v; };
  return store;
}

// Plain-JSON copy: vm-context objects have a different Object.prototype, which
// assert.deepStrictEqual treats as unequal to test-side literals.
const plain = (v) => JSON.parse(JSON.stringify(v));

module.exports = { loadCore, makeStore, NOON, plain };
