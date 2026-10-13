/* Wait List view — the approved differentiator (Opportunity Discovery: minority
 * coverage, only TheSheetFlow has an equivalent among observed competitors).
 * A 48-hour cooling-off period for an impulse buy: add an item with a price, watch
 * a live countdown, and only once it elapses can it be converted to a real spend
 * (reduces the account balance) or dismissed. The gate is the point — it's not
 * just a visual nudge. */
(function () {
  window.App = window.App || { views: {}, nav: [] };
  var d = App.data;
  var WAIT_MS = 48 * 60 * 60 * 1000;
  var timer = null;

  function remaining(item) {
    return Math.max(0, (new Date(item.addedAt).getTime() + WAIT_MS) - Date.now());
  }
  function formatRemaining(ms) {
    var totalMin = Math.ceil(ms / 60000);
    var h = Math.floor(totalMin / 60), m = totalMin % 60;
    return h + 'h ' + m + 'm left';
  }

  App.views.waitlist = {
    navLabel: 'Wait List',
    render: function (root) {
      root.dataset.activeView = 'waitlist';
      if (timer) { clearInterval(timer); timer = null; }
      var items = App.store.get('waitlist', []).filter(function (i) { return i.status === 'pending'; });

      root.innerHTML =
        '<h1>Wait List</h1>' +
        '<p class="sub">See something you want? Park it here for 48 hours before you buy it.</p>' +
        '<div class="card">' +
        '  <div class="row">' +
        '    <input id="waitName" type="text" placeholder="e.g. New headphones" aria-label="Item name">' +
        '    <input id="waitPrice" type="number" step="0.01" placeholder="Price" aria-label="Item price" style="max-width:110px">' +
        '    <button id="addWaitBtn" type="button">Add to wait list</button>' +
        '  </div>' +
        '</div>' +
        '<div id="waitItems"></div>';

      var container = root.querySelector('#waitItems');

      function draw() {
        if (!items.length) {
          container.innerHTML = '<div class="card empty-state"><strong>Nothing waiting</strong>Add something above before you buy it.</div>';
          return;
        }
        container.innerHTML = '';
        items.forEach(function (item) {
          var ms = remaining(item);
          var ready = ms <= 0;
          var card = document.createElement('div');
          card.className = 'card';
          card.innerHTML =
            '<h2>' + d.escapeHtml(item.name) + '</h2>' +
            '<p class="sub">' + d.formatMoney(item.price) + '</p>' +
            '<div class="banner ' + (ready ? 'success' : 'info') + '">' +
            (ready ? 'The wait is over — still want it?' : formatRemaining(ms)) +
            '</div>' +
            '<div class="row">' +
            '<button type="button" class="buyBtn"' + (ready ? '' : ' disabled') + '>Buy it</button>' +
            '<button type="button" class="ghost dismissBtn"' + (ready ? '' : ' disabled') + '>Dismiss</button>' +
            '</div>';
          card.querySelector('.buyBtn').addEventListener('click', function () {
            if (remaining(item) > 0) return;
            item.status = 'purchased';
            App.store.set('waitlist', App.store.get('waitlist', []));
            App.store.set('balance', App.store.get('balance', 0) - item.price);
            App.views.waitlist.render(root);
          });
          card.querySelector('.dismissBtn').addEventListener('click', function () {
            if (remaining(item) > 0) return;
            item.status = 'dismissed';
            App.store.set('waitlist', App.store.get('waitlist', []));
            App.views.waitlist.render(root);
          });
          container.appendChild(card);
        });
      }
      draw();
      timer = setInterval(draw, 60000);

      root.querySelector('#addWaitBtn').addEventListener('click', function () {
        var name = root.querySelector('#waitName').value.trim();
        var price = parseFloat(root.querySelector('#waitPrice').value);
        if (!name || !isFinite(price) || price <= 0) return;
        var all = App.store.get('waitlist', []);
        all.push({ id: d.uid(), name: name, price: price, addedAt: new Date().toISOString(), status: 'pending' });
        App.store.set('waitlist', all);
        App.views.waitlist.render(root);
      });
    },
  };
  App.nav.push('waitlist');
})();
