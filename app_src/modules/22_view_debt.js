/* Debt — list debts with balance, rate and minimum payment, choose snowball or
 * avalanche, and see the order to pay them off in, with one clear "focus" debt.
 * A debt's minimum payment can be put on the Bills list so it counts in Safe to
 * Spend like every other commitment. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  var C = App.core;
  var ui = App.ui;
  var h = ui.h;

  var STRATEGY = {
    snowball: { label: 'Snowball', icon: 'sparkle', text: 'Smallest balance first. Each debt you clear frees up money and keeps you going.' },
    avalanche: { label: 'Avalanche', icon: 'debt', text: 'Highest interest rate first. You pay the least interest overall.' },
  };

  function debtFields(v) {
    return [
      ui.field({ name: 'name', id: v.ids && v.ids.name, label: 'Name', placeholder: 'e.g. Visa card', value: v.name, attrs: { maxlength: 60 } }),
      h('div', { class: 'form-row' },
        ui.field({ name: 'balance', label: 'Balance owed', money: true, placeholder: '0.00', value: v.balance }),
        ui.field({ name: 'apr', label: 'Interest rate %', placeholder: 'Optional, e.g. 22.9', value: v.apr, attrs: { inputmode: 'decimal' } })),
      ui.field({ name: 'minPayment', label: 'Minimum monthly payment', optional: true, money: true, placeholder: '0.00', value: v.minPayment }),
    ];
  }

  function editDebt(d) {
    var del = h('button', { type: 'button', class: 'btn btn-danger-quiet', text: 'Delete' });
    var dlg = ui.openDialog({
      title: 'Edit debt',
      intro: 'Update the balance whenever you get a statement — interest isn’t calculated for you.',
      submitLabel: 'Save changes',
      secondary: del,
      body: h('div', { class: 'form' }, debtFields({
        name: d.name, balance: C.money.centsToInput(d.balanceCents),
        apr: d.aprBps ? String(d.aprBps / 100) : '', minPayment: d.minPaymentCents ? C.money.centsToInput(d.minPaymentCents) : '',
      })),
      onSubmit: function (form) {
        var ok = ui.dialogDispatch(form, 'updateDebt', Object.assign(ui.readForm(form), { id: d.id }));
        if (ok) ui.toast('Debt updated', { undo: true });
        return ok;
      },
    });
    del.addEventListener('click', function () {
      dlg.close();
      App.store.dispatch('deleteDebt', { id: d.id });
      ui.toast('“' + d.name + '” deleted', { undo: true });
    });
  }

  function addPaymentBill(d) {
    ui.openDialog({
      title: 'Add payment to Bills',
      intro: 'A monthly bill of ' + ui.fmt(d.minPaymentCents) + ' for “' + d.name + '” will be added, so it’s held back from your Safe to Spend number.',
      submitLabel: 'Add to Bills',
      body: ui.field({ name: 'dueDate', label: 'Next payment due', type: 'date', value: '' }),
      onSubmit: function (form) {
        var ok = ui.dialogDispatch(form, 'addDebtPaymentBill', { id: d.id, dueDate: ui.readForm(form).dueDate });
        if (ok) ui.toast('Added to Bills', { undo: true });
        return ok;
      },
    });
  }

  function debtRow(d, index, linked) {
    var done = d.balanceCents === 0;
    var meta = [];
    if (d.aprBps) meta.push(h('span', { text: C.debt.formatApr(d.aprBps) + ' APR' }));
    if (d.minPaymentCents) meta.push(h('span', { text: ui.fmt(d.minPaymentCents) + '/mo minimum' }));
    var link = null;
    if (!done && linked) link = h('span', { class: 'pill pill-success' }, ui.icon('check'), 'On your Bills');
    else if (!done && d.minPaymentCents) {
      link = h('button', { type: 'button', class: 'btn btn-secondary btn-sm', on: { click: function () { addPaymentBill(d); } } }, ui.icon('plus'), 'Add payment to Bills');
    }
    var focus = index === 0 && !done;
    return h('li', { class: 'debt-row' + (focus ? ' is-focus' : '') + (done ? ' is-done' : '') },
      h('span', { class: 'debt-rank', attrs: { 'aria-label': done ? 'Paid off' : 'Pay off ' + ordinal(index + 1) } },
        done ? ui.icon('check') : String(index + 1)),
      h('div', { class: 'list-main' },
        focus ? h('div', { class: 'focus-label' }, ui.icon('flag'), 'Pay this first') : null,
        h('div', { class: 'list-title', text: d.name }),
        h('div', { class: 'list-meta' }, done ? h('span', { class: 'pill pill-success', text: 'Paid off' }) : meta)),
      h('div', { class: 'list-amount debt-balance', text: ui.fmt(d.balanceCents) }),
      h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Edit ' + d.name }, on: { click: function () { editDebt(d); } } }, ui.icon('edit')),
      link ? h('div', { class: 'debt-link' }, link) : null);
  }

  function ordinal(n) { return ['first', 'second', 'third'][n - 1] || ('number ' + n); }

  App.views.debt = {
    navLabel: 'Debt',
    title: 'Debt',
    icon: 'debt',
    render: function (root) {
      var s = App.store.getState();
      var order = C.debt.payoffOrder(s.debts, s.debtStrategy);
      var totals = C.debt.totals(s.debts);
      var linkedIds = {};
      s.bills.forEach(function (b) { if (b.debtId) linkedIds[b.debtId] = true; });

      root.appendChild(ui.pageHead('Debt', 'Pick a payoff order, pay the minimum on everything, and put anything extra on one debt at a time.'));

      var stratForm = h('form', { class: 'strategy', id: 'strategyForm' },
        ui.segmented('strategy', [['snowball', 'Snowball', 'sparkle'], ['avalanche', 'Avalanche', 'debt']], s.debtStrategy, 'Payoff order'),
        h('p', { class: 'muted text-sm', id: 'strategyHelp', text: STRATEGY[s.debtStrategy].text }));
      stratForm.addEventListener('change', function (e) {
        App.store.dispatch('setDebtStrategy', { strategy: e.target.value });
      });

      var form = h('form', { class: 'form', id: 'addDebtForm' }, debtFields({ ids: { name: 'debtName' } }),
        h('button', { type: 'submit', class: 'btn btn-primary btn-block', id: 'addDebtBtn' }, ui.icon('plus'), 'Add debt'));
      ui.bindForm(form, 'addDebt', { onDone: function (d) { ui.toast('Added ' + d.name); } });

      var list = order.length
        ? h('section', { class: 'card', attrs: { 'aria-labelledby': 'order-title' } },
          h('div', { class: 'card-header' }, h('h2', { id: 'order-title', text: 'Your payoff order' })),
          stratForm,
          h('ol', { class: 'debt-list' }, order.map(function (d, i) { return debtRow(d, i, linkedIds[d.id]); })))
        : h('section', { class: 'card' }, ui.emptyState('debt', 'No debts added',
          'If you have none — brilliant. Otherwise add cards, loans or buy-now-pay-later plans and get a clear order to tackle them in.'));

      root.appendChild(h('div', { class: 'page-grid' },
        h('div', { class: 'stats g-summary' },
          ui.stat('Total owed', ui.fmt(totals.balanceCents)),
          ui.stat('Minimums / month', ui.fmt(totals.minPaymentCents)),
          ui.stat('Debts', String(s.debts.filter(function (d) { return d.balanceCents > 0; }).length))),
        h('section', { class: 'card g-form', attrs: { 'aria-labelledby': 'add-debt-title' } },
          h('div', { class: 'card-header' }, h('h2', { id: 'add-debt-title', text: 'Add a debt' })), form),
        h('div', { class: 'g-list' }, list)));
    },
  };
  App.nav.push('debt');
})(typeof window !== 'undefined' ? window : globalThis);
