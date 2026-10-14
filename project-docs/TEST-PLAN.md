# Test plan

Run everything: `tests/run_all.sh` (unit → build → pipeline validator on both
builds → end-to-end).

| Layer | Command | Covers |
|---|---|---|
| Unit: core + logic | `node --test tests/unit/*.test.js` | cents parsing/format, local dates and month-end anchoring, DST, schema sanitize (malformed, duplicate, newer, partial), storage (corrupt → recovery key, quota, unavailable, round trip), bill schedules and roll-forward, the Safe-to-Spend formula with worked examples, payday windows, debt ordering, Wait List timing, every action's validation + balance effects + undo, and "no action can produce state that sanitize would change" |
| Unit: design | (same command) `design.test.js` | WCAG contrast for every text pair in both themes; no raw hex outside the token file |
| Pipeline audit | `python3 ../../validators/app_check.py deploy/index.html spec.md` (and `demo/demo.html`) | self-contained, no network/trackers, tokens present, contrast, every nav view distinct, spec smoke test (add "Rent", reload, still there), no overflow at 390/1280 |
| End-to-end (real built files, Chromium) | `python3 -m pytest -q tests/e2e/e2e_journeys.py` | first-run onboarding → real number → reload; inline validation; every-N fields; pay from Today + undo; bills toggle/edit/delete/undo; quick log + delete; negative balance; breakdown math; debt strategy + payment bill; savings protect money + Esc closes dialogs; Wait List 48h gate/buy/skip/history; theme + currency persist; backup export → import into a fresh browser, bad/newer files rejected without data loss; erase needs confirmation; corrupt/partial storage; paid-cycle roll-forward; demo separate storage + 3-bill cap; layout sweep (5 widths × 2 themes × 6 views); touch targets ≥ 40px |
| Offline + updates | `python3 ../../pipeline/deploy.py verify-offline <url>` | load online → offline → reload still works. Manually verified (2026-10-14) on a local server: after a redeploy, an installed copy shows the new build on the next load, and old caches are pruned |
| Visual | `python3 tests/e2e/shots.py deploy/index.html <out> --widths=390,768,1440 --themes=light,dark --views=dashboard,bills,debt,savings,waitlist,settings --states=empty,sample` | screenshots for human review against `../../docs/ui_visual_review_checklist.md` |

## Manual checks before each release
- Real iPhone Safari: Add to Home Screen, open offline, date pickers, bottom
  sheet dialogs, safe-area padding.
- Export on mobile saves a file the user can find again.
- Screen reader spot check (VoiceOver): nav labels and badges, hero number
  announced, dialog titles, field errors.
