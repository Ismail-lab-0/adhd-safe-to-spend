/* Hash router + nav. Each view module registers
 *   App.views[id] = { navLabel, icon, title, render(root), badge?(state) }
 * and pushes its id onto App.nav in display order.
 *
 * Contract relied on by validators/app_check.py: #view-nav holds one
 * [data-nav="<id>"] button per view, and showing a view sets
 * #view-root[data-active-view] and replaces its content entirely.
 *
 * The current view re-renders whenever the store changes, keeping scroll
 * position and (by element id) keyboard focus, so a submitted form stays ready
 * for the next entry. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  var current = null;
  var rendered = null; // id of the view whose DOM is currently mounted

  function root() { return document.getElementById('view-root'); }

  function render(opts) {
    var view = App.views[current];
    var el = root();
    var active = document.activeElement;
    var focusId = active && active.id && el.contains(active) ? active.id : null;
    var scrollY = window.scrollY;
    var prev = rendered && App.views[rendered];
    if (prev && prev.cleanup) { prev.cleanup(); prev.cleanup = null; }
    rendered = current;
    el.dataset.activeView = current;
    el.replaceChildren();
    view.render(el);
    updateNav();
    if (opts && opts.navigated) {
      window.scrollTo(0, 0);
      el.focus({ preventScroll: true });
      document.title = view.title + ' · ' + App.config.title;
    } else {
      window.scrollTo(0, scrollY);
      if (focusId) {
        var again = document.getElementById(focusId);
        if (again) again.focus({ preventScroll: true });
      }
    }
  }

  function show(id) {
    if (!App.views[id]) id = App.nav[0];
    var changed = id !== current;
    current = id;
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    render({ navigated: changed });
  }

  function updateNav() {
    var state = App.store.getState();
    document.querySelectorAll('#view-nav [data-nav]').forEach(function (b) {
      var id = b.dataset.nav;
      if (id === current) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
      var badgeFn = App.views[id].badge;
      var n = badgeFn ? badgeFn(state) : 0;
      var badge = b.querySelector('.badge');
      if (n > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; b.appendChild(badge); }
        badge.textContent = n > 9 ? '9+' : String(n);
        b.setAttribute('aria-label', App.views[id].navLabel + ' (' + n + ' need attention)');
      } else {
        if (badge) badge.remove();
        b.removeAttribute('aria-label');
      }
    });
  }

  function buildNav() {
    var nav = document.getElementById('view-nav');
    nav.replaceChildren();
    App.nav.forEach(function (id) {
      var v = App.views[id];
      var b = App.ui.h('button', { type: 'button', dataset: { nav: id }, on: { click: function () { show(id); } } },
        App.ui.icon(v.icon), App.ui.h('span', { class: 'label', text: v.navLabel }));
      nav.appendChild(b);
    });
  }

  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });

  App.router = {
    init: function () {
      buildNav();
      App.store.subscribe(function () { if (current) render(); });
      show(location.hash.slice(1) || App.nav[0]);
    },
    show: show,
    refresh: function () { if (current) render(); },
    current: function () { return current; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
