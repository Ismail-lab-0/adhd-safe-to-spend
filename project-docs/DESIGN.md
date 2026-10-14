# Design system

Tokens: `app_src/styles/01_tokens.css` (the only file with raw colors, enforced
by `tests/unit/design.test.js`). Components: `03_components.css`. Shell:
`04_layout.css`.

## Direction
Calm, warm and decisive. One loud thing per screen, everything else quiet. Warm
terracotta and plum on warm paper, deliberately not the teal/green "calm
fintech" look most competitors use (spec.md → Design). Rounded geometric
headings (Quicksand Bold, embedded, OFL) give the number a friendly, legible
face. Body text uses the system UI font stack.

## Hierarchy rules
- **Today**: the Safe-to-Spend number is the only display-size element
  (`--text-hero`, clamp 44–64px). It is green when positive, red with a
  "short by" explanation when negative. Everything that explains it (breakdown,
  balance, payday) sits inside the same card, one level quieter.
- **List screens** share one template, the page grid: summary stats → "add"
  card → list. On desktop the list leads on the left and the add card sticks on
  the right.
- Colour is never the only signal. Every category colour has a text label,
  status uses pills with words ("Overdue", "Paid · next Nov 1"), and the debt
  focus row carries "Pay this first".

## Tokens
| Group | Tokens |
|---|---|
| Surfaces | `--color-bg`, `--color-card`, `--color-sunken`, `--color-border(-strong)` |
| Text | `--color-ink`, `--color-muted`, `--color-faint` (placeholders only) |
| Brand | `--color-accent` (decorative), `--color-plum`, `-soft` tints |
| Solid fills with white text | `--color-primary(-hover)` / `--color-on-primary`, `--color-danger-strong` / `--color-on-danger`. **Fixed across themes**: theme-adaptive accents get lighter in dark mode, which fails contrast as a button fill |
| Semantic | `--color-success/-warning/-info/-danger` + `-bg` tints |
| Breakdown | `--color-cat-bills` / `-setaside` / `-savings` / `-safe` |
| Space | `--space-1…7` (4, 8, 12, 16, 24, 32, 48) |
| Radius | `--radius-sm` 10 (controls), `-md` 14 (cards), `-lg` 20 (dialogs) |
| Type | `--text-xs…2xl`, `--text-hero`, `--leading-tight/normal` |
| Layout | `--tap` 44px, `--content-max` 1120px, `--sidebar-w`, `--tabbar-h` |

Contrast: every text pair in both themes is ≥ 4.5:1 (large hero text ≥ 3:1),
computed in `tests/unit/design.test.js`. The pipeline's
`validators/app_check.py` re-checks its required pairs on the built file.

## Components (when to use which)
- **Buttons**: `btn-primary` (one per card, the main action), `btn-secondary`,
  `btn-ghost` (low-emphasis, e.g. "Later"), `btn-danger` (confirm dialogs only),
  `btn-danger-quiet` (the entry point to a destructive action), `btn-sm` (40px,
  in-row actions), `icon-btn` (44×44, always has `aria-label`), `link-btn`.
- **Fields**: `ui.field()` always renders label + control + help + error slot.
  The money prefix uses the current currency symbol, with `inputmode="decimal"`.
  Errors appear inline under the field, in red with a red border, and focus
  moves to the field.
- **Segmented control**: for 2–3 mutually exclusive choices that apply
  immediately (spent/income, snowball/avalanche, theme). Real radio inputs, so
  arrow keys work.
- **Lists**: `list-item` with date chip, title/meta, right-aligned tabular
  amount, actions. Use `card-flush` for full-bleed rows.
- **Pills**: short status words only.
- **Dialogs**: native `<dialog>` with a focus trap, Esc and backdrop close,
  Cancel + one primary action. Delete sits apart on the left. Bottom sheet
  under 520px.
- **Toasts**: confirmations, with **Undo** after any destructive or
  balance-changing action. Persistent problems use **banners** instead.
- **Empty states**: icon, plain sentence, and the next action.

## Responsive
One breakpoint for the shell (760px): bottom tab bar on phones, sidebar from
tablet up. Content regroups at 1100px (two columns). Verified by
`tests/e2e/e2e_journeys.py` at 360/390/768/1024/1440 in both themes (no
horizontal overflow, nothing past the right edge) plus a 44px touch-target
sweep.

## Motion
Short (120–200ms) eased transitions on hover/press/progress, and a toast
slide-in. All disabled under `prefers-reduced-motion`.
