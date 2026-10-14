/* UI toolkit: safe DOM building, icons, form fields with validation display,
 * dialogs, toasts. Views compose these — no view builds markup from strings, so
 * user-entered names can never be interpreted as HTML. */
(function (g) {
  var App = g.App || (g.App = { views: {}, nav: [] });
  var C = App.core;
  var ui = App.ui = App.ui || {};

  /** h('div', {class, text, attrs:{}, on:{click}, dataset:{}}, ...children) */
  function h(tag, props) {
    var el = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k === 'attrs') Object.keys(v).forEach(function (a) { if (v[a] != null && v[a] !== false) el.setAttribute(a, v[a] === true ? '' : v[a]); });
      else if (k === 'style') el.setAttribute('style', v);
      else el[k] = v;
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }

  /* ---------- Icons (24px grid, 1.8 stroke, currentColor) ---------- */
  var ICONS = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
    bills: '<path d="M6 2.8h12v18.4l-2.6-1.6-2.7 1.6-2.7-1.6-2.7 1.6L6 21.2z"/><path d="M9 7.5h6M9 11h6M9 14.5h3.5"/>',
    debt: '<path d="M3 6.5l6.2 6.2 4-4L21 16.5"/><path d="M21 10.5v6h-6"/>',
    savings: '<path d="M8.5 2.8h7"/><path d="M7.5 5.6h9v1.1c0 .7-.4 1.3-1 1.6l-.3.2c.9 1 1.3 2.2 1.3 3.5v6.4c0 1.5-1.2 2.6-2.6 2.6H10.1c-1.4 0-2.6-1.1-2.6-2.6V12c0-1.3.4-2.5 1.3-3.5l-.3-.2c-.6-.3-1-.9-1-1.6z"/><path d="M10.5 14h3"/>',
    waitlist: '<path d="M6.5 2.8h11M6.5 21.2h11"/><path d="M7.5 2.8c0 4.6 9 5 9 9.2s-9 4.6-9 9.2M16.5 2.8c0 4.6-9 5-9 9.2s9 4.6 9 9.2"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10.2 11v5.5M13.8 11v5.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    download: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 19.5h15"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.2M12 17.2v.1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.1"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="7.5" width="16.5" height="12" rx="2.5"/><path d="M16 13.5h1.5"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
    sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8-1.8 5.2-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  };
  function icon(name, extraClass) {
    var span = document.createElement('span');
    span.className = 'icon' + (extraClass ? ' ' + extraClass : '');
    span.setAttribute('aria-hidden', 'true');
    span.style.display = 'inline-flex';
    span.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
    return span;
  }
  function brandMark(cls) {
    var span = document.createElement('span');
    span.className = 'brand-mark ' + (cls || '');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 40 40" width="100%" height="100%"><rect width="40" height="40" rx="11" fill="#A34B2A"/>' +
      '<path d="M10 25a10 10 0 0 1 20 0" fill="none" stroke="#FBE7DD" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M20 25l5.2-6.4" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round"/><circle cx="20" cy="25" r="3.1" fill="#FFFFFF"/></svg>';
    return span;
  }

  /* ---------- Money/date display ---------- */
  function currency() { return App.store.getState().settings.currency; }
  function fmt(cents) { return C.money.formatCents(cents, currency()); }
  function currencySymbol() {
    try {
      var parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: currency() }).formatToParts(0);
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'currency') return parts[i].value;
    } catch (e) { /* fall through */ }
    return '$';
  }
  function dateChip(iso, overdue) {
    var parts = iso.split('-');
    return h('div', { class: 'date-chip' + (overdue ? ' overdue' : ''), attrs: { 'aria-hidden': 'true' } },
      h('span', { class: 'm', text: C.dates.MONTHS[+parts[1] - 1] }),
      h('span', { class: 'd', text: String(+parts[2]) }));
  }

  /* ---------- Form fields ---------- */
  var fieldSeq = 0;
  /**
   * field({name, label, type, value, placeholder, help, optional, money, options, attrs})
   * `name` matches the ValidationError.field an action throws, so errors land here.
   */
  function field(o) {
    fieldSeq += 1;
    var id = (o.id || ('f-' + o.name + '-' + fieldSeq));
    var errId = id + '-err', helpId = id + '-help';
    var control;
    var describedBy = [o.help ? helpId : null, errId].filter(Boolean).join(' ');
    if (o.options) {
      control = h('select', { class: 'select', id: id, name: o.name, attrs: Object.assign({ 'aria-describedby': describedBy }, o.attrs) },
        o.options.map(function (opt) {
          return h('option', { value: opt[0], text: opt[1], selected: String(o.value) === String(opt[0]) });
        }));
    } else {
      var attrs = Object.assign({ 'aria-describedby': describedBy, autocomplete: 'off' }, o.attrs);
      if (o.money) { attrs.inputmode = 'decimal'; attrs.enterkeyhint = attrs.enterkeyhint || 'done'; }
      control = h('input', {
        class: 'input', id: id, name: o.name, type: o.type || 'text', value: o.value == null ? '' : o.value,
        placeholder: o.placeholder || '', attrs: attrs,
      });
    }
    var wrapped = control;
    if (o.money) {
      var sym = currencySymbol();
      wrapped = h('div', { class: 'input-money', style: '--prefix-w:' + Math.max(1, sym.length) + 'ch' },
        h('span', { class: 'prefix', text: sym, attrs: { 'aria-hidden': 'true' } }), control);
    }
    return h('div', { class: 'field', dataset: { field: o.name } },
      h('label', { attrs: { for: id } }, o.label, o.optional ? h('span', { class: 'optional', text: ' (optional)' }) : null),
      wrapped,
      o.help ? h('span', { class: 'help', id: helpId, text: o.help }) : null,
      h('span', { class: 'field-error', id: errId, attrs: { role: 'alert' } }));
  }

  function segmented(name, options, value, label) {
    return h('div', { class: 'segmented', attrs: { role: 'radiogroup', 'aria-label': label } },
      options.map(function (opt) {
        return h('label', null,
          h('input', { type: 'radio', name: name, value: opt[0], checked: opt[0] === value }),
          h('span', null, opt[2] ? icon(opt[2]) : null, opt[1]));
      }));
  }

  /** Reads named controls into a plain {name: value} payload (checkbox -> bool). */
  function readForm(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  }

  function clearErrors(form) {
    form.querySelectorAll('.field.has-error').forEach(function (f) {
      f.classList.remove('has-error');
      var c = f.querySelector('input,select');
      if (c) c.removeAttribute('aria-invalid');
    });
    var fe = form.querySelector('.form-error');
    if (fe) fe.remove();
  }

  function showError(form, err) {
    var f = form.querySelector('.field[data-field="' + err.field + '"]');
    if (f) {
      f.classList.add('has-error');
      f.querySelector('.field-error').textContent = err.message;
      var c = f.querySelector('input,select');
      if (c) { c.setAttribute('aria-invalid', 'true'); c.focus(); }
      return;
    }
    var box = h('div', { class: 'form-error', attrs: { role: 'alert' }, text: err.message });
    form.insertBefore(box, form.firstChild);
  }

  /**
   * Wires a <form> to a store action. payload(values) can add/override fields.
   * On ValidationError the message appears next to the offending field and the
   * form keeps what the user typed. Returns the dispatch result to onDone.
   */
  function bindForm(form, actionName, opts) {
    var o = opts || {};
    form.noValidate = true;
    form.addEventListener('input', function (e) {
      var f = e.target.closest('.field.has-error');
      if (f) { f.classList.remove('has-error'); e.target.removeAttribute('aria-invalid'); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);
      var values = readForm(form);
      var payload = o.payload ? o.payload(values) : values;
      try {
        var result = App.store.dispatch(actionName, payload);
        if (o.reset !== false) form.reset();
        if (o.onDone) o.onDone(result, values);
      } catch (err) {
        if (err && err.name === 'ValidationError') showError(form, err);
        else throw err;
      }
    });
    return form;
  }

  /* ---------- Dialogs ---------- */
  /**
   * openDialog({title, intro, body, submitLabel, danger, onSubmit(form) -> bool|void, secondary})
   * Builds a <dialog> with a <form> body. onSubmit returning false keeps it open
   * (e.g. a validation error was shown). Closes on Esc, backdrop click, or Cancel.
   */
  function openDialog(o) {
    var dlg = h('dialog', { class: 'modal', attrs: { 'aria-labelledby': 'dlg-title' } });
    var form = h('form', { attrs: { method: 'dialog' }, noValidate: true });
    var cancel = h('button', { type: 'button', class: 'btn btn-secondary', text: o.cancelLabel || 'Cancel', on: { click: close } });
    var submit = h('button', { type: 'submit', class: 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary'), text: o.submitLabel || 'Save' });
    form.appendChild(h('div', { class: 'modal-header' },
      h('h2', { id: 'dlg-title', text: o.title }),
      h('button', { type: 'button', class: 'icon-btn', attrs: { 'aria-label': 'Close' }, on: { click: close } }, icon('close'))));
    form.appendChild(h('div', { class: 'modal-body' }, o.intro ? h('p', { text: o.intro }) : null, o.body || null));
    form.appendChild(h('div', { class: 'modal-footer' }, o.secondary || null, o.hideCancel ? null : cancel, submit));
    form.addEventListener('input', function (e) {
      var f = e.target.closest('.field.has-error');
      if (f) f.classList.remove('has-error');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);
      var keep = o.onSubmit ? o.onSubmit(form) === false : false;
      if (!keep) close();
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('close', function () { dlg.remove(); if (o.onClose) o.onClose(); });
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.showModal();
    var first = form.querySelector('.modal-body input:not([type=hidden]), .modal-body select');
    if (first && !o.noAutofocus) first.focus();
    function close() { if (dlg.open) dlg.close(); }
    return { dialog: dlg, form: form, close: close };
  }

  /** Runs a store action from a dialog form; shows errors inline. -> bool ok */
  function dialogDispatch(form, actionName, payload) {
    try {
      App.store.dispatch(actionName, payload);
      return true;
    } catch (err) {
      if (err && err.name === 'ValidationError') { showError(form, err); return false; }
      throw err;
    }
  }

  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var done = false;
      openDialog({
        title: o.title, intro: o.message, submitLabel: o.confirmLabel || 'Confirm', danger: o.danger, noAutofocus: true,
        onSubmit: function () { done = true; resolve(true); },
        onClose: function () { if (!done) resolve(false); },
      });
    });
  }

  /* ---------- Toasts ---------- */
  var toastTimer = null;
  /** toast(message, {undo: true}) — an Undo button reverts the last action. */
  function toast(message, opts) {
    var region = document.getElementById('toast-region');
    region.innerHTML = '';
    var el = h('div', { class: 'toast', attrs: { role: 'status' } }, h('span', { text: message }));
    if (opts && opts.undo) {
      el.appendChild(h('button', {
        type: 'button', text: 'Undo',
        on: { click: function () { App.store.undo(); region.innerHTML = ''; toast('Undone'); } },
      }));
    }
    region.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, opts && opts.undo ? 6000 : 3000);
  }

  function emptyState(iconName, title, text, action) {
    return h('div', { class: 'empty' },
      h('div', { class: 'empty-icon' }, icon(iconName)),
      h('strong', { text: title }),
      text ? h('p', { text: text }) : null,
      action || null);
  }

  function pageHead(title, sub, actions) {
    return h('header', { class: 'page-head' },
      h('div', null, h('h1', { text: title }), sub ? h('p', { text: sub }) : null),
      actions || null);
  }

  Object.assign(ui, {
    h: h, icon: icon, brandMark: brandMark, fmt: fmt, currencySymbol: currencySymbol, dateChip: dateChip,
    field: field, segmented: segmented, readForm: readForm, bindForm: bindForm, showError: showError,
    openDialog: openDialog, dialogDispatch: dialogDispatch, confirmDialog: confirmDialog,
    toast: toast, emptyState: emptyState, pageHead: pageHead,
  });
})(typeof window !== 'undefined' ? window : globalThis);
