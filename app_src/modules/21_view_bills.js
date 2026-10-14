/* Bills — everything that has to be paid, on whatever schedule it really runs:
 * weekly, every 2 weeks, monthly, every N months (optionally set aside a little
 * at a time), or one time. Paid/unpaid is a one-tap toggle per bill.
 *
 * Element ids #billName/#billAmount/#billDue/#billCadence/#addBillBtn are the
 * spec.md acceptance smoke test's selectors — keep them. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  var C = App.core;
  var ui = App.ui;
  var h = ui.h;

  var CADENCE_OPTIONS = [
    ['monthly', 'Every month'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'],
    ['every_n_months', 'Every few months (e.g. insurance)'], ['one_off', 'One time only'],
  ];

  /** The bill form's fields. `ids` pins element ids (the add form's are fixed). */
  function billFields(v, ids) {
    ids = ids || {};
    var everyN = h('div', { class: 'form-row every-n' },
      ui.field({ name: 'everyN', id: ids.everyN, label: 'Every how many months?', type: 'number', value: v.everyN || 6, attrs: { min: 2, max: 24, inputmode: 'numeric' } }),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', name: 'setAside', id: ids.setAside, checked: v.setAside !== false }),
        h('span', null, 'Set a little aside each day', h('small', { text: 'So the full amount is ready when it’s due' }))));
    var cadence = ui.field({ name: 'cadence', id: ids.cadence, label: 'How often', options: CADENCE_OPTIONS, value: v.cadence || 'monthly' });
    function sync() { everyN.hidden = cadence.querySelector('select').value !== 'every_n_months'; }
    cadence.querySelector('select').addEventListener('change', sync);
    sync();
    return [
      ui.field({ name: 'name', id: ids.name, label: 'Bill name', placeholder: 'e.g. Rent', value: v.name, attrs: { maxlength: 60 } }),
      h('div', { class: 'form-row' },
        ui.field({ name: 'amount', id: ids.amount, label: 'Amount', money: true, placeholder: '0.00', value: v.amount }),
        ui.field({ name: 'dueDate', id: ids.dueDate, label: 'Next due date', type: 'date', value: v.dueDate || '' })),
      cadence,
      everyN,
    ];
  }

  function editBill(bill) {
    var del = h('button', { type: 'button', class: 'btn btn-danger-quiet', text: 'Delete' });
    var d = ui.openDialog({
      title: 'Edit bill',
      submitLabel: 'Save changes',
      secondary: del,
      body: h('div', { class: 'form' }, billFields({
        name: bill.name, amount: C.money.centsToInput(bill.amountCents), dueDate: bill.dueDate,
        cadence: bill.cadence, everyN: bill.everyN, setAside: bill.setAside,
      }), bill.debtId ? h('p', { class: 'help muted text-sm', text: 'This is the payment for a debt on your Debt page.' }) : null),
      onSubmit: function (form) {
        var ok = ui.dialogDispatch(form, 'updateBill', Object.assign(ui.readForm(form), { id: bill.id }));
        if (ok) ui.toast('Bill updated', { undo: true });
        return ok;
      },
    });
    del.addEventListener('click', function () {
      d.close();
      App.store.dispatch('deleteBill', { id: bill.id });
      ui.toast('“' + bill.name + '” deleted', { undo: true });
    });
  }

  function statusFor(bill, today, paydayEnd) {
    if (bill.paid) {
      var next = C.bills.nextAfter(bill, bill.dueDate);
      return h('span', { class: 'pill pill-success' }, ui.icon('check'), next ? 'Paid · next ' + C.dates.label(next).replace(/^\w+, /, '') : 'Paid');
    }
    var diff = C.dates.diffDays(today, bill.dueDate);
    if (diff < 0) return h('span', { class: 'pill pill-danger', text: 'Overdue · ' + C.dates.relative(bill.dueDate, today).toLowerCase() });
    if (diff <= 3) return h('span', { class: 'pill pill-warning', text: C.dates.relative(bill.dueDate, today) });
    if (C.dates.compare(bill.dueDate, paydayEnd) < 0) return h('span', { class: 'pill pill-info', text: 'Before payday' });
    return h('span', { text: C.dates.relative(bill.dueDate, today) });
  }

  function row(bill, today, paydayEnd) {
    var setAsideNote = bill.cadence === 'every_n_months' && bill.setAside
      ? h('span', { class: 'pill pill-plum', text: 'Setting aside ' + ui.fmt(C.bills.monthlyEquivalent(bill)) + '/mo' }) : null;
    var overdue = !bill.paid && C.dates.compare(bill.dueDate, today) < 0;
    return h('li', { class: 'list-item bill-row' + (bill.paid ? ' is-paid' : '') },
      ui.dateChip(bill.dueDate, overdue),
      h('div', { class: 'list-main' },
        h('div', { class: 'list-title', text: bill.name }),
        h('div', { class: 'list-meta' }, h('span', { text: C.bills.cadenceLabel(bill) }), statusFor(bill, today, paydayEnd), setAsideNote)),
      h('div', { class: 'list-amount', text: ui.fmt(bill.amountCents) }),
      h('div', { class: 'list-actions' },
        h('button', {
          type: 'button', class: 'paid-toggle', attrs: { 'aria-pressed': String(bill.paid), 'aria-label': bill.name + ' paid' },
          on: {
            click: function () {
              App.store.dispatch('setBillPaid', { id: bill.id, paid: !bill.paid });
              var after = C.bills.rollForward(App.store.getState().bills.filter(function (b) { return b.id === bill.id; })[0], App.store.today());
              var msg = bill.paid ? bill.name + ' marked unpaid'
                : (after.dueDate !== bill.dueDate ? bill.name + ' paid · next due ' + C.dates.label(after.dueDate) : bill.name + ' marked paid');
              ui.toast(msg, { undo: true });
            },
          },
        }, ui.icon('check'), h('span', { class: 'paid-text', text: 'Paid' })),
        h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Edit ' + bill.name }, on: { click: function () { editBill(bill); } } }, ui.icon('edit'))));
  }

  function group(title, bills, today, end, extraClass) {
    if (!bills.length) return null;
    return h('section', { class: 'bill-group' + (extraClass ? ' ' + extraClass : '') },
      h('h3', { class: 'group-title' }, title, h('span', { class: 'group-count', text: String(bills.length) })),
      h('ul', { class: 'list' }, bills.map(function (b) { return row(b, today, end); })));
  }

  App.views.bills = {
    navLabel: 'Bills',
    title: 'Bills',
    icon: 'bills',
    badge: function (s) {
      var t = App.store.today();
      return s.bills.filter(function (b) { b = C.bills.rollForward(b, t); return !b.paid && C.dates.compare(b.dueDate, t) < 0; }).length;
    },
    render: function (root) {
      var s = App.store.getState();
      var today = App.store.today();
      var r = C.safeToSpend.compute(s, today);
      var bills = s.bills.map(function (b) { return C.bills.rollForward(b, today); })
        .sort(function (a, b) { return C.dates.compare(a.dueDate, b.dueDate) || a.name.localeCompare(b.name); });
      var overdue = bills.filter(function (b) { return !b.paid && C.dates.compare(b.dueDate, today) < 0; });
      var upcoming = bills.filter(function (b) { return !b.paid && C.dates.compare(b.dueDate, today) >= 0; });
      var paid = bills.filter(function (b) { return b.paid; });
      var monthly = bills.reduce(function (sum, b) { return sum + C.bills.monthlyEquivalent(b); }, 0);
      var limit = App.store.limits.maxBills;
      var atLimit = limit != null && s.bills.length >= limit;

      root.appendChild(ui.pageHead('Bills', 'Everything that has to be paid. Unpaid bills due before payday are held back from your number.'));

      var form = h('form', { class: 'form', id: 'addBillForm' },
        billFields({}, { name: 'billName', amount: 'billAmount', dueDate: 'billDue', cadence: 'billCadence', everyN: 'billEveryN', setAside: 'billSetAside' }),
        atLimit ? h('div', { class: 'banner info' }, ui.icon('info'), h('div', null, 'The demo holds up to ' + limit + ' bills. The full version has no limit.')) : null,
        h('button', { type: 'submit', class: 'btn btn-primary btn-block', id: 'addBillBtn', disabled: atLimit }, ui.icon('plus'), 'Add bill'));
      ui.bindForm(form, 'addBill', {
        onDone: function (bill) {
          ui.toast('Added ' + bill.name);
          var n = document.getElementById('billName');
          if (n) n.focus();
        },
      });

      var listCard;
      if (!bills.length) {
        listCard = h('section', { class: 'card' }, ui.emptyState('bills', 'No bills yet',
          'Start with the big ones — rent, phone, car insurance. You can add the rest any time.'));
      } else {
        listCard = h('section', { class: 'card card-flush bills-list', attrs: { 'aria-label': 'Your bills' } },
          group('Overdue', overdue, today, r.payday.date, 'is-overdue'),
          group('Coming up', upcoming, today, r.payday.date),
          group('Paid', paid, today, r.payday.date));
      }

      root.appendChild(h('div', { class: 'page-grid' },
        h('div', { class: 'stats g-summary' },
          stat('Bills', String(bills.length) + (limit != null ? ' of ' + limit : '')),
          stat('About per month', ui.fmt(monthly)),
          stat(r.payday.source === 'payday' ? 'Due before payday' : 'Due in 30 days', ui.fmt(r.billsDueCents))),
        h('section', { class: 'card g-form', attrs: { 'aria-labelledby': 'add-bill-title' } },
          h('div', { class: 'card-header' }, h('h2', { id: 'add-bill-title', text: 'Add a bill' })), form),
        h('div', { class: 'g-list' }, listCard)));
    },
  };

  function stat(label, value) {
    return h('div', { class: 'stat' }, h('div', { class: 'stat-label', text: label }), h('div', { class: 'stat-value', text: value }));
  }
  ui.stat = stat;
  App.nav.push('bills');
})(typeof window !== 'undefined' ? window : globalThis);
