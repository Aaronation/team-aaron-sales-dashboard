#!/usr/bin/env bash
# Drive hand-import once. Requires `verify.mjs launch` to have passed doctor.
# Does not start or stop the server. On a fresh profile, `open` loads the bundled seed.
# HKD amounts are single-quoted so bash does not expand $3 inside HK$30,000.
set -euo pipefail
export LANG="${LANG:-C.UTF-8}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
V=(node "$ROOT/.cursor/skills/verify-sales-dashboard/helpers/verify.mjs")

"${V[@]}" open
"${V[@]}" sha256 --file public/data/sales-line-items.json --name seed-before
"${V[@]}" expect-exact --scope css:.hero__week --text "2026-W42 · 10-12 → 10-18"
"${V[@]}" expect-exact --scope css:.hero__aside-meta --text "MoM vs prior month 09-12 → 09-18"
"${V[@]}" expect-value --label "Review week" --value 2026-W42
"${V[@]}" expect-checked --role radio --name "Merge into current"
"${V[@]}" expect-unchecked --role radio --name "Replace all"
"${V[@]}" expect-enabled --role button --name "Load sample export"
"${V[@]}" expect-absent --text "Nov 2026" --scope "Monthly sales"
"${V[@]}" expect-absent --text "sample-kingdee-import.csv"
"${V[@]}" expect-text --text "bundled seed" --scope role:contentinfo
"${V[@]}" expect-count --scope css:.share-list --text 'HK$365,530' --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text 'HK$224,887' --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text 'HK$135,025' --exact --count 1
"${V[@]}" screenshot --name 01-before-import --scope "Import raw data"

"${V[@]}" click --role button --name "Load sample export"
"${V[@]}" expect-text --text "Merged sample-kingdee-import.csv (2026-11-02 → 2026-11-12): 5 added, 0 updated. 10,118 rows now." --scope "Import raw data"
"${V[@]}" expect-enabled --role button --name "Load sample export"
"${V[@]}" expect-exact --scope css:.hero__week --text "2026-W42 · 10-12 → 10-18"
"${V[@]}" expect-value --label "Review week" --value 2026-W42
"${V[@]}" expect-row --scope "Monthly sales" --row "Nov 2026" --text 'HK$30,000'
"${V[@]}" expect-text --text "sample-kingdee-import.csv" --scope role:contentinfo
"${V[@]}" expect-text --text "ISO week 2026-W42" --scope role:contentinfo
"${V[@]}" expect-absent --text "bundled seed" --scope role:contentinfo
"${V[@]}" expect-text --text "Sell-out share · Oct 2026" --scope "Monthly sales"
"${V[@]}" expect-count --scope css:.share-list --text "50.4%" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text 'HK$365,530' --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text "31.0%" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text 'HK$224,720' --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text "18.6%" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text 'HK$134,887' --exact --count 1
"${V[@]}" expect-absent --text "Riley" --scope css:.share-list
"${V[@]}" screenshot --name 02-after-merge-import --scope "Import raw data"
"${V[@]}" screenshot --name 03-after-merge-monthly --scope "Monthly sales"
"${V[@]}" aria --name 03-after-merge-monthly --scope "Monthly sales"

"${V[@]}" select --label "Review week" --value 2026-W45
"${V[@]}" expect-value --label "Review week" --value 2026-W45
"${V[@]}" expect-exact --scope css:.hero__week --text "2026-W45 · 11-02 → 11-08"
"${V[@]}" expect-exact --scope css:.hero__aside-meta --text "MoM vs prior month 10-02 → 10-08"
"${V[@]}" expect-text --text "Sell-out share · Nov 2026" --scope "Monthly sales"
"${V[@]}" expect-count --scope css:.share-list --text "Aaron" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text "50.0%" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text 'HK$15,000' --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text "Kelvin" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text "30.0%" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text 'HK$9,000' --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text "Kenny" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text "Riley" --exact --count 1
"${V[@]}" expect-count --scope css:.share-list --text "10.0%" --exact --count 2
"${V[@]}" expect-count --scope css:.share-list --text 'HK$3,000' --exact --count 2
"${V[@]}" expect-row --scope "Monthly sales" --row "Nov 2026" --text 'HK$30,000'
"${V[@]}" expect-text --text "ISO week 2026-W45" --scope role:contentinfo
"${V[@]}" screenshot --name 04-november-share --scope css:.share-list
"${V[@]}" aria --name 04-november-share --scope css:.share-list
"${V[@]}" screenshot --name 05-full-page
"${V[@]}" expect-sha256 --file public/data/sales-line-items.json --name seed-before
