# Monthly sales

Monthly sales shows each calendar month's total sell-out for the lines currently loaded. The review week does not clip the month. The highlighted row is the month of the selected week.

## Sub-features

- `month-table` lists every month present in the loaded lines, with HKD, quantity, invoices, customers, and the team target when all reps are selected.
- `month-highlight` marks the review week's month with `review month`.
- `month-ignores-week` keeps the month's HKD the same when the week changes inside that month.
- `month-empty` shows `No sales in the current filters.` when a search or department matches nothing.

## How to get to it (user POV)

- Scroll to the Monthly sales heading, under the scorecard.
- Read the bar chart caption `Total sales by month (HKD)` and the table whose first column is Month.
- The selected week's month row includes the text `review month`.

## Driving it with verify.mjs

Preconditions:

- Doctor has passed.
- `open` has loaded the seed. No sample import yet, so November is absent.
- Salesperson value is `all` (visible label `All reps`).

- **Seed months.** In region `Monthly sales`, expect `Aug 2026`, `Sep 2026`, and `Oct 2026`. Run `expect-absent --text "Nov 2026" --scope "Monthly sales"`.
- **Amounts.** Run `expect-row --scope "Monthly sales" --row "Aug 2026" --text "HK$1,913,059"`, the same for `Sep 2026` / `HK$2,584,748`, and for `Oct 2026` / `HK$725,442`. The Oct row also contains `review month` while the week value is `2026-W42`.
- **Targets stay visible for all reps.** The Oct row contains `HK$3,300,000`. The Aug row contains `HK$3,500,000`.
- **Week inside October does not change the month amount.** Run `select --label "Review week" --value 2026-W41`. The Oct row still contains `HK$725,442` and `review month`. The hero week is `2026-W41 · 10-05 → 10-11`.
- **Proof.** Run `screenshot --name monthly-sales-seed --scope "Monthly sales"` and `aria --name monthly-sales-seed --scope "Monthly sales"`. Both show `Oct 2026`, `HK$725,442`, and `review month`.

## Gotchas

- Month totals ignore the review week. They still follow salesperson, department, and search. A rep filter changes the month HKD and hides the team-target column.
- The highlighted row follows the week's month. `2026-W42` and `2026-W41` are both October. `2026-W36` (`08-31 → 09-06`) highlights September because the highlight uses the week's end date.
- November is not in the seed. It appears only after an import that contains November lines. Do not treat a missing `Nov 2026` on a fresh `open` as a failed month chart.
- Assert the Month table via `expect-row`. The bar chart draws the same totals as SVG ticks (`k`), which are the wrong string to match.
- The scope note under the heading reads `All reps and departments. Month totals ignore the review week. The sell-out pie keeps every rep.` when no filter is set.
