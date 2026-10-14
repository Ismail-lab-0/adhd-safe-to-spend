/* Boot: build the store from storage, wire the shell (brand, demo banner, theme,
 * backup), then start the router. Runs last — after every module has registered.
 *
 * The full and demo builds differ ONLY by window.APP_DEMO_MODE (set by
 * tools/app_bundle.js): the demo uses its own storage key and caps bills at 3. */
(function (g) {
  var App = g.App;
  var C = App.core;
  var ui = App.ui;
  var h = ui.h;
  var DEMO = !!g.APP_DEMO_MODE;

  App.config = {
    title: 'Safe to Spend',
    tagline: 'ADHD Budget Planner',
    demo: DEMO,
    storageKey: DEMO ? 'adhd-safe-to-spend-demo:v1' : 'adhd-safe-to-spend:v1',
    limits: DEMO ? { maxBills: 3 } : {},
    version: '2.0.0',
  };

  /* ---------- storage + store ---------- */
  var storageProblem = null;
  var storage = C.createStorage({
    key: App.config.storageKey,
    onProblem: function (kind) {
      if (kind === 'quota') ui.toast('Couldn’t save — this browser’s storage is full. Export a backup from Settings.');
      if (kind === 'nearQuota') ui.toast('Storage is nearly full. Export a backup from Settings.');
    },
  });
  var loaded = storage.load();
  storageProblem = loaded.problem;

  App.store = C.createStore({ state: loaded.state, actions: C.actions, storage: storage, limits: App.config.limits });
  App.storage = storage;

  App.bootProblem = function () {
    if (!storageProblem) return null;
    var msg = {
      unavailable: ['Saving is turned off in this browser', 'Your entries will disappear when you close this tab. Private-browsing mode often causes this — open the app in a normal window.'],
      corrupt: ['We couldn’t read your saved data', 'A copy was kept safely on this device and the app started fresh. If you have a backup file, restore it from Settings.'],
      newer: ['This data was saved by a newer version', 'A copy was kept safely. Reload the page to get the latest version of the app.'],
      partial: ['Some saved items couldn’t be read', 'Everything readable was loaded; the original was kept as a copy on this device.'],
    }[storageProblem];
    return h('div', { class: 'banner ' + (storageProblem === 'partial' ? 'warning' : 'error'), attrs: { role: 'alert' } }, ui.icon('alert'),
      h('div', null, h('strong', { text: msg[0] }), msg[1], ' ',
        h('button', { type: 'button', class: 'link-btn', text: 'Dismiss', on: { click: function () { storageProblem = null; App.router.refresh(); } } })));
  };

  // Paid bills whose date has passed move to their next cycle — at boot, and
  // whenever the app comes back to the foreground on a new day.
  var lastRollDay = null;
  function rollIfNewDay() {
    var today = App.store.today();
    if (today === lastRollDay) return;
    lastRollDay = today;
    var before = JSON.stringify(App.store.getState().bills);
    var after = App.store.getState().bills.map(function (b) { return C.bills.rollForward(b, today); });
    if (JSON.stringify(after) !== before) App.store.dispatch('rollBills');
    else if (App.router.current()) App.router.refresh();
  }

  /* ---------- theme ---------- */
  var mql = g.matchMedia ? g.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    var pref = App.store.getState().settings.theme;
    var resolved = pref === 'system' ? (mql && mql.matches ? 'dark' : 'light') : pref;
    document.documentElement.setAttribute('data-theme', resolved);
  }
  if (mql && mql.addEventListener) mql.addEventListener('change', applyTheme);
  App.store.subscribe(applyTheme);
  applyTheme();

  /* ---------- backup ---------- */
  App.backup = {
    exportFile: function () {
      var state = App.store.getState();
      var payload = Object.assign({ app: 'adhd-safe-to-spend', exportedAt: new Date().toISOString() }, state);
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'safe-to-spend-backup-' + App.store.today() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      App.store.dispatch('markBackedUp');
    },
    /** Reads a File -> Promise<{state, report}> ; rejects with a user-facing message. */
    readFile: function (file) {
      return new Promise(function (resolve, reject) {
        if (!file) return reject(new Error('No file chosen.'));
        if (file.size > 5 * 1024 * 1024) return reject(new Error('That file is too large to be a backup from this app.'));
        var r = new FileReader();
        r.onerror = function () { reject(new Error('That file couldn’t be read.')); };
        r.onload = function () {
          var parsed;
          try { parsed = JSON.parse(r.result); } catch (e) { return reject(new Error('That file isn’t a backup from this app (it isn’t valid JSON).')); }
          try { resolve(C.schema.sanitize(parsed)); } catch (e) {
            reject(new Error(e.message === 'newer'
              ? 'That backup was made by a newer version of the app. Reload to update, then try again.'
              : 'That file isn’t a backup from this app.'));
          }
        };
        r.readAsText(file);
      });
    },
  };

  /* ---------- demo sample data ---------- */
  // Example numbers for the public demo only, clearly labelled as examples.
  App.loadSampleData = function () {
    var t = App.store.today();
    var d = C.dates;
    var st = App.store;
    st.dispatch('setBalance', { amount: '2140' });
    st.dispatch('setPayday', { next: d.addDays(t, 9), cadence: 'biweekly' });
    st.dispatch('addBill', { name: 'Rent', amount: '1150', dueDate: d.addDays(t, 4), cadence: 'monthly' });
    st.dispatch('addBill', { name: 'Phone', amount: '45', dueDate: d.addDays(t, -1), cadence: 'monthly' });
    st.dispatch('addBill', { name: 'Car insurance', amount: '540', dueDate: d.addMonths(t, 3), cadence: 'every_n_months', everyN: '6', setAside: true });
    var card = st.dispatch('addDebt', { name: 'Credit card', balance: '1860', apr: '24.99', minPayment: '55' });
    st.dispatch('addDebt', { name: 'Store card', balance: '420', apr: '29.9', minPayment: '25' });
    st.dispatch('addDebt', { name: 'Car loan', balance: '6200', apr: '7.4', minPayment: '210' });
    st.dispatch('addGoal', { name: 'Emergency fund', kind: 'goal', target: '1000', saved: '150' });
    st.dispatch('addGoal', { name: 'Birthday gifts', kind: 'envelope', saved: '40' });
    st.dispatch('addWait', { name: 'Noise-cancelling headphones', price: '179' });
    st.dispatch('logActivity', { kind: 'spend', amount: '23.40', label: 'Groceries' });
    st.dispatch('dismissOnboarding');
    void card;
    ui.toast('Example numbers loaded — try changing them');
  };

  /* ---------- shell ---------- */
  function brand() {
    return [ui.brandMark(), h('span', { class: 'brand-name' }, App.config.title, h('small', { text: App.config.tagline }))];
  }
  document.getElementById('sidebarBrand').replaceChildren.apply(document.getElementById('sidebarBrand'), brand());
  var top = document.getElementById('topbar');
  top.appendChild(h('div', { class: 'brand' }, brand()));
  document.getElementById('sidebarFoot').appendChild(h('div', { class: 'privacy' }, ui.icon('lock'),
    h('span', { text: 'Private by design: your numbers stay in this browser. No bank login, no account.' })));

  if (DEMO) {
    var banner = document.getElementById('demoBanner');
    banner.hidden = false;
    banner.appendChild(h('span', { text: 'You’re trying the free demo — up to 3 bills. The full version has no limits.' }));
  }

  g.addEventListener('pagehide', function () { storage.flush(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') storage.flush();
    else rollIfNewDay();
  });

  App.router.init();
  rollIfNewDay();
})(typeof window !== 'undefined' ? window : globalThis);
