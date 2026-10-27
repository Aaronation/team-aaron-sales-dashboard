#!/usr/bin/env bash
# Drive persist + forecast once. Requires `verify.mjs launch` to have passed doctor.
# Does not start or stop the server. On a fresh profile, `open` loads the bundled seed.
# HKD amounts are single-quoted so bash does not expand $ inside HK$725,442.
set -euo pipefail
export LANG="${LANG:-C.UTF-8}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
V=(node "$ROOT/.cursor/skills/verify-sales-dashboard/helpers/verify.mjs")

"${V[@]}" open
"${V[@]}" sha256 --file public/data/sales-line-items.json --name seed-before
"${V[@]}" expect-value --label "Review week" --value 2026-W42
"${V[@]}" expect-text --text "Oct 2026 · 11 of 20 working days through 10-18. HK public holidays excluded." --scope "Targets and forecast"
"${V[@]}" expect-text --text "Team target" --scope "Targets and forecast"
"${V[@]}" expect-text --text 'HK$3,300,000' --scope "Targets and forecast"
"${V[@]}" expect-text --text 'HK$725,442' --scope "Targets and forecast"
"${V[@]}" expect-text --text "22.0% of target" --scope "Targets and forecast"
"${V[@]}" expect-text --text "Behind" --exact --scope "Targets and forecast"
"${V[@]}" expect-text --text 'HK$725,442 is below the straight-line HK$1,815,000.' --scope "Targets and forecast"
"${V[@]}" expect-text --text 'HK$1,318,985' --scope "Targets and forecast"
"${V[@]}" expect-absent --text "On track" --scope "Targets and forecast"
"${V[@]}" expect-text --text 'HK$166,800' --scope "Weekly scorecard"
"${V[@]}" expect-text --text "Mon–Fri through 10-18" --scope "Weekly scorecard"
"${V[@]}" expect-absent --text "Working set saved in this browser." --scope "Import raw data"
"${V[@]}" expect-text --text "bundled seed" --scope role:contentinfo
"${V[@]}" screenshot --name 01-seed-forecast --scope "Targets and forecast"
"${V[@]}" aria --name 01-seed-forecast --scope "Targets and forecast"

"${V[@]}" click --role button --name "Load sample export"
"${V[@]}" expect-text --text "5 added, 0 updated" --scope "Import raw data"
"${V[@]}" expect-text --text "Working set saved in this browser." --scope "Import raw data"
"${V[@]}" select --label "Review week" --value 2026-W45
"${V[@]}" expect-value --label "Review week" --value 2026-W45
"${V[@]}" expect-text --text "Nov 2026 · 5 of 21 working days through 11-08. HK public holidays excluded." --scope "Targets and forecast"
"${V[@]}" expect-text --text 'HK$24,000 is below the straight-line HK$761,905.' --scope "Targets and forecast"
"${V[@]}" expect-text --text 'HK$100,800' --scope "Targets and forecast"
"${V[@]}" expect-text --text "0.8% of target" --scope "Targets and forecast"

"${V[@]}" open
"${V[@]}" expect-value --label "Review week" --value 2026-W45
"${V[@]}" expect-exact --scope css:.hero__week --text "2026-W45 · 11-02 → 11-08"
"${V[@]}" expect-text --text "Merged sample-kingdee-import.csv (2026-11-02 → 2026-11-12): 5 added, 0 updated. 10,118 rows now." --scope "Import raw data"
"${V[@]}" expect-text --text "Working set saved in this browser." --scope "Import raw data"
"${V[@]}" expect-text --text "sample-kingdee-import.csv" --scope role:contentinfo
"${V[@]}" expect-absent --text "bundled seed" --scope role:contentinfo
"${V[@]}" expect-row --scope "Monthly sales" --row "Nov 2026" --text 'HK$30,000'
"${V[@]}" expect-text --text 'HK$100,800' --scope "Targets and forecast"
"${V[@]}" expect-text --text "Behind" --exact --scope "Targets and forecast"
"${V[@]}" expect-sha256 --file public/data/sales-line-items.json --name seed-before
"${V[@]}" screenshot --name 02-reload-forecast --scope "Targets and forecast"
"${V[@]}" aria --name 02-reload-forecast --scope "Targets and forecast"
"${V[@]}" screenshot --name 03-reload-import --scope "Import raw data"

"${V[@]}" click --role button --name "Reset to seed"
"${V[@]}" expect-text --text "Restored the bundled seed data." --scope "Import raw data"
"${V[@]}" expect-absent --text "Working set saved in this browser." --scope "Import raw data"
"${V[@]}" expect-value --label "Review week" --value 2026-W42
"${V[@]}" expect-text --text "bundled seed" --scope role:contentinfo
"${V[@]}" expect-absent --text "Nov 2026" --scope "Monthly sales"

"${V[@]}" open
"${V[@]}" expect-absent --text "Restored the bundled seed data."
"${V[@]}" expect-value --label "Review week" --value 2026-W42
"${V[@]}" expect-text --text "bundled seed" --scope role:contentinfo
"${V[@]}" expect-absent --text "Nov 2026" --scope "Monthly sales"
"${V[@]}" expect-absent --text "Working set saved in this browser." --scope "Import raw data"
"${V[@]}" expect-text --text 'HK$1,318,985' --scope "Targets and forecast"
"${V[@]}" expect-text --text "Behind" --exact --scope "Targets and forecast"

"${V[@]}" check --role radio --name "Replace all"
"${V[@]}" click --role button --name "Load sample export"
"${V[@]}" expect-text --text "Replaced dashboard data with 5 rows from sample-kingdee-import.csv (2026-11-02 → 2026-11-12)." --scope "Import raw data"
"${V[@]}" expect-value --label "Review week" --value 2026-W46
"${V[@]}" open
"${V[@]}" expect-value --label "Review week" --value 2026-W46
"${V[@]}" expect-exact --scope css:.hero__week --text "2026-W46 · 11-09 → 11-15"
"${V[@]}" expect-text --text "Replaced dashboard data with 5 rows from sample-kingdee-import.csv (2026-11-02 → 2026-11-12)." --scope "Import raw data"
"${V[@]}" expect-text --text "Working set saved in this browser." --scope "Import raw data"
"${V[@]}" expect-row --scope "Monthly sales" --row "Nov 2026" --text 'HK$30,000'
"${V[@]}" expect-absent --text "Oct 2026" --scope "Monthly sales"
"${V[@]}" expect-text --text 'HK$63,000' --scope "Targets and forecast"
"${V[@]}" expect-text --text 'HK$30,000 is below the straight-line HK$1,523,810.' --scope "Targets and forecast"
"${V[@]}" expect-sha256 --file public/data/sales-line-items.json --name seed-before
"${V[@]}" screenshot --name 04-replace-reload --scope "Targets and forecast"

"${V[@]}" click --role button --name "Reset to seed"
"${V[@]}" expect-text --text "Restored the bundled seed data." --scope "Import raw data"
"${V[@]}" expect-text --text "bundled seed" --scope role:contentinfo
"${V[@]}" expect-absent --text "Nov 2026" --scope "Monthly sales"
"${V[@]}" expect-value --label "Review week" --value 2026-W42
