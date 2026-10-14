/* Every state change the app can make, as a named action: fn(state, payload, ctx).
 * Actions validate their own input and throw ValidationError(field, message) to
 * reject it — the store then leaves state untouched and the form shows the
 * message next to `field`. Payload values arrive as the raw strings the user
 * typed; parsing happens here, once, not scattered across views.
 *
 * Balance model (docs/DATA-MODEL.md §3): the balance is a checkpoint the user types
 * from their banking app. Logging a spend or income, marking a bill paid, or buying
 * a Wait List item adjusts it, each recorded in `activity` so it can be traced and
 * (for manual entries) reversed. Typing a new balance simply resets the checkpoint. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  App.core = App.core || {};
  var C = App.core;
  var money = C.money, dates = C.dates, schema = C.schema;

  var ACTIVITY_KEEP = 200;

  function fail(field, message) { throw new C.ValidationError(field, message); }

  function name(v, field, what) {
    var s = schema.cleanName(v);
    if (!s) fail(field || 'name', 'Give ' + (what || 'it') + ' a name.');
    return s;
  }
  function amount(v, field, opts) {
    var allowZero = opts && opts.allowZero;
    if (v === '' || v == null) fail(field || 'amount', 'Enter an amount.');
    var c = money.parseCents(v, opts);
    if (c === null) fail(field || 'amount', 'Use a number like 45 or 45.99.');
    if (!allowZero && c === 0 && !(opts && opts.allowNegative)) fail(field || 'amount', 'Enter an amount above zero.');
    return c;
  }
  function optionalAmount(v, field) {
    if (v === '' || v == null) return null;
    var c = money.parseCents(v);
    if (c === null) fail(field, 'Use a number like 45 or 45.99.');
    return c;
  }
  function date(v, field) {
    if (!dates.isISODate(v)) fail(field || 'date', 'Pick a date.');
    return v;
  }
  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    fail('id', 'That item no longer exists.');
  }
  function remove(list, id) { return list.filter(function (x) { return x.id !== id; }); }

  function adjustBalance(state, delta, ctx) {
    if (state.balance.cents === null) return false;
    state.balance.cents += delta;
    return true;
  }
  function addActivity(state, ctx, entry) {
    entry.id = ctx.newId();
    entry.date = ctx.today;
    state.activity.unshift(entry);
    if (state.activity.length > ACTIVITY_KEEP) state.activity.length = ACTIVITY_KEEP;
    return entry;
  }

  // Fields are validated in the order the form shows them, so the first error
  // reported is the first one the user sees.
  function readBill(p) {
    var billName = name(p.name, 'name', 'the bill');
    var cents = amount(p.amount, 'amount');
    var due = date(p.dueDate, 'dueDate');
    var cadence = schema.CADENCES.indexOf(p.cadence) !== -1 ? p.cadence : fail('cadence', 'Choose how often it comes round.');
    var everyN = null;
    if (cadence === 'every_n_months') {
      everyN = parseInt(p.everyN, 10);
      if (!(everyN >= 2 && everyN <= 24) || String(everyN) !== String(p.everyN).trim()) fail('everyN', 'Use a whole number of months from 2 to 24.');
    }
    return {
      name: billName,
      amountCents: cents,
      cadence: cadence,
      everyN: everyN,
      setAside: cadence === 'every_n_months' && !!p.setAside,
      dueDate: due,
      anchorDay: dates.day(due),
    };
  }

  function readDebt(p) {
    var debtName = name(p.name, 'name', 'the debt');
    var balance = amount(p.balance, 'balance', { allowZero: true });
    var apr = C.debt.parseApr(p.apr);
    if (apr === null) fail('apr', 'Use a rate like 19.99 (or leave it blank).');
    return { name: debtName, balanceCents: balance, aprBps: apr, minPaymentCents: optionalAmount(p.minPayment, 'minPayment') || 0 };
  }

  function readGoal(p) {
    var kind = p.kind === 'envelope' ? 'envelope' : 'goal';
    var target = optionalAmount(p.target, 'target');
    if (kind === 'goal' && !target) fail('target', 'Set a target amount for a savings goal.');
    return { name: name(p.name, 'name', kind === 'goal' ? 'the goal' : 'the envelope'), kind: kind, targetCents: target || null };
  }

  var actions = {
    /* ---- balance, payday, quick log ---- */
    setBalance: function (s, p, ctx) {
      s.balance.cents = amount(p.amount, 'amount', { allowNegative: true, allowZero: true });
      s.balance.updatedOn = ctx.today;
    },
    setPayday: function (s, p) {
      var cadence = schema.PAYDAY_CADENCES.indexOf(p.cadence) !== -1 ? p.cadence : fail('cadence', 'Choose how often you get paid.');
      s.payday = { next: date(p.next, 'next'), cadence: cadence };
    },
    logActivity: function (s, p, ctx) {
      var kind = p.kind === 'income' ? 'income' : 'spend';
      if (s.balance.cents === null) fail('amount', 'Set your balance first, so this has something to adjust.');
      var cents = amount(p.amount, 'amount');
      var label = schema.cleanName(p.label) || (kind === 'income' ? 'Income' : 'Spending');
      adjustBalance(s, kind === 'income' ? cents : -cents, ctx);
      return addActivity(s, ctx, { kind: kind, amountCents: cents, label: label, refId: null });
    },
    deleteActivity: function (s, p) {
      var entry = find(s.activity, p.id);
      if (entry.kind !== 'spend' && entry.kind !== 'income') fail('id', 'Undo this from the bill or Wait List item instead.');
      adjustBalance(s, entry.kind === 'income' ? -entry.amountCents : entry.amountCents);
      s.activity = remove(s.activity, p.id);
    },

    /* ---- bills ---- */
    addBill: function (s, p, ctx) {
      if (ctx.limits.maxBills != null && s.bills.length >= ctx.limits.maxBills) {
        fail('limit', 'The demo holds up to ' + ctx.limits.maxBills + ' bills. The full version has no limit.');
      }
      var bill = readBill(p);
      bill.id = ctx.newId();
      bill.paid = false;
      bill.debtId = null;
      s.bills.push(bill);
      return bill;
    },
    updateBill: function (s, p) {
      var bill = find(s.bills, p.id);
      var next = readBill(p);
      var scheduleChanged = next.dueDate !== bill.dueDate || next.cadence !== bill.cadence || next.everyN !== bill.everyN;
      Object.assign(bill, next);
      if (scheduleChanged) bill.paid = false;
    },
    deleteBill: function (s, p) {
      find(s.bills, p.id);
      s.bills = remove(s.bills, p.id);
    },
    setBillPaid: function (s, p, ctx) {
      // Work on the bill's CURRENT cycle (what the user is looking at): roll a
      // paid, past-due cycle forward first, so the toggle never acts on a stale one.
      var idx = s.bills.indexOf(find(s.bills, p.id));
      var bill = s.bills[idx] = C.bills.rollForward(s.bills[idx], ctx.today);
      var paid = !!p.paid;
      if (bill.paid === paid) return;
      bill.paid = paid;
      if (paid) {
        var adjusted = adjustBalance(s, -bill.amountCents, ctx);
        if (adjusted) addActivity(s, ctx, { kind: 'bill_paid', amountCents: bill.amountCents, label: bill.name, refId: bill.id });
        // Paying an already-overdue cycle moves the bill straight on to its next one.
        s.bills[idx] = C.bills.rollForward(bill, ctx.today);
      } else {
        // Reverse the most recent payment recorded for this bill, if any.
        for (var i = 0; i < s.activity.length; i++) {
          var a = s.activity[i];
          if (a.kind === 'bill_paid' && a.refId === bill.id) {
            adjustBalance(s, a.amountCents, ctx);
            s.activity.splice(i, 1);
            break;
          }
        }
      }
    },
    /** Applies rollForward to every bill — run once per day/boot so paid cycles
     *  whose date has passed move on to the next one. */
    rollBills: function (s, p, ctx) {
      s.bills = s.bills.map(function (b) { return C.bills.rollForward(b, ctx.today); });
    },

    /* ---- debt ---- */
    addDebt: function (s, p, ctx) {
      var d = readDebt(p);
      d.id = ctx.newId();
      s.debts.push(d);
      return d;
    },
    updateDebt: function (s, p) {
      var d = find(s.debts, p.id);
      Object.assign(d, readDebt(p));
      s.bills.forEach(function (b) {
        if (b.debtId === d.id) { b.name = d.name + ' payment'; if (d.minPaymentCents > 0) b.amountCents = d.minPaymentCents; }
      });
    },
    deleteDebt: function (s, p) {
      find(s.debts, p.id);
      s.debts = remove(s.debts, p.id);
      s.bills.forEach(function (b) { if (b.debtId === p.id) b.debtId = null; });
    },
    setDebtStrategy: function (s, p) {
      s.debtStrategy = p.strategy === 'avalanche' ? 'avalanche' : 'snowball';
    },
    /** Puts a debt's minimum payment on the Bills list as a monthly bill, so it's
     *  counted in Safe to Spend like any other commitment. */
    addDebtPaymentBill: function (s, p, ctx) {
      var d = find(s.debts, p.id);
      if (!d.minPaymentCents) fail('minPayment', 'Add a minimum payment to this debt first.');
      if (s.bills.some(function (b) { return b.debtId === d.id; })) fail('id', 'This debt already has a payment on your Bills list.');
      if (ctx.limits.maxBills != null && s.bills.length >= ctx.limits.maxBills) {
        fail('limit', 'The demo holds up to ' + ctx.limits.maxBills + ' bills. The full version has no limit.');
      }
      var due = date(p.dueDate, 'dueDate');
      var bill = {
        id: ctx.newId(), name: d.name + ' payment', amountCents: d.minPaymentCents, cadence: 'monthly',
        everyN: null, setAside: false, dueDate: due, anchorDay: dates.day(due), paid: false, debtId: d.id,
      };
      s.bills.push(bill);
      return bill;
    },

    /* ---- savings goals & envelopes ---- */
    addGoal: function (s, p, ctx) {
      var goal = readGoal(p);
      goal.id = ctx.newId();
      goal.savedCents = optionalAmount(p.saved, 'saved') || 0;
      s.goals.push(goal);
      return goal;
    },
    updateGoal: function (s, p) {
      Object.assign(find(s.goals, p.id), readGoal(p));
    },
    deleteGoal: function (s, p) {
      find(s.goals, p.id);
      s.goals = remove(s.goals, p.id);
    },
    moveGoalMoney: function (s, p) {
      var goal = find(s.goals, p.id);
      var cents = amount(p.amount, 'amount');
      if (p.direction === 'out') {
        if (cents > goal.savedCents) fail('amount', 'There’s only ' + money.formatCents(goal.savedCents, s.settings.currency) + ' in here.');
        goal.savedCents -= cents;
      } else {
        goal.savedCents += cents;
      }
    },

    /* ---- wait list ---- */
    addWait: function (s, p, ctx) {
      var item = {
        id: ctx.newId(), name: name(p.name, 'name', 'the item'), priceCents: amount(p.price, 'price'),
        addedAt: ctx.now, status: 'waiting', resolvedOn: null,
      };
      s.waitlist.unshift(item);
      return item;
    },
    resolveWait: function (s, p, ctx) {
      var item = find(s.waitlist, p.id);
      if (item.status !== 'waiting') fail('id', 'This item has already been decided.');
      if (p.outcome === 'bought') {
        if (C.waitlist.remainingMs(item, ctx.now) > 0) fail('id', 'The 48 hours aren’t up yet.');
        item.status = 'bought';
        if (adjustBalance(s, -item.priceCents, ctx)) {
          addActivity(s, ctx, { kind: 'waitlist_bought', amountCents: item.priceCents, label: item.name, refId: item.id });
        }
      } else {
        item.status = 'skipped';
      }
      item.resolvedOn = ctx.today;
    },
    deleteWait: function (s, p) {
      find(s.waitlist, p.id);
      s.waitlist = remove(s.waitlist, p.id);
    },

    /* ---- settings ---- */
    setCurrency: function (s, p) {
      var ok = money.CURRENCIES.some(function (c) { return c[0] === p.currency; });
      if (!ok) fail('currency', 'Choose a currency from the list.');
      s.settings.currency = p.currency;
    },
    setTheme: function (s, p) {
      s.settings.theme = schema.THEMES.indexOf(p.theme) !== -1 ? p.theme : 'system';
    },
    dismissOnboarding: function (s) { s.settings.onboardingDismissed = true; },
    markBackedUp: function (s, p, ctx) { s.settings.lastBackupAt = ctx.today; },
  };

  App.core.actions = actions;
})(typeof window !== 'undefined' ? window : globalThis);
