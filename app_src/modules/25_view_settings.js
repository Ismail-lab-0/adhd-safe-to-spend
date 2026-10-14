/* Settings — appearance, currency, backup/restore, and an honest explanation of
 * where the data lives. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  var C = App.core;
  var ui = App.ui;
  var h = ui.h;

  function counts(state) {
    var parts = [];
    var add = function (n, one, many) { if (n) parts.push(n + ' ' + (n === 1 ? one : many)); };
    add(state.bills.length, 'bill', 'bills');
    add(state.debts.length, 'debt', 'debts');
    add(state.goals.length, 'goal or envelope', 'goals and envelopes');
    add(state.waitlist.length, 'Wait List item', 'Wait List items');
    return parts.length ? parts.join(', ') : 'no bills, debts or goals';
  }

  function startImport(file) {
    App.backup.readFile(file).then(function (res) {
      var dropped = Object.keys(res.report.dropped).reduce(function (n, k) { return n + res.report.dropped[k]; }, 0);
      var current = App.store.getState();
      ui.openDialog({
        title: 'Restore this backup?',
        intro: 'The backup has ' + counts(res.state) + (res.state.balance.cents !== null ? ' and a balance of ' + C.money.formatCents(res.state.balance.cents, res.state.settings.currency) : '') +
          '. It will replace everything in the app right now (' + counts(current) + ').',
        body: dropped ? h('div', { class: 'banner warning' }, ui.icon('alert'), h('div', null, dropped + (dropped === 1 ? ' item' : ' items') + ' in the file couldn’t be read and will be skipped.')) : null,
        submitLabel: 'Replace and restore',
        danger: true,
        noAutofocus: true,
        onSubmit: function () {
          App.store.replace(res.state);
          ui.toast('Backup restored');
        },
      });
    }, function (err) {
      ui.openDialog({ title: 'Couldn’t restore', intro: err.message, submitLabel: 'OK', hideCancel: true });
    });
  }

  function eraseAll() {
    ui.confirmDialog({
      title: 'Erase everything?',
      message: 'This deletes every bill, debt, goal, Wait List item and your balance from this browser. It can’t be undone — export a backup first if you might want it back.',
      confirmLabel: 'Erase everything',
      danger: true,
    }).then(function (yes) {
      if (!yes) return;
      App.storage.clear();
      App.store.replace(C.schema.createEmptyState());
      App.router.show('dashboard');
      ui.toast('All data erased');
    });
  }

  function section(id, title, sub, body) {
    return h('section', { class: 'card settings-section', attrs: { 'aria-labelledby': id } },
      h('div', { class: 'settings-head' }, h('h2', { id: id, text: title }), sub ? h('p', { class: 'muted text-sm', text: sub }) : null),
      body);
  }

  App.views.settings = {
    navLabel: 'Settings',
    title: 'Settings',
    icon: 'settings',
    render: function (root) {
      var s = App.store.getState();
      root.appendChild(ui.pageHead('Settings'));

      var theme = ui.segmented('theme', [['system', 'Auto', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']], s.settings.theme, 'Theme');
      theme.id = 'themeControl';
      theme.addEventListener('change', function (e) { App.store.dispatch('setTheme', { theme: e.target.value }); });

      var currency = ui.field({
        name: 'currency', id: 'currencySelect', label: 'Currency',
        options: C.money.CURRENCIES.map(function (c) { return [c[0], c[1] + ' (' + c[0] + ')']; }), value: s.settings.currency,
        help: 'Changes how amounts are shown. Nothing is converted.',
      });
      currency.querySelector('select').addEventListener('change', function (e) {
        App.store.dispatch('setCurrency', { currency: e.target.value });
        ui.toast('Currency changed');
      });

      var fileInput = h('input', { type: 'file', id: 'importFile', accept: 'application/json,.json', class: 'visually-hidden', attrs: { tabindex: '-1', 'aria-hidden': 'true' } });
      fileInput.addEventListener('change', function () { if (fileInput.files[0]) startImport(fileInput.files[0]); fileInput.value = ''; });
      var last = s.settings.lastBackupAt;
      var hasData = s.bills.length || s.debts.length || s.goals.length || s.balance.cents !== null;
      var backupNote = last
        ? 'Last backup: ' + C.dates.label(last) + ' (' + C.dates.relative(last, App.store.today()).toLowerCase() + ').'
        : (hasData ? 'You haven’t made a backup yet.' : 'Nothing to back up yet.');

      root.appendChild(h('div', { class: 'settings-grid' },
        section('appearance-title', 'Appearance', null,
          h('div', { class: 'form' },
            h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Theme' }), theme,
              h('span', { class: 'help', text: 'Auto follows your device’s light or dark mode.' })),
            currency)),
        section('backup-title', 'Backup & restore', 'Save a copy of everything to a file — to keep it safe, or to move to another device or browser.',
          h('div', { class: 'form' },
            h('div', { class: 'banner ' + (last || !hasData ? 'info' : 'warning') }, ui.icon(last || !hasData ? 'info' : 'alert'), h('div', { text: backupNote })),
            h('div', { class: 'form-actions' },
              h('button', { type: 'button', class: 'btn btn-primary', id: 'exportBtn', on: { click: function () { App.backup.exportFile(); ui.toast('Backup saved to your downloads'); } } }, ui.icon('download'), 'Export backup'),
              h('button', { type: 'button', class: 'btn btn-secondary', id: 'importBtn', on: { click: function () { fileInput.click(); } } }, ui.icon('upload'), 'Restore from file'),
              fileInput))),
        section('privacy-title', 'Where your data lives', null,
          h('ul', { class: 'facts' },
            h('li', null, ui.icon('lock'), h('span', null, h('strong', { text: 'Only in this browser, on this device. ' }), 'No account, no bank connection, nothing sent anywhere.')),
            h('li', null, ui.icon('alert'), h('span', null, h('strong', { text: 'Clearing your browser’s data erases it. ' }), 'So does uninstalling the browser. Export a backup now and then.')),
            h('li', null, ui.icon('link'), h('span', null, h('strong', { text: 'Each browser keeps its own copy. ' }), 'Your phone and laptop don’t sync — use Export and Restore to move your data.')))),
        section('install-title', 'Use it like an app', null,
          h('ul', { class: 'facts' },
            h('li', null, ui.icon('today'), h('span', null, h('strong', { text: 'iPhone / iPad: ' }), 'open in Safari, tap Share, then “Add to Home Screen”.')),
            h('li', null, ui.icon('today'), h('span', null, h('strong', { text: 'Android / Chrome: ' }), 'open the browser menu (⋮), then “Install app” or “Add to Home screen”.')))),
        section('danger-title', 'Start over', null,
          h('div', { class: 'danger-row' },
            h('p', { class: 'muted text-sm', text: 'Delete everything in the app from this browser.' }),
            h('button', { type: 'button', class: 'btn btn-danger-quiet', id: 'eraseBtn', on: { click: eraseAll } }, ui.icon('trash'), 'Erase all data'))),
        h('p', { class: 'version muted text-xs', text: App.config.title + ' · ' + App.config.tagline + ' · v' + App.config.version + (App.config.demo ? ' · demo' : '') })));
    },
  };
  App.nav.push('settings');
})(typeof window !== 'undefined' ? window : globalThis);
