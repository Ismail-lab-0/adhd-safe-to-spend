/* Savings view — goals/envelopes with a target amount and progress. Money "saved"
 * here is treated as reserved (see App.data.savingsReservedTotal) and subtracted
 * from the dashboard's safe-to-spend number, so it's protected from everyday spend. */
(function () {
  window.App = window.App || { views: {}, nav: [] };
  var d = App.data;

  App.views.savings = {
    navLabel: 'Savings',
    render: function (root) {
      root.dataset.activeView = 'savings';
      var goals = App.store.get('savings', []);

      root.innerHTML =
        '<h1>Savings</h1>' +
        '<p class="sub">Money set aside here is protected from today\'s safe-to-spend number.</p>' +
        '<div class="card">' +
        '  <div class="row">' +
        '    <input id="goalName" type="text" placeholder="e.g. Emergency fund" aria-label="Goal name">' +
        '    <input id="goalTarget" type="number" step="0.01" placeholder="Target" aria-label="Target amount" style="max-width:110px">' +
        '    <button id="addGoalBtn" type="button">Add goal</button>' +
        '  </div>' +
        '</div>' +
        '<div id="goalCards"></div>';

      var container = root.querySelector('#goalCards');
      if (!goals.length) {
        container.innerHTML = '<div class="card empty-state"><strong>No savings goals yet</strong>Add one above.</div>';
      } else {
        goals.forEach(function (goal) {
          var pct = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
          var card = document.createElement('div');
          card.className = 'card';
          card.innerHTML =
            '<h2>' + d.escapeHtml(goal.name) + '</h2>' +
            '<p class="sub">' + d.formatMoney(goal.saved) + ' of ' + d.formatMoney(goal.target) + ' &middot; ' + pct + '%</p>' +
            '<div style="background:var(--color-border);border-radius:var(--radius-full);height:10px;overflow:hidden;margin-bottom:var(--space-3)">' +
            '<div style="background:var(--color-primary);height:100%;width:' + pct + '%"></div></div>' +
            '<div class="row">' +
            '<input type="number" step="0.01" class="addToGoal" placeholder="Add amount" aria-label="Add to ' + d.escapeHtml(goal.name) + '" style="max-width:120px">' +
            '<button type="button" class="addToGoalBtn">Add</button>' +
            '<button type="button" class="ghost removeGoalBtn">Remove</button>' +
            '</div>';
          card.querySelector('.addToGoalBtn').addEventListener('click', function () {
            var input = card.querySelector('.addToGoal');
            var amt = parseFloat(input.value);
            if (!isFinite(amt) || amt <= 0) return;
            goal.saved = (goal.saved || 0) + amt;
            App.store.set('savings', goals);
            App.views.savings.render(root);
          });
          card.querySelector('.removeGoalBtn').addEventListener('click', function () {
            goals.splice(goals.indexOf(goal), 1);
            App.store.set('savings', goals);
            App.views.savings.render(root);
          });
          container.appendChild(card);
        });
      }

      root.querySelector('#addGoalBtn').addEventListener('click', function () {
        var name = root.querySelector('#goalName').value.trim();
        var target = parseFloat(root.querySelector('#goalTarget').value);
        if (!name || !isFinite(target) || target <= 0) return;
        goals.push({ id: d.uid(), name: name, target: target, saved: 0 });
        App.store.set('savings', goals);
        App.views.savings.render(root);
      });
    },
  };
  App.nav.push('savings');
})();
