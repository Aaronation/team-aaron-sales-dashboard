# Monthly sales

Monthly sales shows each calendar month's total sell-out for the lines currently loaded. The review week does not clip the month. The highlighted row is the month of the selected week.

## Sub-features

- `month-table` lists every month present in the loaded lines, with HKD, quantity, invoices, customers, and the team target when all reps are selected.
- `month-highlight` marks the review week's month with `review month`.
- `month-ignores-week` keeps the month's HKD the same when the week changes inside that month.
- `month-empty` shows `No sales in the current filters.` when a search or department matches nothing.
- `month-days-mom` draws this month’s working days as a solid line and last month on the same working-day index as a dashed line.
- `month-customers-mom` draws two bars per top customer for month-to-date through the selected week: this period, and last month on the same working-day count. Both bars follow the salesperson filter.
- `month-models-reps` stacks each top model by salesperson for that same month-to-date window. Aaron, Kelvin, and Kenny use the sell-out pie colors.

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
- **Review-month days.** In region `Monthly sales`, expect `working-day index` (the shared note under the heading). In figure `Days in review month · Oct 2026`, expect `This month` and `Last month`. Run `screenshot --name month-days --scope "figure:Days in review month · Oct 2026"`.
- **Customer MoM.** In figure `Top customers · Oct 2026`, expect `through 10-18`, `11 working days`, `through 09-15`, `This period`, `Last month`, `W40`, `W41`, and `W42`. Run `screenshot --name month-customers --scope "figure:Top customers · Oct 2026"`.
- **Model reps, same window.** In figure `Top product models · Oct 2026`, expect `through 10-18`, `Aaron`, `Kelvin`, and `Kenny`. Run `screenshot --name month-models --scope "figure:Top product models · Oct 2026"`.
- **Salesperson recomputes both customer bars.** Run `select --label "Salesperson" --value "Kelvin Lai"`. Figure `Kelvin top customers · Oct 2026` contains `Lancer` and does not contain `Vision`. Figure `Kelvin top product models · Oct 2026` contains `Kelvin` and does not contain `Aaron`. Run `select --label "Salesperson" --value "all"` before changing the week.
- **Earlier week shortens MTD.** Run `select --label "Review week" --value 2026-W41`. Figure `Top customers · Oct 2026` contains `through 10-11`, `6 working days`, `through 09-08`, `W40`, and `W41`, and does not contain `W42`. Figure `Top product models · Oct 2026` contains `through 10-11`. The Oct row still contains `HK$725,442`.
- **August has no prior month.** Run `select --label "Review week" --value 2026-W32`. Figure `Days in review month · Aug 2026` contains `No Jul 2026 lines are loaded` and does not contain `Last month`. Figure `Top customers · Aug 2026` contains `through 08-09` and `No Jul 2026 lines are loaded`, and does not contain `Last month`. The Oct row still contains `HK$725,442`.

The commands for the three charts are `features/monthly-charts.drive.sh`.

## Gotchas

- Month totals ignore the review week. They still follow salesperson, department, and search. A rep filter changes the month HKD and hides the team-target column.
- The highlighted row follows the week's month. `2026-W42` and `2026-W41` are both October. `2026-W36` (`08-31 → 09-06`) highlights September because the highlight uses the week's end date.
- November is not in the seed. It appears only after an import that contains November lines. Do not treat a missing `Nov 2026` on a fresh `open` as a failed month chart.
- Assert the Month table via `expect-row`. The bar chart draws the same totals as SVG ticks (`k`), which are the wrong string to match.
- The day chart’s x-axis is the review month’s working-day dates. The dashed line is last month’s revenue at the same index, so day 1 is not the same calendar date. October’s first point is 10-02 against September’s 09-01, because 1 Oct is a public holiday.
- Customer bars are month-to-date from the 1st through the selected week’s end. The muted bar is last month through the working day at the same index (October W42 is 11 working days, through 10-18, against September through 09-15). Changing the week changes that window. The month table still ignores the week.
- This-period customer bars stack ISO weeks inside the month-to-date window, earliest week first: cream, sand (`SAGE`), amber, clay. Last-month bars stay a single muted olive bar. The tooltip names the customer total, not the hovered week. Model stack colors follow the sell-out pie, so Aaron’s segment matches Aaron’s slice. A salesperson filter recomputes both customer bars and the model stacks from those rows. The weekly customer and model charts under the rep board are unchanged.
- The scope note under the heading reads `All reps and departments. Month totals ignore the review week. The sell-out pie keeps every rep.` when no filter is set. The next paragraph is the shared working-day note. Each chart caption under that is one sentence.
