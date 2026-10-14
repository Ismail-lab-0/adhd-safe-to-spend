# ADHD Safe to Spend

A calm, browser-based budget planner for ADHD and other neurodivergent brains. One number — what is actually safe to spend today — computed from your balance, unpaid bills (including ones that do not land monthly), and money already set aside for savings goals.

**Try the free demo:** https://ismail-lab-0.github.io/adhd-safe-to-spend/ (feature-limited preview)

**Full version (buyers):** https://ismail-lab-0.github.io/adhd-safe-to-spend/app-574278ef/

## Features

- **Safe to spend until payday**: balance − unpaid bills due before your next payday (including overdue and repeating ones) − money set aside for bigger bills − savings, with a plain "how we got this number" breakdown and an approximate daily amount
- **Bills** on their real schedule: weekly, every 2 weeks, monthly, every N months (with gradual set-aside), or one time; one-tap paid toggle
- **Debt** payoff order (snowball or avalanche) with a clear "pay this first", and minimum payments that can count in your number
- **Savings goals and envelopes** that protect money from being spent
- **48-hour Wait List** for impulse buys: "Buy it" unlocks only after the wait, and money kept by skipping is counted
- Quick spend/income log, undo on every destructive action, light/dark/auto theme, 15 display currencies
- Works offline once opened (installable to your Home Screen); no account, no bank connection, no subscription, no analytics
- Backup to a file and restore it on any device or browser

## Setup

This is a static, self-contained HTML app — no build step required to run it.
Open `index.html` directly, or serve the repo's `docs/` folder (this is what
GitHub Pages does automatically for this repo).

## Limitations

- Data is stored locally in the browser only — export a backup periodically, especially before switching devices.
- No cross-device sync — this was considered and intentionally rejected (no backend infrastructure in this project's static-hosting deploy model); use export/import to move data between devices.

## Development

`app_src/` is plain HTML/CSS/JS (no framework, no npm packages), concatenated in
filename order by `tools/app_bundle.js`. Pure logic lives in
`app_src/modules/0*_*.js`; `node --test tests/unit/*.test.js` runs its tests.
Product, architecture, data-model, design and test documentation is in
`project-docs/`.

## Deployment

Published via GitHub Pages from the `docs/` folder on `main`. The demo build (if any) and the full build are generated from the same source by `tools/app_bundle.js` — see that script for the `--demo` flag.
## Demo gating

The public demo (`docs/index.html`) sets `window.APP_DEMO_MODE = true` and caps
bills at 3 — a client-side UX nudge, not DRM. The full build at `docs/app-574278ef/`
has no such flag and no cap. Both are generated from the same `app_src/` by
`tools/app_bundle.js` (`--demo` flag toggles which one you get).
