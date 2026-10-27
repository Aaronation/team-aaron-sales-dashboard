# Persist and forecast

Targets and forecast sits under the weekly scorecard. It compares the review month’s target with month-to-date sell-out through the review week, calls the pace On track or Behind, and projects a full-month forecast from the Hong Kong working-day run-rate. Merge and Replace are saved in this browser. Refresh restores the lines, the import note, and the review week. Reset to seed clears that save.

## Sub-features

- `forecast-seed-october` on `2026-W42` shows team target `HK$3,300,000`, MTD `HK$725,442`, pace Behind, straight-line `HK$1,815,000`, and forecast `HK$1,318,985`.
- `forecast-saved-week` after a sample merge and `2026-W45` shows Nov 2026 MTD `HK$24,000`, forecast `HK$100,800`, and stays there after `open`.
- `persist-reload` keeps the merge note, `sample-kingdee-import.csv` in the footer, and `Nov 2026` / `HK$30,000` after `open`. The seed file hash does not change.
- `persist-reset` clears the save. The next `open` is the bundled seed, week `2026-W42`, with no November row.
- `persist-replace` after Replace all keeps only the five sample rows across `open`, on week `2026-W46`, with forecast `HK$63,000`.

## How to get to it (user POV)

- Open the app. Read Targets and forecast under the weekly scorecard and above Monthly sales.
- Leave Apply as Merge into current and choose Load sample export.
- Choose review week `2026-W45`. Read the November pace and forecast.
- Refresh the browser. The same week, import note, and November total are still there.
- Choose Reset to seed. Refresh again. The bundled seed is back.
- Choose Replace all, load the sample again, and refresh. Only November remains until the next reset.

## Driving it with verify.mjs

Preconditions:

- Doctor has passed.
- This drive is a fresh browser profile, so `open` loads the seed. Footer contains `bundled seed`.
- Apply as is Merge into current.

The commands below are the file `features/persist-and-forecast.drive.sh`.

- **Seed forecast.** Run `open`, then `sha256 --file public/data/sales-line-items.json --name seed-before`. Review week value is `2026-W42`. Region `Targets and forecast` contains `Oct 2026 · 11 of 20 working days through 10-18. HK public holidays excluded.`, `Team target`, `HK$3,300,000`, `HK$725,442`, `22.0% of target`, `Behind`, `HK$725,442 is below the straight-line HK$1,815,000.`, and `HK$1,318,985`. It does not contain `On track`. Region `Weekly scorecard` contains `HK$166,800` and `Mon–Fri through 10-18`. Region `Import raw data` does not contain `Working set saved in this browser.` Run `screenshot --name 01-seed-forecast --scope "Targets and forecast"` and `aria --name 01-seed-forecast --scope "Targets and forecast"`.
- **Merge and move to November.** Run `click --role button --name "Load sample export"`. The import note includes `5 added, 0 updated`. The import region contains `Working set saved in this browser.` Run `select --label "Review week" --value 2026-W45`. The forecast region contains `Nov 2026 · 5 of 21 working days through 11-08. HK public holidays excluded.`, `HK$24,000 is below the straight-line HK$761,905.`, `HK$100,800`, and `0.8% of target`.
- **Reload.** Run `open`. Review week value is still `2026-W45`. Hero text is `2026-W45 · 11-02 → 11-08`. The import note is still `Merged sample-kingdee-import.csv (2026-11-02 → 2026-11-12): 5 added, 0 updated. 10,118 rows now.` Footer contains `sample-kingdee-import.csv` and does not contain `bundled seed`. The Nov row contains `HK$30,000`. The forecast still contains `HK$100,800`. Run `expect-sha256 --file public/data/sales-line-items.json --name seed-before`. Run `screenshot --name 02-reload-forecast --scope "Targets and forecast"`, `aria --name 02-reload-forecast --scope "Targets and forecast"`, and `screenshot --name 03-reload-import --scope "Import raw data"`.
- **Reset, then reload.** Run `click --role button --name "Reset to seed"`. The import region shows `Restored the bundled seed data.` and does not show `Working set saved in this browser.` Review week value is `2026-W42`. Footer contains `bundled seed`. Monthly sales has no `Nov 2026`. Run `open` again. The restore note is gone. Week value is `2026-W42`. Footer contains `bundled seed`. The forecast contains `HK$1,318,985`. Monthly sales has no `Nov 2026`.
- **Replace survives reload.** Run `check --role radio --name "Replace all"`, then `click --role button --name "Load sample export"`. The note starts with `Replaced dashboard data with 5 rows from sample-kingdee-import.csv`. Run `open`. Review week value is `2026-W46`. Hero text is `2026-W46 · 11-09 → 11-15`. Monthly sales has `Nov 2026` / `HK$30,000` and no `Oct 2026`. The forecast contains `HK$63,000` and `HK$30,000 is below the straight-line HK$1,523,810.` The import region contains the replace note and `Working set saved in this browser.` Run `expect-sha256`. Run `screenshot --name 04-replace-reload --scope "Targets and forecast"`.
- **Leave the seed.** Run `click --role button --name "Reset to seed"`. Footer contains `bundled seed`. Monthly sales has no `Nov 2026`.

## Gotchas

- Pace uses Hong Kong working days. October 2026 drops 1 Oct (National Day) and 19 Oct (the day following Chung Yeung). Through `10-18` that is 11 of 20 working days, not 12 of 22 weekdays.
- The forecast follows the review week’s month. A merge that adds November does not change the October forecast until the week moves into November.
- `HK$24,000` on `2026-W45` is month-to-date through 8 Nov (three sample rows). The month table’s `HK$30,000` is the full November file, including 9 Nov and 12 Nov.
- `open` restores IndexedDB and the saved review week. It is the refresh proof. It is not a reset.
- Reset loads the seed file, then deletes the save. The restore note is on-screen memory. The next `open` shows the seed without that note.
- The sample button uses the Apply as radio on the current page. `open` mounts that control on Merge into current again, so Replace all must be chosen after the reload that returned to the seed.
- `public/data/sales-line-items.json` is not rewritten. Prove that with `expect-sha256`.
- Pass `HK$` amounts in single quotes.
