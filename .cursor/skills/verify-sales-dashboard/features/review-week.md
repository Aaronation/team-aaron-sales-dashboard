# Review week

Review week lets a manager choose an ISO week and compare that week's sell-out with the same calendar dates one month earlier. The hero, the scorecard, the rep board, and the line table follow the week. Month totals do not.

## Sub-features

- `week-default` opens the latest week present in the seed, `2026-W42` (`2026-10-12` through `2026-10-18`).
- `week-readout` shows that week in the hero and the combobox together.
- `week-mom` labels the baseline as the same calendar dates last month, not the previous ISO week.
- `week-change` moves the hero, the MoM line, and the scorecard amounts when the week changes.
- `week-working-days` counts Monday–Friday through the latest entry in the review month, and not past the week's end. For 2026 it excludes gazetted Hong Kong holidays.

## How to get to it (user POV)

- Open the app. The review week combobox is the first filter, under Import raw data and above the scorecard.
- Read the hero aside. It shows the selected week and the MoM baseline.
- Choose another week in Review week. The scorecard heading `This week (HKD)` updates to that ISO key.

## Driving it with verify.mjs

Preconditions:

- Doctor has passed for this run.
- `open` has loaded the seed. The footer contains `bundled seed`.
- No import has been applied in this browser context.

- **Open on the seed week.** Run `node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs open`, then `expect-value --label "Review week" --value 2026-W42`, `expect-exact --scope css:.hero__week --text "2026-W42 · 10-12 → 10-18"`, and `expect-exact --scope css:.hero__aside-meta --text "MoM vs prior month 09-12 → 09-18"`. The scorecard region contains `This week (HKD) · 2026-W42`, `HK$166,800`, and `HK$616,928`.
- **Working days.** In region `Weekly scorecard`, expect `7 of 20`, `Mon–Fri through 10-12`, and `HK public holidays excluded`. The seeded latest October entry is 10-12, which is before the week ends on 10-18.
- **Change week.** Run `select --label "Review week" --value 2026-W41`. The combobox value is `2026-W41`. The hero text is `2026-W41 · 10-05 → 10-11`. The aside is `MoM vs prior month 09-05 → 09-11`. The scorecard shows `HK$464,741` for this week and `HK$742,757` for the prior period.
- **Proof.** Run `screenshot --name review-week-w41 --scope "Weekly scorecard"` and `aria --name review-week-w41 --scope "Weekly scorecard"`. Both show `2026-W41` and `HK$464,741`.

## Gotchas

- The option value is `2026-W41`. The visible option text is `2026-W41 · 10-05 → 10-11`. `selectOption` must use the value. The same date text also sits inside the closed select, so a page-level text search is not proof of the selection. Use `expect-value` and `css:.hero__week`.
- MoM is a calendar shift of one month. `2026-W42` (`10-12 → 10-18`) compares with `09-12 → 09-18`, not with `2026-W41`.
- `2026-W32` (`08-03 → 08-09`) compares with `07-03 → 07-09`. The seed has no July rows, so the prior amount is zero and the delta can read `new`. That is the compare, not a broken week.
- The select lists only weeks that have lines. There is no All weeks choice. After a replace import, weeks that were only in the seed disappear and the selected week moves to the latest week that remains.
- Changing the week highlights a different row in the month table when the week's month changes. It does not change month totals. Those ignore the review week.
- The scorecard week label is the ISO key (`2026-W42`). The hero is the key plus the date range.
- The working-day hint uses an en dash: `Mon–Fri through 10-12`.
