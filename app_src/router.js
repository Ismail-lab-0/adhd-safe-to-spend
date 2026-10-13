/* Minimal hash router. Each module (app_src/modules/*.js) registers a view on
 * App.views[id] = {navLabel, render(root)} and pushes id onto App.nav, in the order
 * it should appear in the nav. render(root) MUST set root.dataset.activeView = id and
 * replace root's content with that view's real markup (never just scroll to an anchor —
 * validators/app_check.py's multi-view check clicks every nav item and asserts both
 * data-active-view and the visible text actually change). */
(function () {
  window.App = window.App || { views: {}, nav: [] };

  function show(id) {
    var view = App.views[id];
    if (!view) {
      id = App.nav[0];
      view = App.views[id];
    }
    if (!view) return;
    view.render(document.getElementById('view-root'));
    document.querySelectorAll('#view-nav [data-nav]').forEach(function (b) {
      b.setAttribute('aria-current', b.dataset.nav === id ? 'page' : 'false');
    });
    if (location.hash !== '#' + id) location.hash = '#' + id;
  }

  function buildNav() {
    var nav = document.getElementById('view-nav');
    nav.innerHTML = '';
    App.nav.forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.nav = id;
      b.textContent = App.views[id].navLabel;
      b.addEventListener('click', function () { show(id); });
      nav.appendChild(b);
    });
  }

  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
  window.AppRouter = {
    init: function () {
      buildNav();
      show(location.hash.slice(1) || App.nav[0]);
    },
  };
})();
