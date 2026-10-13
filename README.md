# ADHD Safe to Spend

A calm, browser-based budget planner for ADHD and other neurodivergent brains. One number — what is actually safe to spend today — computed from your balance, unpaid bills (including ones that do not land monthly), and money already set aside for savings goals.

**Try the free demo:** https://ismail-lab-0.github.io/adhd-safe-to-spend/ (feature-limited preview)

**Full version (buyers):** https://ismail-lab-0.github.io/adhd-safe-to-spend/app-574278ef/

## Features

- Safe-to-spend-today number, recomputed from your balance, unpaid bills, and savings reservations
- Bill tracker with weekly/biweekly/monthly/every-N-months/one-off cadences
- Debt tracker with a chosen snowball or avalanche payoff order
- Savings goals/envelopes with progress tracking
- 48-hour impulse-purchase wait list — add something you want to buy, it only converts to a real spend once the cooling-off period ends
- Works offline once installed to your Home Screen; no account, no bank connection, no subscription
- Manual backup/restore via file export-import

## Setup

This is a static, self-contained HTML app — no build step required to run it.
Open `index.html` directly, or serve the repo's `docs/` folder (this is what
GitHub Pages does automatically for this repo).

## Limitations

- Data is stored locally in the browser only — export a backup periodically, especially before switching devices.
- No cross-device sync — this was considered and intentionally rejected (no backend infrastructure in this project's static-hosting deploy model); use export/import to move data between devices.

## Deployment

Published via GitHub Pages from the `docs/` folder on `main`. The demo build (if any) and the full build are generated from the same source by `tools/app_bundle.js` — see that script for the `--demo` flag.
## Demo gating

The public demo (`docs/index.html`) sets `window.APP_DEMO_MODE = true` and caps
bills at 3 — a client-side UX nudge, not DRM. The full build at `docs/app-574278ef/`
has no such flag and no cap. Both are generated from the same `app_src/` by
`tools/app_bundle.js` (`--demo` flag toggles which one you get).
