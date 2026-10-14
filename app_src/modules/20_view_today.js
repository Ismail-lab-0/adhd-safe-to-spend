/* Today — the home screen. Answers one question first and loudest: how much can
 * I safely spend before payday? Everything else on the page explains or feeds
 * that number: the breakdown (why it's this number), what's coming up before
 * payday, and a one-field quick log so the balance stays current. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  var C = App.core;
  var ui = App.ui;
  var h = ui.h;
  var quickKind = 'spend';

  /* ---------- dialogs shared with other views ---------- */
  function editBalance() {
    var s = App.store.getState();
    var d = ui.openDialog({
      title: 'Update your balance',
      intro: 'Type what your banking app shows right now. Overdrawn? Enter it with a minus sign, like -45.',
      submitLabel: 'Save balance',
      body: ui.field({ name: 'amount', label: 'Current balance', money: true, value: s.balance.cents === null ? '' : C.money.centsToInput(s.balance.cents), placeholder: '0.00', attrs: { inputmode: 'text' } }),
      onSubmit: function (form) {
        var ok = ui.dialogDispatch(form, 'setBalance', ui.readForm(form));
        if (ok) ui.toast('Balance updated');
        return ok;
      },
    });
    return d;
  }

  function editPayday() {
    var s = App.store.getState();
    var today = App.store.today();
    ui.openDialog({
      title: 'When do you get paid next?',
      intro: 'Bills due before this date are held back from your Safe to Spend number.',
      submitLabel: 'Save payday',
      body: h('div', { class: 'form' },
        ui.field({ name: 'next', label: 'Next payday', type: 'date', value: s.payday.next || '', attrs: { min: today } }),
        ui.field({
          name: 'cadence', label: 'How often', value: s.payday.cadence,
          options: [['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month'], ['irregular', 'It varies — I’ll update it each time']],
          help: 'When a payday passes, the next one is worked out for you (unless it varies).',
        })),
      onSubmit: function (form) {
        var ok = ui.dialogDispatch(form, 'setPayday', ui.readForm(form));
        if (ok) ui.toast('Payday saved');
        return ok;
      },
    });
  }
  App.dialogs = Object.assign(App.dialogs || {}, { editBalance: editBalance, editPayday: editPayday });

  /* ---------- pieces ---------- */
  function onboarding(s) {
    var steps = [
      { done: s.balance.cents !== null, label: 'Enter your balance', hint: 'From your banking app — no bank login.', run: editBalance },
      { done: !!s.payday.next, label: 'Set your next payday', hint: 'So we know how long the money needs to last.', run: editPayday },
      { done: s.bills.length > 0, label: 'Add your first bill', hint: 'Rent, phone, subscriptions — anything that must be paid.', run: function () { App.router.show('bills'); } },
    ];
    var remaining = steps.filter(function (x) { return !x.done; }).length;
    if (remaining === 0 || s.settings.onboardingDismissed) return null;
    return h('section', { class: 'card onboarding', attrs: { 'aria-labelledby': 'ob-title' } },
      h('div', { class: 'card-header' },
        h('div', null,
          h('h2', { id: 'ob-title' }, ui.icon('sparkle'), 'Get your number in 3 steps'),
          h('p', { class: 'muted text-sm', text: 'About a minute. Nothing leaves this device.' })),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Later', on: { click: function () { App.store.dispatch('dismissOnboarding'); } } })),
      h('ol', { class: 'steps' }, steps.map(function (st, i) {
        return h('li', { class: st.done ? 'done' : '' },
          h('span', { class: 'step-num', attrs: { 'aria-hidden': 'true' } }, st.done ? ui.icon('check') : String(i + 1)),
          h('div', { class: 'list-main' },
            h('div', { class: 'list-title', text: st.label }, st.done ? h('span', { class: 'visually-hidden', text: ' (done)' }) : null),
            h('div', { class: 'list-meta', text: st.hint })),
          st.done ? null : h('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: i === 2 ? 'Go to Bills' : 'Set', on: { click: st.run } }));
      })),
      App.config.demo ? h('div', { class: 'ob-sample' },
        h('span', { class: 'muted text-sm', text: 'Just looking around?' }),
        h('button', { type: 'button', class: 'link-btn', text: 'Fill in example numbers', on: { click: App.loadSampleData } })) : null);
  }

  function showingOnboarding(s) {
    return !s.settings.onboardingDismissed && (s.balance.cents === null || !s.payday.next || !s.bills.length);
  }

  function hero(s, r) {
    var cur = function (c) { return ui.fmt(c); };
    var today = App.store.today();
    var paydayText = r.payday.source === 'payday'
      ? C.dates.label(r.payday.date)
      : 'Not set';

    var metaRow = h('div', { class: 'hero-meta' },
      h('button', { type: 'button', class: 'meta-btn', id: 'heroBalanceBtn', on: { click: editBalance } },
        ui.icon('wallet'),
        h('span', null, h('span', { class: 'meta-label', text: 'Balance' }),
          h('span', { class: 'meta-value num', text: r.hasBalance ? cur(r.balanceCents) : 'Add' })),
        s.balance.updatedOn ? h('span', { class: 'meta-sub', text: C.dates.relative(s.balance.updatedOn, today) === 'Today' ? 'updated today' : 'updated ' + C.dates.relative(s.balance.updatedOn, today).toLowerCase() }) : null),
      h('button', { type: 'button', class: 'meta-btn', id: 'heroPaydayBtn', on: { click: editPayday } },
        ui.icon('calendar'),
        h('span', null, h('span', { class: 'meta-label', text: 'Next payday' }),
          h('span', { class: 'meta-value', text: paydayText })),
        r.payday.source === 'payday' ? h('span', { class: 'meta-sub', text: C.dates.relative(r.payday.date, today).toLowerCase() }) : null));

    if (!r.hasBalance) {
      return h('section', { class: 'card hero hero-empty', attrs: { 'aria-labelledby': 'hero-label' } },
        h('p', { class: 'hero-eyebrow', id: 'hero-label', text: 'Safe to spend' }),
        h('p', { class: 'hero-number', text: '—', attrs: { 'aria-hidden': 'true' } }),
        h('p', { class: 'hero-sub', text: 'Enter your balance and this becomes the one number you need to check.' }),
        showingOnboarding(s) ? null : h('div', null, h('button', { type: 'button', class: 'btn btn-primary', on: { click: editBalance } }, ui.icon('wallet'), 'Enter your balance')),
        metaRow);
    }

    var negative = r.safeCents < 0;
    var eyebrow = r.payday.source === 'payday' ? 'Safe to spend until payday' : 'Safe to spend · next 30 days';
    var sub;
    if (negative) sub = 'Your commitments before payday are ' + cur(-r.safeCents) + ' more than your balance. Check what’s coming up below.';
    else if (r.safeCents === 0) sub = 'Everything you have is already spoken for until payday.';
    else sub = 'About ' + cur(r.perDayCents) + ' a day for the next ' + r.daysLeft + (r.daysLeft === 1 ? ' day.' : ' days.');

    return h('section', { class: 'card hero' + (negative ? ' is-negative' : ''), attrs: { 'aria-labelledby': 'hero-label' } },
      h('p', { class: 'hero-eyebrow', id: 'hero-label', text: eyebrow }),
      h('p', { class: 'hero-number num', id: 'safeToSpend', attrs: { 'aria-live': 'polite' } },
        negative ? '−' + cur(-r.safeCents) : cur(r.safeCents)),
      h('p', { class: 'hero-sub', text: sub }),
      breakdown(r),
      metaRow);
  }

  function breakdown(r) {
    var rows = [
      { key: 'bills', label: 'Bills before payday', cents: r.billsDueCents, note: r.dueItems.length ? r.dueItems.length + (r.dueItems.length === 1 ? ' payment' : ' payments') : null },
      { key: 'setaside', label: 'Set aside for bigger bills', cents: r.setAsideCents, note: r.setAsideItems.length ? r.setAsideItems.map(function (i) { return i.bill.name; }).join(', ') : null },
      { key: 'savings', label: 'In savings & envelopes', cents: r.savingsCents },
    ];
    var committed = r.billsDueCents + r.setAsideCents + r.savingsCents;
    var total = Math.max(r.balanceCents, committed, 1);
    var safe = Math.max(0, r.safeCents);
    var bar = h('div', { class: 'bar', attrs: { role: 'img', 'aria-label': 'How your balance is split: ' + rows.map(function (x) { return x.label + ' ' + ui.fmt(x.cents); }).join(', ') + ', safe to spend ' + ui.fmt(r.safeCents) } },
      rows.concat([{ key: 'safe', cents: safe }]).filter(function (x) { return x.cents > 0; }).map(function (x) {
        return h('span', { class: 'seg seg-' + x.key, style: 'flex-grow:' + (x.cents / total).toFixed(4) });
      }));

    return h('details', { class: 'breakdown disclosure' },
      h('summary', null, ui.icon('chevron'), 'How we got this number'),
      bar,
      h('dl', { class: 'equation' },
        h('div', { class: 'eq-row' }, h('dt', null, h('span', { class: 'swatch swatch-balance' }), 'Your balance'), h('dd', { class: 'num', text: ui.fmt(r.balanceCents) })),
        rows.map(function (x) {
          return h('div', { class: 'eq-row' },
            h('dt', null, h('span', { class: 'swatch seg-' + x.key }), h('span', null, '− ' + x.label, x.note ? h('small', { text: x.note }) : null)),
            h('dd', { class: 'num', text: ui.fmt(x.cents) }));
        }),
        h('div', { class: 'eq-row eq-total' }, h('dt', null, h('span', { class: 'swatch seg-safe' }), '= Safe to spend'), h('dd', { class: 'num', text: ui.fmt(r.safeCents) }))));
  }

  function quickLog(s) {
    var form = h('form', { class: 'form', id: 'quickLogForm' },
      ui.segmented('kind', [['spend', 'Spent', 'arrowDown'], ['income', 'Got paid', 'arrowUp']], quickKind, 'Type of entry'),
      h('div', { class: 'quick-row' },
        ui.field({ name: 'amount', id: 'quickAmount', label: 'Amount', money: true, placeholder: '0.00' }),
        ui.field({ name: 'label', id: 'quickNote', label: 'What for', optional: true, placeholder: quickKind === 'spend' ? 'e.g. Groceries' : 'e.g. Paycheck', attrs: { maxlength: 60, enterkeyhint: 'done' } })),
      h('button', { type: 'submit', class: 'btn btn-primary btn-block', id: 'quickLogBtn', text: quickKind === 'spend' ? 'Log spending' : 'Log income' }));
    form.addEventListener('change', function (e) {
      if (e.target.name === 'kind') {
        quickKind = e.target.value;
        form.querySelector('#quickLogBtn').textContent = quickKind === 'spend' ? 'Log spending' : 'Log income';
        form.querySelector('#quickNote').placeholder = quickKind === 'spend' ? 'e.g. Groceries' : 'e.g. Paycheck';
      }
    });
    ui.bindForm(form, 'logActivity', {
      onDone: function (entry) {
        ui.toast((entry.kind === 'income' ? 'Added ' : 'Logged ') + ui.fmt(entry.amountCents) + ' · balance now ' + ui.fmt(App.store.getState().balance.cents), { undo: true });
        var a = document.getElementById('quickAmount');
        if (a) a.focus();
      },
    });
    return h('section', { class: 'card', attrs: { 'aria-labelledby': 'ql-title' } },
      h('div', { class: 'card-header' }, h('h2', { id: 'ql-title', text: 'Quick log' }),
        h('span', { class: 'hint', text: 'Keeps your balance current' })),
      form);
  }

  function comingUp(s, r) {
    var today = App.store.today();
    var items = r.dueItems.slice(0, 6);
    var header = h('div', { class: 'card-header' },
      h('h2', { id: 'cu-title', text: r.payday.source === 'payday' ? 'Before payday' : 'Next 30 days' }),
      h('button', { type: 'button', class: 'link-btn', on: { click: function () { App.router.show('bills'); } } }, 'All bills', ui.icon('chevron')));
    if (!s.bills.length) {
      return h('section', { class: 'card', attrs: { 'aria-labelledby': 'cu-title' } }, header,
        ui.emptyState('bills', 'No bills yet', 'Add the things that have to be paid, and they’ll be held back from your number automatically.',
          h('button', { type: 'button', class: 'btn btn-secondary', on: { click: function () { App.router.show('bills'); } } }, ui.icon('plus'), 'Add a bill')));
    }
    if (!items.length) {
      return h('section', { class: 'card', attrs: { 'aria-labelledby': 'cu-title' } }, header,
        ui.emptyState('check', 'Nothing due before payday', 'Every bill is either paid or due after your next payday.'));
    }
    return h('section', { class: 'card card-flush', attrs: { 'aria-labelledby': 'cu-title' } }, header,
      h('ul', { class: 'list' }, items.map(function (it) {
        var status = it.overdue
          ? h('span', { class: 'pill pill-danger', text: 'Overdue' })
          : h('span', { text: C.dates.relative(it.date, today) });
        return h('li', { class: 'list-item' },
          ui.dateChip(it.date, it.overdue),
          h('div', { class: 'list-main' },
            h('div', { class: 'list-title', text: it.bill.name }),
            h('div', { class: 'list-meta' }, status, !it.isCurrent ? h('span', { class: 'pill', text: 'Repeats' }) : null)),
          h('div', { class: 'list-amount', text: ui.fmt(it.amountCents) }),
          it.isCurrent
            ? h('button', {
              type: 'button', class: 'paid-toggle', attrs: { 'aria-pressed': 'false', 'aria-label': 'Mark ' + it.bill.name + ' paid' },
              on: { click: function () { App.store.dispatch('setBillPaid', { id: it.bill.id, paid: true }); ui.toast(it.bill.name + ' marked paid', { undo: true }); } },
            }, ui.icon('check'), 'Paid')
            : h('span', { class: 'paid-spacer', attrs: { 'aria-hidden': 'true' } }));
      })),
      r.dueItems.length > items.length ? h('p', { class: 'list-foot muted text-sm', text: '+ ' + (r.dueItems.length - items.length) + ' more before payday' }) : null);
  }

  var KIND_META = {
    spend: { icon: 'arrowDown', sign: '−', label: 'Spent' },
    income: { icon: 'arrowUp', sign: '+', label: 'Income' },
    bill_paid: { icon: 'bills', sign: '−', label: 'Bill paid' },
    waitlist_bought: { icon: 'waitlist', sign: '−', label: 'From Wait List' },
  };

  function activity(s) {
    var today = App.store.today();
    var items = s.activity.slice(0, 6);
    var body = items.length
      ? h('ul', { class: 'list' }, items.map(function (a) {
        var m = KIND_META[a.kind];
        var removable = a.kind === 'spend' || a.kind === 'income';
        return h('li', { class: 'list-item' },
          h('span', { class: 'activity-icon act-' + a.kind }, ui.icon(m.icon)),
          h('div', { class: 'list-main' },
            h('div', { class: 'list-title', text: a.label }),
            h('div', { class: 'list-meta', text: m.label + ' · ' + C.dates.relative(a.date, today) })),
          h('div', { class: 'list-amount' + (a.kind === 'income' ? ' is-income' : ''), text: m.sign + ui.fmt(a.amountCents) }),
          removable ? h('button', {
            type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Delete ' + a.label + ' entry' },
            on: { click: function () { App.store.dispatch('deleteActivity', { id: a.id }); ui.toast('Entry deleted · balance restored', { undo: true }); } },
          }, ui.icon('trash')) : h('span', { class: 'paid-spacer', attrs: { 'aria-hidden': 'true' } }));
      }))
      : h('p', { class: 'muted text-sm activity-empty', text: 'Spending, income and paid bills you log will show up here.' });
    return h('section', { class: 'card card-flush', attrs: { 'aria-labelledby': 'ra-title' } },
      h('div', { class: 'card-header' }, h('h2', { id: 'ra-title', text: 'Recent' })), body);
  }

  function alerts(s, r) {
    var out = [];
    if (App.bootProblem) out.push(App.bootProblem());
    if (r.payday.stale) {
      out.push(h('div', { class: 'banner warning', attrs: { role: 'status' } }, ui.icon('calendar'),
        h('div', null, h('strong', { text: 'Your payday has passed' }), 'Set the next one so your number covers the right days. ',
          h('button', { type: 'button', class: 'link-btn', text: 'Set payday', on: { click: editPayday } }))));
    }
    if (r.overdueCount > 0) {
      out.push(h('div', { class: 'banner error', attrs: { role: 'status' } }, ui.icon('alert'),
        h('div', null, h('strong', { text: r.overdueCount === 1 ? '1 bill is overdue' : r.overdueCount + ' bills are overdue' }),
          'It’s still counted in your number until you mark it paid.')));
    }
    return out;
  }

  function wrap(cls, node) { return node ? h('div', { class: cls }, node) : null; }

  App.views.dashboard = {
    navLabel: 'Today',
    title: 'Today',
    icon: 'today',
    render: function (root) {
      var s = App.store.getState();
      var today = App.store.today();
      var r = C.safeToSpend.compute(s, today);
      var d = today.split('-');
      var long = new Date(+d[0], +d[1] - 1, +d[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

      root.appendChild(ui.pageHead('Today', long));
      root.appendChild(h('div', { class: 'today-grid' },
        h('div', { class: 'stack today-main' },
          alerts(s, r).map(function (b) { return h('div', { class: 'o-alert' }, b); }),
          wrap('o-onboarding', onboarding(s)),
          h('div', { class: 'o-hero' }, hero(s, r)),
          h('div', { class: 'o-due' }, comingUp(s, r))),
        h('div', { class: 'stack today-side' },
          h('div', { class: 'o-quick' }, quickLog(s)),
          h('div', { class: 'o-activity' }, activity(s)))));
    },
  };
  App.nav.push('dashboard');
})(typeof window !== 'undefined' ? window : globalThis);
