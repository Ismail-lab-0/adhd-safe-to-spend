/* Debt view — snowball (smallest balance first) or avalanche (highest rate first)
 * payoff order, chosen by the buyer rather than fixed. */
(function () {
  window.App = window.App || { views: {}, nav: [] };
  var d = App.data;

  App.views.debt = {
    navLabel: 'Debt',
    render: function (root) {
      root.dataset.activeView = 'debt';
      var debts = App.store.get('debts', []);
      var strategy = App.store.get('debtStrategy', 'snowball');
      var ordered = d.debtPayoffOrder(debts, strategy);

      root.innerHTML =
        '<h1>Debt</h1>' +
        '<p class="sub">A clear payoff order instead of guessing which one to tackle.</p>' +
        '<div class="card">' +
        '  <div class="row">' +
        '    <input id="debtName" type="text" placeholder="e.g. Credit card" aria-label="Debt name">' +
        '    <input id="debtBalance" type="number" step="0.01" placeholder="Balance" aria-label="Balance" style="max-width:120px">' +
        '    <input id="debtRate" type="number" step="0.1" placeholder="Rate %" aria-label="Interest rate" style="max-width:90px">' +
        '    <button id="addDebtBtn" type="button">Add</button>' +
        '  </div>' +
        '  <div class="field" style="margin-top:var(--space-3)"><label for="strategySel">Payoff strategy</label>' +
        '    <select id="strategySel">' +
        '      <option value="snowball"' + (strategy === 'snowball' ? ' selected' : '') + '>Snowball — smallest balance first</option>' +
        '      <option value="avalanche"' + (strategy === 'avalanche' ? ' selected' : '') + '>Avalanche — highest interest rate first</option>' +
        '    </select></div>' +
        '</div>' +
        '<div class="card"><h2>Payoff order</h2>' +
        (ordered.length
          ? '<div class="table-scroll"><table class="table"><thead><tr><th>#</th><th>Debt</th><th>Balance</th><th>Rate</th><th>Record payment</th><th></th></tr></thead><tbody id="debtBody"></tbody></table></div>'
          : '<div class="empty-state"><strong>No debts added</strong>Add one above to see a payoff order.</div>') +
        '</div>';

      if (ordered.length) {
        var tbody = root.querySelector('#debtBody');
        ordered.forEach(function (debt, i) {
          var tr = document.createElement('tr');
          tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + d.escapeHtml(debt.name) + '</td>' +
            '<td>' + d.formatMoney(debt.balance) + '</td><td>' + (debt.rate || 0) + '%</td>';
          var payTd = document.createElement('td');
          var payInput = document.createElement('input');
          payInput.type = 'number'; payInput.step = '0.01'; payInput.placeholder = 'Amount';
          payInput.style.maxWidth = '100px';
          payInput.setAttribute('aria-label', 'Payment amount for ' + debt.name);
          var payBtn = document.createElement('button');
          payBtn.type = 'button'; payBtn.textContent = 'Pay';
          payBtn.addEventListener('click', function () {
            var amt = parseFloat(payInput.value);
            if (!isFinite(amt) || amt <= 0) return;
            debt.balance = Math.max(0, debt.balance - amt);
            var payments = App.store.get('debtPayments', []);
            payments.push({ id: d.uid(), debtId: debt.id, amount: amt, date: new Date().toISOString().slice(0, 10) });
            App.store.set('debtPayments', payments);
            App.store.set('debts', debts);
            App.views.debt.render(root);
          });
          payTd.appendChild(payInput);
          payTd.appendChild(payBtn);
          tr.appendChild(payTd);
          var delTd = document.createElement('td');
          var delBtn = document.createElement('button');
          delBtn.type = 'button'; delBtn.className = 'ghost'; delBtn.textContent = 'Remove';
          delBtn.addEventListener('click', function () {
            debts.splice(debts.indexOf(debt), 1);
            App.store.set('debts', debts);
            App.views.debt.render(root);
          });
          delTd.appendChild(delBtn);
          tr.appendChild(delTd);
          tbody.appendChild(tr);
        });
      }

      root.querySelector('#strategySel').addEventListener('change', function (e) {
        App.store.set('debtStrategy', e.target.value);
        App.views.debt.render(root);
      });

      root.querySelector('#addDebtBtn').addEventListener('click', function () {
        var name = root.querySelector('#debtName').value.trim();
        var balance = parseFloat(root.querySelector('#debtBalance').value);
        var rate = parseFloat(root.querySelector('#debtRate').value);
        if (!name || !isFinite(balance)) return;
        debts.push({ id: d.uid(), name: name, balance: balance, rate: isFinite(rate) ? rate : 0 });
        App.store.set('debts', debts);
        App.views.debt.render(root);
      });
    },
  };
  App.nav.push('debt');
})();
