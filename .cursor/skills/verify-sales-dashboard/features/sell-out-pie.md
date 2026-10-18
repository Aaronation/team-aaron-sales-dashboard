# Sell-out pie

The sell-out pie is each salesperson's share of line `totalAmount` for the calendar month of the review week. The rep filter does not hide other slices. The list under the pie is the text proof.

## Sub-features

- `share-month` follows the review week's month, not the week itself. Caption: `Sell-out share · Oct 2026` on the seed's default week.
- `share-list` shows the short rep name, percent to one decimal, and HKD.
- `share-ignores-rep-filter` keeps every rep in the pie when Salesperson is not All reps.
- `share-small-slices` omits on-wedge labels below 15%. Those percents remain in the list.

## How to get to it (user POV)

- In Monthly sales, read the figure captioned `Sell-out share` plus the month name.
- Read the list under the pie. Do not rely on the wedge labels alone.
- Change Review week to a week in another month to move the pie. Change Salesperson and confirm the other reps stay in the list.

## Driving it with verify.mjs

Preconditions:

- Doctor has passed.
- `open` has loaded the seed. Review week value is `2026-W42`.
- Salesperson is `all`.

- **October list.** Run `expect-text --text "Sell-out share · Oct 2026" --scope "Monthly sales"`. On `css:.share-list`, `expect-count` exact `Aaron` 1, `50.4%` 1, `HK$365,530` 1, `Kelvin` 1, `31.0%` 1, `HK$224,887` 1, `Kenny` 1, `18.6%` 1, `HK$135,025` 1. `Riley` is absent from `css:.share-list`.
- **Rep filter does not clip the pie.** Run `select --label "Salesperson" --value "Aaron Chang"`. `css:.share-list` still contains `Kelvin` and `Kenny`. The rep board region does not contain `Kelvin`.
- **Proof.** Run `screenshot --name sell-out-oct --scope css:.share-list` and `aria --name sell-out-oct --scope css:.share-list` before the rep filter. Both show `Aaron`, `50.4%`, and `HK$365,530`.

## Gotchas

- Share is the month of the week's end. `2026-W42` and `2026-W41` both use October. `2026-W45` uses November, which the seed does not contain until an import.
- The salesperson filter changes week charts, the rep board, and month totals. It does not change who appears in this pie. Department and search do narrow the pie.
- Wedge labels are omitted under 15%. Kenny's October share is 18.6% and is labeled; a 10% slice is not labeled on the wedge and is still in `.share-list`. Assert the list.
- Names in the list are the first token (`Aaron`), not `Aaron Chang`.
- Order is by sell-out descending. Ties keep the order the lines were first seen.
- A fresh seed has no Riley slice. Riley appears on the November pie after the sample import, at 10.0% and `HK$3,000`.
