# Data model

Code: `app_src/modules/02_core_schema.js` (shape + `sanitize`), `08_actions.js`
(all mutations), `06_logic_safe_to_spend.js` (the formula).

## 1. Root (schemaVersion 1)
```js
{
  schemaVersion: 1,
  settings: { currency: 'USD', theme: 'system'|'light'|'dark', lastBackupAt: 'YYYY-MM-DD'|null, onboardingDismissed: bool },
  balance:  { cents: int|null, updatedOn: 'YYYY-MM-DD'|null },   // null = never entered (not $0)
  payday:   { next: 'YYYY-MM-DD'|null, cadence: 'weekly'|'biweekly'|'monthly'|'irregular' },
  bills:    [Bill], debts: [Debt], debtStrategy: 'snowball'|'avalanche',
  goals:    [Goal], waitlist: [WaitItem], activity: [Activity]   // activity: newest first, max 200
}
Bill     { id, name, amountCents, cadence: 'weekly'|'biweekly'|'monthly'|'every_n_months'|'one_off',
           everyN: 2..24|null, setAside: bool, dueDate, anchorDay: 1..31, paid: bool, debtId: id|null }
Debt     { id, name, balanceCents, aprBps: 0..20000, minPaymentCents }
Goal     { id, name, kind: 'goal'|'envelope', targetCents|null, savedCents }
WaitItem { id, name, priceCents, addedAt: epoch ms, status: 'waiting'|'bought'|'skipped', resolvedOn|null }
Activity { id, kind: 'spend'|'income'|'bill_paid'|'waitlist_bought', amountCents, label, date, refId|null }
```

## 2. Rules every value obeys
- **Money is integer cents**: parsed once by `money.parseCents`, which rejects
  more than 2 decimals and negatives (except the balance). APR is integer basis
  points.
- **Dates are local calendar strings**, never `toISOString()`, which gives the
  UTC date and is wrong late at night away from UTC.
- **Names** are whitespace-collapsed and capped at 60 characters. Ids are
  `[A-Za-z0-9_-]{1,40}` and unique per collection.
- A bill stores **only its current cycle**. `anchorDay` keeps a 31st-of-month
  bill on the 31st after short months.

## 3. Balance model
The balance is a checkpoint (`setBalance`). Adjusted by:
| Action | Balance | Activity |
|---|---|---|
| `logActivity` spend / income | − / + | spend / income (deletable, which reverses it) |
| `setBillPaid` true / false | − / + (reverses the latest payment) | bill_paid added / removed |
| `resolveWait` bought | − | waitlist_bought |
With no balance entered, bill/Wait List actions don't adjust anything, and quick
log asks for a balance first.

## 4. Safe to Spend: the formula
```
window_end = first payday strictly after today       (payday today = received)
           | today + 30 days                          (no payday, or a passed "irregular" one)
bills_due  = Σ unpaid occurrences with date < window_end   (current cycle incl. overdue + derived repeats)
set_aside  = Σ for every-N-months bills with setAside, unpaid, NOT already in bills_due:
               amount × (days elapsed in cycle ÷ cycle length)
savings    = Σ goals.savedCents
safe       = balance − bills_due − set_aside − savings        (may be negative; shown as a shortfall)
per_day    = floor(safe ÷ max(1, days until window_end))  when safe > 0, else 0
```
Paid cycles whose due date has passed are rolled forward before counting, and
paying an overdue cycle rolls the bill straight to its next one. Worked examples
are in `tests/unit/logic.test.js` ("compute: …").

## 5. Versioning and migration
`sanitize()` refuses anything without a numeric `schemaVersion` or with one
newer than the app's. Older versions upgrade step by step in `migrate()` (none
yet). New fields get defaults in `sanitize`, so a v1 blob missing a field still
loads.

## 6. Backup file
The export is the state tree plus `{app: 'adhd-safe-to-spend', exportedAt}`.
Import accepts any file `sanitize()` accepts, rejects files over 5 MB, and always
asks before replacing.
