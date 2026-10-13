/* Settings view — currency (the one optional feature this product includes, cheap
 * and common among competitors), a quick stats summary, and a reset-all-data danger
 * zone. Theme toggle and backup export/import live in the header (#app-controls,
 * see app_src/index.html + main.js) and apply globally, not duplicated here. */
(function () {
  window.App = window.App || { views: {}, nav: [] };
  var d = App.data;

  var CURRENCIES = [
    { code: 'USD', symbol: '$' }, { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' }, { code: 'CAD', symbol: 'CA$' },
    { code: 'AUD', symbol: 'AU$' },
  ];

  App.views.settings = {
    navLabel: 'Settings',
    render: function (root) {
      root.dataset.activeView = 'settings';
      var currentSymbol = App.store.get('currencySymbol', '$');
      var bills = App.store.get('bills', []);
      var debts = App.store.get('debts', []);
      var savings = App.store.get('savings', []);
      var waitlistPending = App.store.get('waitlist', []).filter(function (i) { return i.status === 'pending'; }).length;

      var options = CURRENCIES.map(function (c) {
        return '<option value="' + c.symbol + '"' + (c.symbol === currentSymbol ? ' selected' : '') + '>' +
          c.code + ' (' + c.symbol + ')</option>';
      }).join('');

      root.innerHTML =
        '<h1>Settings</h1>' +
        '<p class="sub">Your currency, a quick summary, and ways to reset your data.</p>' +
        '<div class="card">' +
        '  <div class="field"><label for="currencySel">Currency</label>' +
        '    <select id="currencySel">' + options + '</select></div>' +
        '</div>' +
        '<div class="card"><h2>Summary</h2>' +
        '  <div class="table-scroll"><table class="table"><thead><tr><th>Stat</th><th>Value</th></tr></thead><tbody>' +
        '    <tr><td>Bills tracked</td><td>' + bills.length + '</td></tr>' +
        '    <tr><td>Debts tracked</td><td>' + debts.length + '</td></tr>' +
        '    <tr><td>Savings goals</td><td>' + savings.length + '</td></tr>' +
        '    <tr><td>Items on wait list</td><td>' + waitlistPending + '</td></tr>' +
        '  </tbody></table></div>' +
        '</div>' +
        '<div class="card">' +
        '  <div class="banner warning">Resetting erases everything stored in this browser. Export a backup first if you want to keep it.</div>' +
        '  <button id="resetBtn" class="danger" type="button">Reset all data</button>' +
        '</div>' +
        '<dialog class="modal" id="resetDialog">' +
        '  <div class="modal-header">Reset all data?</div>' +
        '  <div class="modal-body">This erases every bill, debt, savings goal, and wait-list item stored in this browser. There is no undo.</div>' +
        '  <div class="modal-footer">' +
        '    <button id="cancelResetBtn" class="ghost" type="button">Cancel</button>' +
        '    <button id="confirmResetBtn" class="danger" type="button">Reset</button>' +
        '  </div>' +
        '</dialog>';

      root.querySelector('#currencySel').addEventListener('change', function (e) {
        App.store.set('currencySymbol', e.target.value);
        App.views.settings.render(root);
      });

      var dialog = root.querySelector('#resetDialog');
      root.querySelector('#resetBtn').addEventListener('click', function () { dialog.showModal(); });
      root.querySelector('#cancelResetBtn').addEventListener('click', function () { dialog.close(); });
      root.querySelector('#confirmResetBtn').addEventListener('click', function () {
        try { localStorage.clear(); } catch (e) {}
        dialog.close();
        location.reload();
      });
    },
  };
  App.nav.push('settings');
})();
