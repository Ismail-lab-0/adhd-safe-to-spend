/* Bills view — the "irregular/non-monthly bill cadences" essential feature (research:
 * market_coverage=majority among observed app-tier competitors, so built as table
 * stakes, not marketed as a differentiator). Supports weekly/biweekly/monthly/
 * every-N-months/one-off, and for every-N-months, an optional "set aside monthly"
 * toggle that spreads the cost (see App.data.effectiveAmount). */
(function () {
  window.App = window.App || { views: {}, nav: [] };
  var d = App.data;
  var DEMO_BILL_LIMIT = 3;

  function cadenceLabel(bill) {
    switch (bill.cadence) {
      case 'weekly': return 'Every week';
      case 'biweekly': return 'Every 2 weeks';
      case 'monthly': return 'Every month';
      case 'every_n_months': return 'Every ' + (bill.everyNMonths || 1) + ' months' +
        (bill.setAside ? ' (set aside monthly)' : '');
      case 'one_off': return 'One-off';
      default: return bill.cadence;
    }
  }

  App.views.bills = {
    navLabel: 'Bills',
    render: function (root) {
      root.dataset.activeView = 'bills';
      var bills = App.store.get('bills', []);

      root.innerHTML =
        '<h1>Bills</h1>' +
        '<p class="sub">Bills that come round however they really come round — not just monthly.</p>' +
        '<div class="card">' +
        '  <div class="field"><label for="billName">Bill name</label>' +
        '    <input id="billName" type="text" placeholder="e.g. Rent"></div>' +
        '  <div class="row">' +
        '    <div class="field" style="flex:1"><label for="billAmount">Amount</label>' +
        '      <input id="billAmount" type="number" step="0.01" placeholder="0.00"></div>' +
        '    <div class="field" style="flex:1"><label for="billDue">Next due date</label>' +
        '      <input id="billDue" type="date"></div>' +
        '  </div>' +
        '  <div class="field"><label for="billCadence">How often</label>' +
        '    <select id="billCadence">' +
        '      <option value="weekly">Every week</option>' +
        '      <option value="biweekly">Every 2 weeks</option>' +
        '      <option value="monthly" selected>Every month</option>' +
        '      <option value="every_n_months">Every N months</option>' +
        '      <option value="one_off">One-off</option>' +
        '    </select></div>' +
        '  <div class="row" id="everyNRow" hidden>' +
        '    <div class="field" style="flex:1"><label for="billEveryN">Every how many months</label>' +
        '      <input id="billEveryN" type="number" min="2" max="12" value="6"></div>' +
        '    <div class="field" style="flex:1;display:flex;align-items:flex-end;gap:6px;padding-bottom:10px">' +
        '      <input id="billSetAside" type="checkbox"><label for="billSetAside" style="margin:0">Set a bit aside each month</label></div>' +
        '  </div>' +
        '  <button id="addBillBtn" type="button">Add bill</button>' +
        '</div>' +
        '<div class="card"><h2>Your bills</h2><ul id="billList"></ul></div>';

      var cadenceSel = root.querySelector('#billCadence');
      var everyNRow = root.querySelector('#everyNRow');
      cadenceSel.addEventListener('change', function () {
        everyNRow.hidden = cadenceSel.value !== 'every_n_months';
      });

      renderList();

      function renderList() {
        var ul = root.querySelector('#billList');
        if (!bills.length) {
          ul.innerHTML = '';
          var empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.innerHTML = '<strong>No bills yet</strong>Add your first one above.';
          ul.replaceWith(empty);
          empty.id = 'billList';
          return;
        }
        ul.innerHTML = '';
        bills.slice().sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; })
          .forEach(function (bill) {
            var li = document.createElement('li');
            li.innerHTML = '<span>' + d.escapeHtml(bill.name) + ' &middot; ' +
              d.formatMoney(d.effectiveAmount(bill)) + ' &middot; ' + cadenceLabel(bill) +
              ' &middot; due ' + bill.dueDate + (bill.paid ? ' &middot; <strong>paid</strong>' : '') + '</span>';
            var actions = document.createElement('span');
            if (!bill.paid) {
              var payBtn = document.createElement('button');
              payBtn.type = 'button';
              payBtn.textContent = 'Mark paid';
              payBtn.addEventListener('click', function () {
                if (bill.cadence === 'one_off') {
                  bill.paid = true;
                } else {
                  bill.dueDate = d.nextDueDate(bill);
                  bill.paid = false;
                }
                App.store.set('bills', bills);
                renderList();
              });
              actions.appendChild(payBtn);
            }
            var delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'ghost';
            delBtn.textContent = 'Remove';
            delBtn.addEventListener('click', function () {
              bills.splice(bills.indexOf(bill), 1);
              App.store.set('bills', bills);
              renderList();
            });
            actions.appendChild(delBtn);
            li.appendChild(actions);
            ul.appendChild(li);
          });
      }

      root.querySelector('#addBillBtn').addEventListener('click', function () {
        if (window.APP_DEMO_MODE && bills.length >= DEMO_BILL_LIMIT) {
          alert('The demo is limited to ' + DEMO_BILL_LIMIT + ' bills. The full version has no limit.');
          return;
        }
        var name = root.querySelector('#billName').value.trim();
        var amount = parseFloat(root.querySelector('#billAmount').value);
        var dueDate = root.querySelector('#billDue').value;
        var cadence = cadenceSel.value;
        if (!name || !isFinite(amount) || !dueDate) return;
        var bill = { id: d.uid(), name: name, amount: amount, cadence: cadence, dueDate: dueDate, paid: false };
        if (cadence === 'every_n_months') {
          bill.everyNMonths = parseInt(root.querySelector('#billEveryN').value, 10) || 6;
          bill.setAside = root.querySelector('#billSetAside').checked;
        }
        bills.push(bill);
        App.store.set('bills', bills);
        root.querySelector('#billName').value = '';
        root.querySelector('#billAmount').value = '';
        root.querySelector('#billDue').value = '';
        renderList();
      });
    },
  };
  App.nav.push('bills');
})();
