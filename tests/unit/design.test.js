'use strict';
// Design-system guard: every text/background token pair the UI actually uses
// must meet WCAG AA in BOTH themes, and no raw hex colors may leak out of the
// token file into component CSS.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const STYLES = path.join(__dirname, '..', '..', 'app_src', 'styles');
const tokensCss = fs.readFileSync(path.join(STYLES, '01_tokens.css'), 'utf8');

function block(re) {
  const m = re.exec(tokensCss);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[k] = v;
  return out;
}
const light = block(/:root\s*\{([\s\S]*?)\n\}/);
const dark = Object.assign({}, light, block(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/));

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [foreground, background, minimum, where it's used]
const PAIRS = [
  ['--color-ink', '--color-bg', 4.5, 'body text'],
  ['--color-ink', '--color-card', 4.5, 'card text'],
  ['--color-ink', '--color-sunken', 4.5, 'text on sunken surfaces'],
  ['--color-muted', '--color-bg', 4.5, 'secondary text on page'],
  ['--color-muted', '--color-card', 4.5, 'secondary text on cards'],
  ['--color-muted', '--color-sunken', 4.5, 'segmented/date chips'],
  ['--color-on-primary', '--color-primary', 4.5, 'primary buttons'],
  ['--color-on-primary', '--color-primary-hover', 4.5, 'primary button hover'],
  ['--color-on-danger', '--color-danger-strong', 4.5, 'danger buttons/badges'],
  ['--color-danger', '--color-card', 4.5, 'inline errors, danger-quiet buttons'],
  ['--color-danger', '--color-error-bg', 4.5, 'error banner/pill'],
  ['--color-success', '--color-success-bg', 4.5, 'success banner/pill'],
  ['--color-warning', '--color-warning-bg', 4.5, 'warning banner/pill'],
  ['--color-info', '--color-info-bg', 4.5, 'info banner/pill'],
  ['--color-plum', '--color-plum-soft', 4.5, 'plum pill / demo banner'],
  ['--color-toast-ink', '--color-toast-bg', 4.5, 'toast text'],
  ['--color-toast-action', '--color-toast-bg', 4.5, 'toast Undo'],
  ['--color-cat-safe', '--color-card', 3, 'hero number (large text)'],
  ['--color-danger', '--color-card', 3, 'negative hero number (large text)'],
];

for (const [theme, t] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, min, where] of PAIRS) {
    test(`${theme}: ${where} (${fg} on ${bg}) >= ${min}:1`, () => {
      assert.ok(t[fg] && t[bg], `missing token ${fg} or ${bg}`);
      const r = ratio(t[fg], t[bg]);
      assert.ok(r >= min, `${t[fg]} on ${t[bg]} = ${r.toFixed(2)}:1`);
    });
  }
}

test('light theme: links/active nav use --color-primary on page and accent-soft', () => {
  assert.ok(ratio(light['--color-primary'], light['--color-bg']) >= 4.5);
  assert.ok(ratio(light['--color-primary'], light['--color-accent-soft']) >= 4.5);
});
test('dark theme: links/active nav use --color-accent on page and accent-soft', () => {
  assert.ok(ratio(dark['--color-accent'], dark['--color-bg']) >= 4.5);
  assert.ok(ratio(dark['--color-accent'], dark['--color-accent-soft']) >= 4.5);
});

test('component CSS uses tokens, not raw hex colors', () => {
  for (const f of fs.readdirSync(STYLES).filter((n) => /^0[2-9]_.*\.css$/.test(n))) {
    const css = fs.readFileSync(path.join(STYLES, f), 'utf8');
    const hits = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    assert.deepEqual(hits, [], `${f} has raw colors: ${hits.join(', ')}`);
  }
});
