/* Wait List — the approved differentiator. Want something? Park it here for 48
 * hours before buying. "Buy it" only unlocks once the wait is over (and logs the
 * spend); "Don't need it" works any time and counts toward money kept. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  var C = App.core;
  var ui = App.ui;
  var h = ui.h;
  var W = C.waitlist;

  function readyAtLabel(item) {
    var at = new Date(item.addedAt + W.WAIT_MS);
    var day = at.toLocaleDateString(undefined, { weekday: 'short' });
    var time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return day + ' ' + time;
  }

  function waitingCard(item, now, safeCents) {
    var remaining = W.remainingMs(item, now);
    var ready = remaining === 0;
    var pct = Math.round((1 - remaining / W.WAIT_MS) * 100);
    var after = safeCents - item.priceCents;
    var timeText = h('span', { class: 'wait-remaining num', dataset: { addedAt: String(item.addedAt) }, text: ready ? 'Ready to decide' : W.formatRemaining(remaining) + ' left' });
    return h('li', { class: 'card wait-card' + (ready ? ' is-ready' : '') },
      h('div', { class: 'wait-head' },
        h('div', { class: 'list-main' },
          h('h3', { class: 'list-title', text: item.name }),
          h('div', { class: 'list-meta', text: ready ? 'Waited 48 hours' : 'Ready ' + readyAtLabel(item) })),
        h('div', { class: 'list-amount wait-price', text: ui.fmt(item.priceCents) })),
      h('div', { class: 'wait-timer' },
        h('div', { class: 'progress wait-progress' + (ready ? ' done' : ''), attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': 'Waiting time passed' } },
          h('span', { style: 'width:' + pct + '%' })),
        timeText),
      ready ? h('p', { class: 'wait-question' }, 'Still want it? ',
        h('span', { class: 'muted', text: App.store.getState().balance.cents === null ? '' : 'Buying it leaves ' + ui.fmt(after) + ' safe to spend.' })) : null,
      h('div', { class: 'goal-actions' },
        ready ? h('button', {
          type: 'button', class: 'btn btn-primary btn-sm', on: {
            click: function () {
              App.store.dispatch('resolveWait', { id: item.id, outcome: 'bought' });
              ui.toast('Bought — logged ' + ui.fmt(item.priceCents) + ' as spending', { undo: true });
            },
          },
        }, 'Buy it') : null,
        h('button', {
          type: 'button', class: 'btn btn-secondary btn-sm', on: {
            click: function () {
              App.store.dispatch('resolveWait', { id: item.id, outcome: 'skipped' });
              ui.toast('Nice — you kept ' + ui.fmt(item.priceCents), { undo: true });
            },
          },
        }, 'Don’t need it')));
  }

  function historyList(items) {
    return h('ul', { class: 'list' }, items.map(function (i) {
      return h('li', { class: 'list-item' },
        h('div', { class: 'list-main' },
          h('div', { class: 'list-title', text: i.name }),
          h('div', { class: 'list-meta' },
            h('span', { class: 'pill ' + (i.status === 'skipped' ? 'pill-success' : ''), text: i.status === 'skipped' ? 'Skipped' : 'Bought' }),
            i.resolvedOn ? h('span', { text: C.dates.label(i.resolvedOn) }) : null)),
        h('div', { class: 'list-amount', text: ui.fmt(i.priceCents) }),
        h('button', {
          type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Remove ' + i.name + ' from history' },
          on: { click: function () { App.store.dispatch('deleteWait', { id: i.id }); ui.toast('Removed from history', { undo: true }); } },
        }, ui.icon('trash')));
    }));
  }

  App.views.waitlist = {
    navLabel: 'Wait List',
    title: 'Wait List',
    icon: 'waitlist',
    badge: function (s) {
      var now = App.store.now();
      return s.waitlist.filter(function (i) { return i.status === 'waiting' && W.remainingMs(i, now) === 0; }).length;
    },
    render: function (root) {
      var s = App.store.getState();
      var now = App.store.now();
      var r = C.safeToSpend.compute(s, App.store.today());
      var waiting = s.waitlist.filter(function (i) { return i.status === 'waiting'; })
        .sort(function (a, b) { return a.addedAt - b.addedAt; });
      var decided = s.waitlist.filter(function (i) { return i.status !== 'waiting'; });
      var stats = W.stats(s.waitlist);

      root.appendChild(ui.pageHead('Wait List', 'See something you want? Park it here for 48 hours. If you still want it after that, buy it with a clear head.'));

      var form = h('form', { class: 'form', id: 'addWaitForm' },
        ui.field({ name: 'name', id: 'waitName', label: 'What is it?', placeholder: 'e.g. New headphones', attrs: { maxlength: 60 } }),
        ui.field({ name: 'price', id: 'waitPrice', label: 'Price', money: true, placeholder: '0.00' }),
        h('button', { type: 'submit', class: 'btn btn-primary btn-block', id: 'addWaitBtn' }, ui.icon('waitlist'), 'Start the 48-hour wait'));
      ui.bindForm(form, 'addWait', { onDone: function (i) { ui.toast(i.name + ' added — check back in 48 hours'); } });

      var how = h('ol', { class: 'how-steps' },
        h('li', null, h('strong', { text: 'Add it' }), h('span', { text: 'Name and price — takes five seconds.' })),
        h('li', null, h('strong', { text: 'Wait 48 hours' }), h('span', { text: 'The urge usually fades. If it doesn’t, that tells you something too.' })),
        h('li', null, h('strong', { text: 'Decide' }), h('span', { text: 'Buy it, or let it go and count the money you kept.' })));

      var list = waiting.length
        ? h('ul', { class: 'wait-grid' }, waiting.map(function (i) { return waitingCard(i, now, r.safeCents); }))
        : h('section', { class: 'card' }, ui.emptyState('waitlist', 'Nothing waiting', 'Next time you’re about to buy something you didn’t plan for, add it here first.'));

      root.appendChild(h('div', { class: 'page-grid' + ((waiting.length || decided.length) ? ' has-items' : '') },
        h('div', { class: 'stats g-summary' },
          ui.stat('Waiting', String(waiting.length)),
          ui.stat('Kept by skipping', ui.fmt(stats.keptCents)),
          ui.stat('Skipped', stats.skippedCount + (stats.skippedCount === 1 ? ' thing' : ' things'))),
        h('div', { class: 'stack g-form' },
          h('section', { class: 'card', attrs: { 'aria-labelledby': 'add-wait-title' } },
            h('div', { class: 'card-header' }, h('h2', { id: 'add-wait-title', text: 'Add something' })), form),
          h('section', { class: 'card how-card', attrs: { 'aria-label': 'How it works' } }, how)),
        h('div', { class: 'stack g-list' },
          list,
          decided.length ? h('details', { class: 'card card-flush history disclosure' },
            h('summary', null, ui.icon('chevron'), 'History (' + decided.length + ')'),
            historyList(decided)) : null)));

      // Live countdown: update the timer text in place every 30s, and re-render
      // when something becomes ready. Stopped when the view is left.
      var timer = setInterval(function () {
        var t = App.store.now();
        var becameReady = false;
        root.querySelectorAll('.wait-remaining[data-added-at]').forEach(function (el) {
          var ms = W.remainingMs({ addedAt: +el.dataset.addedAt }, t);
          if (ms === 0 && el.textContent !== 'Ready to decide') becameReady = true;
          else if (ms > 0) el.textContent = W.formatRemaining(ms) + ' left';
        });
        if (becameReady) App.router.refresh();
      }, 30000);
      App.views.waitlist.cleanup = function () { clearInterval(timer); };
    },
  };
  App.nav.push('waitlist');
})(typeof window !== 'undefined' ? window : globalThis);
