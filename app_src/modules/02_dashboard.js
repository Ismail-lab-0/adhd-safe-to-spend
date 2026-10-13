/* Today (dashboard) view: the one safe-to-spend number, an account-balance input
 * (the one manual input the whole calc depends on — "type the balance from your
 * banking app", same pattern every competitor uses, no bank connection), today's
 * due/overdue bills at a glance, and an income entry log. */
(function () {
  window.App = window.App || { views: {}, nav: [] };
  var d = App.data;

  App.views.dashboard = {
    navLabel: 'Today',
    render: function (root) {
      root.dataset.activeView = 'dashboard';
      var balance = App.store.get('balance', 0);
      var bills = App.store.get('bills', []);
      var income = App.store.get('income', []);
      var safe = d.safeToSpend();

      var todayStr = new Date().toISOString().slice(0, 10);
      var dueSoon = bills
        .filter(function (b) { return !b.paid; })
        .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; })
        .slice(0, 5);

      var dueHtml = dueSoon.length
        ? dueSoon.map(function (b) {
            var overdue = b.dueDate < todayStr;
            return '<li><span>' + d.escapeHtml(b.name) +
              (overdue ? ' <span class="text-sm" style="color:var(--color-danger)">overdue</span>' : '') +
              '</span><span>' + d.formatMoney(d.effectiveAmount(b)) + ' &middot; ' + b.dueDate + '</span></li>';
          }).join('')
        : '';

      var incomeHtml = income.slice(-5).reverse().map(function (e) {
        return '<li><span>' + d.escapeHtml(e.label) + ' &middot; ' + e.date + '</span>' +
          '<span>' + d.formatMoney(e.amount) + '</span></li>';
      }).join('');

      root.innerHTML =
        '<h1>Today</h1>' +
        '<p class="sub">What\'s actually safe to spend, after bills and savings are already set aside.</p>' +
        '<div class="card">' +
        '  <div class="field" style="margin-bottom:var(--space-2)">' +
        '    <label for="balanceInput">Account balance</label>' +
        '    <input id="balanceInput" type="number" step="0.01" value="' + balance + '">' +
        '    <span class="help">Type the balance from your banking app — this never connects to a bank.</span>' +
        '  </div>' +
        '  <h2 style="margin:var(--space-3) 0 0">Safe to spend today</h2>' +
        '  <p style="font-family:var(--font-heading);font-size:2.25rem;margin:4px 0 0;' +
        (safe < 0 ? 'color:var(--color-danger)' : 'color:var(--color-primary)') + '">' +
        d.formatMoney(safe) + '</p>' +
        '</div>' +
        '<div class="grid-2">' +
        '  <div class="card">' +
        '    <h2>Due soon</h2>' +
        (dueHtml ? '<ul>' + dueHtml + '</ul>' :
          '<div class="empty-state"><strong>Nothing due</strong>Add a bill in the Bills tab.</div>') +
        '  </div>' +
        '  <div class="card">' +
        '    <h2>Income</h2>' +
        '    <div class="row">' +
        '      <input id="incLabel" type="text" placeholder="e.g. Paycheck" aria-label="Income label">' +
        '      <input id="incAmount" type="number" step="0.01" placeholder="Amount" aria-label="Income amount" style="max-width:110px">' +
        '      <button id="addIncomeBtn" type="button">Add</button>' +
        '    </div>' +
        (incomeHtml ? '<ul>' + incomeHtml + '</ul>' :
          '<div class="empty-state"><strong>No income logged yet</strong></div>') +
        '  </div>' +
        '</div>';

      root.querySelector('#balanceInput').addEventListener('change', function (e) {
        var v = parseFloat(e.target.value);
        App.store.set('balance', isFinite(v) ? v : 0);
        App.views.dashboard.render(root);
      });

      root.querySelector('#addIncomeBtn').addEventListener('click', function () {
        var label = root.querySelector('#incLabel').value.trim();
        var amount = parseFloat(root.querySelector('#incAmount').value);
        if (!label || !isFinite(amount)) return;
        income.push({ id: d.uid(), label: label, amount: amount, date: todayStr });
        App.store.set('income', income);
        App.store.set('balance', App.store.get('balance', 0) + amount);
        App.views.dashboard.render(root);
      });
    },
  };
  App.nav.push('dashboard');
})();
