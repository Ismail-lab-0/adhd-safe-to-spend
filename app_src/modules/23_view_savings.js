/* Savings — goals (save up to a target) and envelopes (money earmarked for a
 * purpose you'll spend from). Money in either is held back from Safe to Spend,
 * so saving it actually protects it. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  var C = App.core;
  var ui = App.ui;
  var h = ui.h;

  function goalFields(v, withKind) {
    var target = ui.field({ name: 'target', label: 'Target amount', money: true, placeholder: '0.00', value: v.target, optional: v.kind === 'envelope' });
    var out = [];
    if (withKind) {
      var seg = ui.segmented('kind', [['goal', 'Savings goal', 'flag'], ['envelope', 'Envelope', 'wallet']], v.kind || 'goal', 'Type');
      seg.classList.add('full');
      out.push(h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'Type' }), seg,
        h('span', { class: 'help', id: 'kindHelp', text: kindHelp(v.kind || 'goal') })));
      seg.addEventListener('change', function (e) {
        var k = e.target.value;
        seg.parentNode.querySelector('.help').textContent = kindHelp(k);
        var lbl = target.querySelector('label');
        lbl.replaceChildren('Target amount', k === 'envelope' ? h('span', { class: 'optional', text: ' (optional)' }) : '');
      });
    }
    out.push(ui.field({ name: 'name', id: v.ids && v.ids.name, label: 'Name', placeholder: 'e.g. Emergency fund', value: v.name, attrs: { maxlength: 60 } }));
    out.push(target);
    return out;
  }
  function kindHelp(kind) {
    return kind === 'envelope'
      ? 'Money set aside for something you’ll spend from — groceries, gifts, car repairs.'
      : 'Save up to a target, like an emergency fund or a trip.';
  }

  function moveMoney(goal, direction) {
    var title = direction === 'in' ? 'Add to ' + goal.name : 'Take out of ' + goal.name;
    ui.openDialog({
      title: title,
      intro: direction === 'in'
        ? 'This money stays in your account but is held back from Safe to Spend.'
        : 'This money goes back into your Safe to Spend number. ' + ui.fmt(goal.savedCents) + ' is in here now.',
      submitLabel: direction === 'in' ? 'Add money' : 'Take out',
      body: ui.field({ name: 'amount', label: 'Amount', money: true, placeholder: '0.00' }),
      onSubmit: function (form) {
        var ok = ui.dialogDispatch(form, 'moveGoalMoney', { id: goal.id, amount: ui.readForm(form).amount, direction: direction });
        if (ok) ui.toast(direction === 'in' ? 'Added to ' + goal.name : 'Taken out of ' + goal.name, { undo: true });
        return ok;
      },
    });
  }

  function editGoal(goal) {
    var del = h('button', { type: 'button', class: 'btn btn-danger-quiet', text: 'Delete' });
    var dlg = ui.openDialog({
      title: goal.kind === 'envelope' ? 'Edit envelope' : 'Edit goal',
      submitLabel: 'Save changes',
      secondary: del,
      body: h('div', { class: 'form' }, goalFields({ name: goal.name, kind: goal.kind, target: goal.targetCents ? C.money.centsToInput(goal.targetCents) : '' }, false)),
      onSubmit: function (form) {
        var ok = ui.dialogDispatch(form, 'updateGoal', Object.assign(ui.readForm(form), { id: goal.id, kind: goal.kind }));
        if (ok) ui.toast('Saved', { undo: true });
        return ok;
      },
    });
    del.addEventListener('click', function () {
      dlg.close();
      App.store.dispatch('deleteGoal', { id: goal.id });
      ui.toast('“' + goal.name + '” deleted — its money is back in Safe to Spend', { undo: true });
    });
  }

  function goalCard(goal) {
    var pct = goal.targetCents ? Math.min(100, Math.floor(goal.savedCents * 100 / goal.targetCents)) : null;
    var done = pct === 100;
    return h('li', { class: 'card goal-card' },
      h('div', { class: 'goal-top' },
        h('span', { class: 'pill ' + (goal.kind === 'envelope' ? 'pill-info' : 'pill-plum') }, ui.icon(goal.kind === 'envelope' ? 'wallet' : 'flag'), goal.kind === 'envelope' ? 'Envelope' : 'Goal'),
        h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Edit ' + goal.name }, on: { click: function () { editGoal(goal); } } }, ui.icon('edit'))),
      h('h3', { class: 'goal-name', text: goal.name }),
      h('div', { class: 'goal-amounts' },
        h('span', { class: 'goal-saved num', text: ui.fmt(goal.savedCents) }),
        goal.targetCents ? h('span', { class: 'muted num', text: 'of ' + ui.fmt(goal.targetCents) }) : null),
      pct !== null ? h('div', null,
        h('div', { class: 'progress' + (done ? ' done' : ''), attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': goal.name + ' progress' } },
          h('span', { style: 'width:' + pct + '%' })),
        h('p', { class: 'goal-pct text-sm ' + (done ? 'goal-done' : 'muted'), text: done ? 'Target reached!' : pct + '% · ' + ui.fmt(goal.targetCents - goal.savedCents) + ' to go' })) : null,
      h('div', { class: 'goal-actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', on: { click: function () { moveMoney(goal, 'in'); } } }, ui.icon('plus'), 'Add money'),
        h('button', { type: 'button', class: 'btn btn-secondary btn-sm', disabled: goal.savedCents === 0, on: { click: function () { moveMoney(goal, 'out'); } } }, 'Take out')));
  }

  App.views.savings = {
    navLabel: 'Savings',
    title: 'Savings',
    icon: 'savings',
    render: function (root) {
      var s = App.store.getState();
      var held = s.goals.reduce(function (sum, x) { return sum + x.savedCents; }, 0);
      var goals = s.goals.filter(function (x) { return x.kind === 'goal'; });
      var envelopes = s.goals.filter(function (x) { return x.kind === 'envelope'; });

      root.appendChild(ui.pageHead('Savings', 'Money you put in a goal or envelope is held back from your Safe to Spend number, so it doesn’t get spent by accident.'));

      var form = h('form', { class: 'form', id: 'addGoalForm' }, goalFields({ kind: 'goal', ids: { name: 'goalName' } }, true),
        ui.field({ name: 'saved', label: 'Already saved', optional: true, money: true, placeholder: '0.00' }),
        h('button', { type: 'submit', class: 'btn btn-primary btn-block', id: 'addGoalBtn' }, ui.icon('plus'), 'Create'));
      ui.bindForm(form, 'addGoal', { onDone: function (x) { ui.toast('Created ' + x.name); } });

      var list = s.goals.length
        ? h('div', { class: 'stack' },
          goals.length ? h('section', { attrs: { 'aria-labelledby': 'goals-title' } }, h('h2', { class: 'section-title', id: 'goals-title', text: 'Goals' }), h('ul', { class: 'goal-grid' }, goals.map(goalCard))) : null,
          envelopes.length ? h('section', { attrs: { 'aria-labelledby': 'env-title' } }, h('h2', { class: 'section-title', id: 'env-title', text: 'Envelopes' }), h('ul', { class: 'goal-grid' }, envelopes.map(goalCard))) : null)
        : h('section', { class: 'card' }, ui.emptyState('savings', 'Nothing saved here yet',
          'Create a goal for something you’re saving toward, or an envelope for money you’ve earmarked.'));

      root.appendChild(h('div', { class: 'page-grid' + ((s.goals.length) ? ' has-items' : '') },
        h('div', { class: 'stats g-summary' },
          ui.stat('Held back', ui.fmt(held)),
          ui.stat('Goals', String(goals.length)),
          ui.stat('Envelopes', String(envelopes.length))),
        h('section', { class: 'card g-form', attrs: { 'aria-labelledby': 'add-goal-title' } },
          h('div', { class: 'card-header' }, h('h2', { id: 'add-goal-title', text: 'New goal or envelope' })), form),
        h('div', { class: 'g-list' }, list)));
    },
  };
  App.nav.push('savings');
})(typeof window !== 'undefined' ? window : globalThis);
