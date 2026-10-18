# Reps, customers, and SKUs

The week filters, the rep board, the week charts, and the invoice table show who sold what in the selected week. Search and the salesperson filter apply to that week only. Customer labels are the short customer name, not the raw trading-partner string.

## Sub-features

- `filter-rep` limits the week to one salesperson. The option value is the full name.
- `filter-department` limits the week to `Galaxy`, `Galaxy - KA`, or `KA`.
- `filter-search` matches invoice, customer, trading partner, SKU, product model, product name, and salesperson inside the selected week.
- `rep-board` lists each rep who has lines this week, with this-week HKD and the prior-period HKD.
- `line-detail` shows one row per invoice, 40 invoices per page, default sort date descending.
- `line-sort-page` reorders by the column buttons and moves with Previous and Next.

## How to get to it (user POV)

- Use the Salesperson, Department, and Search filters in the bar under Import raw data.
- Read Rep board under the monthly section.
- Read Week line detail at the bottom. Sort by Date, Customer, Salesperson, Qty, or Revenue. Use Next when the week has more than 40 invoices.

## Driving it with verify.mjs

Preconditions:

- Doctor has passed.
- `open` has loaded the seed and the review week value is `2026-W42`.
- Footer text contains `bundled seed`.

- **Default board and table.** Run `expect-text --text "51 invoices this week"`. Region `Rep month-over-month` contains `Aaron`, `Kelvin`, and `Kenny`. The heading `Week line detail` is followed by `Page 1 / 2 · 51 invoices`. Run `expect-disabled --role button --name Previous` and `expect-enabled --role button --name Next`.
- **Next page.** Run `click --role button --name Next`. The line-detail header contains `Page 2 / 2`. Run `expect-disabled --role button --name Next` and `expect-enabled --role button --name Previous`.
- **Search one invoice.** Run `fill --label Search --value "GAL26-10-12-001"`. The filter line reads `1 invoices this week`. The line table contains `GAL26-10-12-001`, `ADDL`, and `HK$10,560`.
- **Clear search.** Run `fill --label Search --value ""`. The filter line reads `51 invoices this week` again.
- **Rep filter.** Run `select --label "Salesperson" --value "Aaron Chang"`. The combobox value is `Aaron Chang`. The rep board contains `Aaron` and does not contain `Kelvin`. Region `Monthly sales` still contains `Kelvin` in the sell-out list, because that pie is not clipped by the rep filter.
- **Department filter.** Run `open` to clear the rep filter, then `select --label "Department" --value "KA"`. The department value is `KA`. Week `2026-W42` has no KA invoices, so the filter line reads `0 invoices this week`.
- **Proof.** After the invoice search, and before clearing it, run `screenshot --name line-detail-invoice --scope css:.table-wrap` and `aria --name line-detail-invoice --scope css:.table-wrap`. Both show `GAL26-10-12-001` and `ADDL`.

## Gotchas

- Salesperson visible labels are the first token only (`Aaron`, `Kelvin`, `Kenny`). The value submitted by the control is `Aaron Chang`, `Kelvin Lai`, or `Kenny Ma`. Select by value.
- `Galaxy` and `Galaxy - KA` are different departments. Selecting `Galaxy` does not include `Galaxy - KA`.
- Search is case-insensitive and applies on top of the week, salesperson, and department. An October invoice searched while the week is `2026-W45` matches nothing.
- The filter meta pluralizes poorly: one match renders `1 invoices this week`. That is the string to assert.
- The line table groups lines into one row per invoice. `GAL26-10-12-001` is two seed lines and one table row, revenue `HK$10,560`.
- Customer cells use the short customer name. `ADDL` is already short. Do not assert the trading-partner string `Advantage Digital Ltd.` in the table.
- Chart figcaptions `Reps · this week vs same period last month`, `Days in review week`, `Top customers this week`, and `Top product models (qty)` are the week charts. Their tick labels are SVG. Prove the rep filter with the rep board and the line table.
- Sort button `Salesperson` is a button. The filter is a combobox with the same accessible name. Use `--role button` versus `--label`.
- Rep-board absence of `Kelvin` after the Aaron filter is not the same as the sell-out pie. The pie keeps every rep.
