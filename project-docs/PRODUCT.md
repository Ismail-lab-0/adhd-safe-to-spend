# Product — Safe to Spend (ADHD Budget Planner)

Source of truth: [`../spec.md`](../spec.md) (approved at Gate 1, features decided in
[`../opportunities.json`](../opportunities.json)). This document records how the
build interprets it. If the two disagree, the spec wins and this file is wrong.

## Customer and problem
An adult with ADHD who has tried and dropped budgeting spreadsheets or complex
finance apps. They don't need categories and reports. They need to answer one
question quickly and correctly: **"How much can I spend before payday without
coming up short?"**, with no formulas, no bank login and no account.

## The core journey (under a minute)
1. Type the balance from your banking app.
2. Set the next payday.
3. Add the bills that have to be paid.
4. → **Today** shows one number: safe to spend until payday, plus about how much
   per day.

Day to day: open the app, look at the number, and log a spend in one field. Tap
**Paid** when a bill goes out.

## Screens (the 6 views in spec.md's acceptance block)
| View | Job | Key interactions |
|---|---|---|
| **Today** | The number, and why it is that number | Balance and payday (dialogs), "How we got this number" breakdown, quick log (spent / got paid), bills before payday with one-tap Paid, recent activity with delete, first-run 3-step checklist |
| **Bills** | Everything that must be paid, on its real schedule | Add (weekly / every 2 weeks / monthly / every N months / one-time), paid toggle, edit/delete, overdue / coming up / paid groups, monthly-equivalent total |
| **Debt** | A payoff order to follow | Add debts (balance, APR, minimum), snowball/avalanche switch, numbered order with "Pay this first", put a minimum payment on Bills |
| **Savings** | Protect money from being spent | Goals (target) and envelopes (earmarked), add/take out money, progress |
| **Wait List** (differentiator) | A pause before impulse buys | Add item → live 48-hour countdown → "Buy it" (logs the spend) unlocks only after 48h. "Don't need it" works any time, and the money kept is counted |
| **Settings** | Preferences and data safety | Theme (auto/light/dark), currency (display only), export/restore backup, erase all, plain-language "where your data lives" |

## Product decisions that interpret the spec
- **"Bills due before next payday"** = unpaid occurrences due *strictly before*
  the payday date, including overdue ones and repeat occurrences (e.g. a weekly
  bill counts twice in a 2-week window). With no payday set, the window is the
  next 30 days, and the UI says so. Details: [`DATA-MODEL.md` §4](DATA-MODEL.md#4-safe-to-spend-the-formula).
- **Every-N-months "set aside"** (spec: "a per-month set-aside amount"): the
  amount accrues evenly across the cycle and is held back from the number, so
  the full amount is ready by the due date.
- **Debt payments in the number** (spec's buyer promise: "after bills, debt
  payments, and savings goals are already accounted for"): a debt's minimum can
  be added to Bills as a linked monthly bill. That reuses the one bill engine
  instead of a second, parallel debt-payment calculation. Interest is not
  modelled; the user updates the balance from statements.
- **Balance model**: the balance is a checkpoint the user types in. Logged
  spending and income, paid bills and Wait List purchases adjust it. Typing a new
  balance resets it. It can go negative and is shown honestly, never clamped to $0.
- **Demo** (spec `"demo": true`): the same app with a 3-bill cap, a separate
  storage key, and a one-tap "Fill in example numbers" (clearly labelled
  examples).

## Non-goals (from spec.md → Excluded)
Cross-device sync, bank linking, investments/net worth, app-store distribution,
multi-language UI, spending charts/insights. Also not built: accounts, analytics,
any network call after load.

## Honest limitations (also stated in-app and in the guides)
- Data lives only in the browser it was entered in. Clearing site data erases it.
  Phone and laptop don't sync; Export/Restore moves data between them.
- The full-version URL is link-based distribution. It is not access-controlled.
- Demo gating is client-side, a nudge rather than DRM.
- Currency changes the display only; nothing is converted.
- Not financial advice and not a clinical tool. No ADHD medical claims anywhere.
