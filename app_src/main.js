/* Orchestration: shared store (single localStorage blob, same backup-friendly pattern as
 * tools/app_template.html), theme toggle, export/import, demo-mode banner, router init.
 * Runs last, after every view module in app_src/modules/ has registered itself. */
(function () {
  var KEY = 'app-state-v1';

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      return s && typeof s === 'object' ? s : {};
    } catch (e) { return {}; }
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  var state = load();
  window.App = window.App || { views: {}, nav: [] };
  App.store = {
    get: function (key, fallback) { return key in state ? state[key] : fallback; },
    set: function (key, value) { state[key] = value; save(state); },
    all: function () { return state; },
  };

  /* Shared UI helpers any view's render(root) can call after building its markup.
   * initTabs wires up the role="tablist"/"tab"/"tabpanel" convention (see
   * styles/01_components.css's .tabs): click a tab, show its panel, hide the
   * others. Pure DOM wiring — presentation lives entirely in CSS. */
  App.ui = {
    initTabs: function (root) {
      var tabs = root.querySelectorAll('[role="tab"]');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var panelId = tab.getAttribute('aria-controls');
          tabs.forEach(function (t) { t.setAttribute('aria-selected', 'false'); });
          root.querySelectorAll('[role="tabpanel"]').forEach(function (p) { p.hidden = true; });
          tab.setAttribute('aria-selected', 'true');
          var panel = document.getElementById(panelId);
          if (panel) panel.hidden = false;
        });
      });
    },
  };

  function applyTheme() {
    var theme = App.store.get('theme', 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }
  applyTheme();
  document.getElementById('themeToggle').addEventListener('click', function () {
    App.store.set('theme', App.store.get('theme', 'light') === 'dark' ? 'light' : 'dark');
    applyTheme();
  });

  document.getElementById('exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var s = JSON.parse(r.result);
        if (s && typeof s === 'object') {
          state = s;
          save(state);
          applyTheme();
          AppRouter.init();
        } else {
          alert('This file is not a valid backup.');
        }
      } catch (err) {
        alert('This file is not a valid backup.');
      }
    };
    r.readAsText(f);
  });

  if (window.APP_DEMO_MODE) {
    document.getElementById('demo-banner').hidden = false;
  }

  AppRouter.init();
})();
