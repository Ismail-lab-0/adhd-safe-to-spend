#!/usr/bin/env node
/**
 * Inline a product's app_src/ into one self-contained HTML file.
 *
 * Usage: node tools/app_bundle.js <product_dir> --title "App Name" [--demo]
 *   <product_dir>/app_src/index.html    shell with <!--STYLES--> and <!--SCRIPTS--> markers
 *                                        and a literal __TITLE__ placeholder
 *   <product_dir>/app_src/styles/*.css  concatenated in filename order into one <style> block
 *   <product_dir>/app_src/modules/*.js  concatenated in filename order (each registers itself
 *                                        on window.App.views[id] — see tools/app_template_modular)
 *   <product_dir>/app_src/main.js       appended last (calls AppRouter.init())
 *
 * Output: --demo  -> <product_dir>/demo/demo.html     (window.APP_DEMO_MODE = true) — the
 *                     gated public preview, hosted at the discoverable Pages route.
 *         default  -> <product_dir>/deploy/index.html (window.APP_DEMO_MODE = false) — the
 *                     full, unrestricted build. This is a DEPLOY artifact (hosted, not
 *                     shipped) — never under files/: validators/product_check.py treats
 *                     every file in files/ as an Etsy digital_file, and for type=app
 *                     those are only the two guide PDFs (see tools/app_kit.py).
 *
 * Intentionally NOT a general-purpose module bundler: no import/export resolution, just
 * deterministic concatenation of small, dependency-free files in filename order. That's
 * enough for this pipeline's product scale (a handful of view modules) while keeping the
 * output provably self-contained — validators/app_check.py re-checks that invariant on
 * whatever this script produces, same as it always has for the hand-authored template.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DISALLOWED = [
  /<(?:script|img|iframe|source|video|audio|link)\b[^>]*?\b(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i,
  /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|new\s+EventSource/,
  /google-analytics|googletagmanager|gtag\(|fbq\(|hotjar|segment\.com|mixpanel|plausible/i,
];

function readDirSorted(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort()
    .map((f) => path.join(dir, f));
}

function concat(files) {
  return files.map((f) => fs.readFileSync(f, 'utf8')).join('\n\n');
}

function bundle(productDir, { title, demo }) {
  const srcDir = path.join(productDir, 'app_src');
  const shellPath = path.join(srcDir, 'index.html');
  if (!fs.existsSync(shellPath)) {
    throw new Error(`${shellPath} not found — scaffold app_src/ first (see tools/app_template_modular)`);
  }
  let shell = fs.readFileSync(shellPath, 'utf8');
  const css = concat(readDirSorted(path.join(srcDir, 'styles'), '.css'));
  const moduleFiles = readDirSorted(path.join(srcDir, 'modules'), '.js');
  const mainPath = path.join(srcDir, 'main.js');
  if (!fs.existsSync(mainPath)) throw new Error(`${mainPath} not found`);
  const routerPath = path.join(srcDir, 'router.js');
  const routerJs = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, 'utf8') : '';
  const js = [
    `window.APP_DEMO_MODE = ${demo ? 'true' : 'false'};`,
    routerJs,
    concat(moduleFiles),
    fs.readFileSync(mainPath, 'utf8'),
  ].filter(Boolean).join('\n\n');

  if (!shell.includes('<!--STYLES-->') || !shell.includes('<!--SCRIPTS-->')) {
    throw new Error('app_src/index.html is missing the <!--STYLES--> or <!--SCRIPTS--> marker');
  }
  // Function-form replacements: a string replacement would treat $&, $`, $', $$, $<n>
  // in the replacement text as special patterns (e.g. "$'" means "everything after the
  // match"), which silently corrupts output the moment app_src content contains a
  // literal "$'" — easy to hit by accident in ordinary money-formatting JS/CSS like
  // `'$' + amount`. A function replacement never interprets its return value that way.
  shell = shell
    .replace(/__TITLE__/g, () => title || 'App')
    .replace('<!--STYLES-->', () => `<style>\n${css}\n</style>`)
    .replace('<!--SCRIPTS-->', () => `<script>\n${js}\n</script>`);

  for (const pattern of DISALLOWED) {
    if (pattern.test(shell)) {
      throw new Error(`bundled output matched a disallowed pattern (${pattern}) — ` +
        'self-contained apps may not load external resources, call the network, or ' +
        'include trackers. Fix app_src/ before re-running (validators/app_check.py would ' +
        'reject this too; this is just a faster local check).');
    }
  }
  return shell;
}

function main(argv) {
  const positional = [];
  let title = '';
  let demo = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--demo') demo = true;
    else if (a === '--title') title = argv[++i];
    else positional.push(a);
  }
  if (!positional[0]) {
    console.error(__filename + ': missing <product_dir>');
    return 2;
  }
  const productDir = positional[0];
  const html = bundle(productDir, { title, demo });
  const outDir = path.join(productDir, demo ? 'demo' : 'deploy');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, demo ? 'demo.html' : 'index.html');
  fs.writeFileSync(outPath, html);
  console.log(outPath);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { bundle };
