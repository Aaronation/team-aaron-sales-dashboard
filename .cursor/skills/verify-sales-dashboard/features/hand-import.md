# Hand import

Hand import loads a CSV, Excel, or dashboard JSON file into the working set and saves it in this browser. Merge adds rows to the current lines. Replace swaps the working set and keeps team targets. Reset clears the save and reloads the bundled seed. The sample button fetches `public/data/sample-kingdee-import.csv`.

## Sub-features

- `import-merge-sample` merges the sample export: 5 added, 0 updated, 10,118 distinct rows, dates `2026-11-02 → 2026-11-12`.
- `import-november-total` shows `Nov 2026` at `HK$30,000` in the month table. October totals stay.
- `import-week-unchanged` leaves the review week on `2026-W42` after a merge.
- `import-seed-untouched` does not modify `public/data/sales-line-items.json`.
- `import-november-share` after choosing `2026-W45`, lists Aaron 50.0% `HK$15,000`, Kelvin 30.0% `HK$9,000`, Kenny 10.0% `HK$3,000`, Riley 10.0% `HK$3,000`.
- `import-upload` sends the same file through the file input while Merge into current is selected.
- `import-replace` swaps to the five sample rows and moves the review week to `2026-W46`.
- `import-reset` restores the seed, the latest week `2026-W42`, and the footer text `bundled seed`.

## How to get to it (user POV)

- Use the Import raw data section at the top of the page.
- Leave Apply as on Merge into current, or choose Replace all.
- Choose Load sample export, or choose a `.csv`, `.xlsx`, `.xlsm`, or `.json` file. Legacy `.xls` is rejected.
- Choose Reset to seed to drop the saved import and reload the bundled file. A browser refresh keeps the save.

## Driving it with verify.mjs

Preconditions:

- Doctor has passed.
- `open` has loaded the seed. Footer contains `bundled seed`. November is not in Monthly sales.
- Apply as is Merge into current.

The commands below are the file `features/hand-import.drive.sh`. Run it with `bash .cursor/skills/verify-sales-dashboard/features/hand-import.drive.sh` after launch, or run the same commands one by one.

- **Baseline.** Run `open`, then `sha256 --file public/data/sales-line-items.json --name seed-before`. Hero week is `2026-W42 · 10-12 → 10-18`. Aside is `MoM vs prior month 09-12 → 09-18`. Review week value is `2026-W42`. Radio `Merge into current` is checked. Radio `Replace all` is not. Button `Load sample export` is enabled. Region `Monthly sales` has no `Nov 2026`. The page has no `sample-kingdee-import.csv`. Footer contains `bundled seed`. `css:.share-list` shows `HK$365,530`, `HK$224,887`, and `HK$135,025`. Run `screenshot --name 01-before-import --scope "Import raw data"`.
- **Merge the sample.** Run `click --role button --name "Load sample export"`. The import region shows `Merged sample-kingdee-import.csv (2026-11-02 → 2026-11-12): 5 added, 0 updated. 10,118 rows now.` The button is enabled again. Hero week is still `2026-W42 · 10-12 → 10-18`. The Month table has one row containing `Nov 2026` and `HK$30,000`. Footer contains `sample-kingdee-import.csv` and `ISO week 2026-W42`, and no longer contains `bundled seed`. The pie caption is still `Sell-out share · Oct 2026`. `css:.share-list` shows `50.4%`, `HK$365,530`, `31.0%`, `HK$224,720`, `18.6%`, `HK$134,887`, and does not show `Riley`. Run `screenshot --name 02-after-merge-import --scope "Import raw data"`, `screenshot --name 03-after-merge-monthly --scope "Monthly sales"`, and `aria --name 03-after-merge-monthly --scope "Monthly sales"`.
- **November share.** Run `select --label "Review week" --value 2026-W45`. The value is `2026-W45`. Hero text is `2026-W45 · 11-02 → 11-08`. Aside is `MoM vs prior month 10-02 → 10-08`. Caption is `Sell-out share · Nov 2026`. On `css:.share-list`, exact counts are Aaron 1, `50.0%` 1, `HK$15,000` 1, Kelvin 1, `30.0%` 1, `HK$9,000` 1, Kenny 1, Riley 1, `10.0%` 2, `HK$3,000` 2. The Nov row still contains `HK$30,000`. Footer contains `ISO week 2026-W45`. Run `screenshot --name 04-november-share --scope css:.share-list`, `aria --name 04-november-share --scope css:.share-list`, and `screenshot --name 05-full-page`.
- **Seed file.** Run `expect-sha256 --file public/data/sales-line-items.json --name seed-before`. The hash matches the pre-click hash.
- **Upload entry.** Run `Reset to seed` first so the sample is not already saved. `open` would restore it. Then run `set-files --label "Upload CSV, Excel, or JSON" --file public/data/sample-kingdee-import.csv`. The same merge note appears, including `5 added, 0 updated`. Do not click the file input.
- **Replace.** Run `Reset to seed`, then `check --role radio --name "Replace all"`, then `click --role button --name "Load sample export"`. The import note starts with `Replaced dashboard data with 5 rows from sample-kingdee-import.csv`. Review week value is `2026-W46`. Hero text is `2026-W46 · 11-09 → 11-15`. The month table's only month row is `Nov 2026` / `HK$30,000`.
- **Reset.** Run `click --role button --name "Reset to seed"`. The import region shows `Restored the bundled seed data.` Review week value is `2026-W42`. Footer contains `bundled seed`. Region `Monthly sales` has no `Nov 2026`.

## Gotchas

- The sample button uses whichever Apply as radio is selected. The default is Merge into current. Replace all is a different result: the seed weeks disappear and the combobox moves to `2026-W46`.
- `2026-W45` is not in the week list until the sample rows are loaded. Selecting it before the merge fails.
- Merge keeps `2026-W42`. The October pie stays October until the week changes. `HK$30,000` in the month table is the November proof while the hero still says `2026-W42`.
- Merge and Replace are saved in this browser. `open` navigates to `/` and restores that save, including the review week. `Reset to seed` clears it. A new drive daemon has an empty profile, so the first `open` is the bundled seed. Cleanup does not reset a browser this run is not driving.
- `public/data/sales-line-items.json` and the sample CSV are not rewritten. Prove that with `expect-sha256`, not by trusting the button name.
- While the request is in flight the sample button's name is `Working…`. Wait for the import note, not a fixed sleep.
- Counts in the note use the browser locale. This helper sets `en-HK`, so the row count is `10,118`. The unambiguous substring `5 added, 0 updated` does not depend on grouping.
- `rows now` is the distinct line-key count after merge, not the seed file length plus 5. The seed has 10,121 lines and some duplicate keys. Building the merge map collapses those keys, which is why October Kelvin moves from `HK$224,887` to `HK$224,720` and Kenny from `HK$135,025` to `HK$134,887` even though the note says `0 updated`. Assert those post-merge amounts. The seed file hash does not change.
- Ambiguous numeric dates in other files are day/month/year. The sample's `06/11/2026` is 6 November 2026, inside `2026-W45`.
- Do not click the file input. That opens a native dialog and stalls the driver. Use `set-files`.
- There is no sync button. Do not add one while verifying.
