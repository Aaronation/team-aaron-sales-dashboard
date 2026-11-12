#!/usr/bin/env bash
# Seed smoke for monthly days, customer MoM bars, and model stacks.
# Requires verify.mjs launch. Does not start or stop the server.
# On a fresh profile, open loads the bundled seed.
set -euo pipefail
export LANG="${LANG:-C.UTF-8}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
V=(node "$ROOT/.cursor/skills/verify-sales-dashboard/helpers/verify.mjs")

"${V[@]}" open
"${V[@]}" expect-value --label "Review week" --value 2026-W42
"${V[@]}" expect-value --label "Salesperson" --value all
"${V[@]}" expect-row --scope "Monthly sales" --row "Oct 2026" --text 'HK$725,442'
"${V[@]}" expect-text --text "working-day index" --scope "Monthly sales"
"${V[@]}" expect-text --text "This month" --scope "figure:Days in review month · Oct 2026"
"${V[@]}" expect-text --text "Last month" --scope "figure:Days in review month · Oct 2026"
"${V[@]}" screenshot --name month-days --scope "figure:Days in review month · Oct 2026"

"${V[@]}" expect-text --text "through 10-18" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "11 working days" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "through 09-15" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "This period" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "Last month" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "Vision" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "W40" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "W41" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "W42" --scope "figure:Top customers · Oct 2026"
"${V[@]}" screenshot --name month-customers --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-absent --text "Follow up" --scope "Monthly sales"
"${V[@]}" expect-absent --text "Not yet" --scope "Monthly sales"

"${V[@]}" expect-text --text "through 10-18" --scope "figure:Top product models · Oct 2026"
"${V[@]}" expect-text --text "Aaron" --scope "figure:Top product models · Oct 2026"
"${V[@]}" expect-text --text "Kelvin" --scope "figure:Top product models · Oct 2026"
"${V[@]}" expect-text --text "Kenny" --scope "figure:Top product models · Oct 2026"
"${V[@]}" screenshot --name month-models --scope "figure:Top product models · Oct 2026"

"${V[@]}" select --label "Salesperson" --value "Kelvin Lai"
"${V[@]}" expect-value --label "Salesperson" --value "Kelvin Lai"
"${V[@]}" expect-text --text "Lancer" --scope "figure:Kelvin top customers · Oct 2026"
"${V[@]}" expect-text --text "Last month" --scope "figure:Kelvin top customers · Oct 2026"
"${V[@]}" expect-absent --text "Vision" --scope "figure:Kelvin top customers · Oct 2026"
"${V[@]}" screenshot --name month-customers-kelvin --scope "figure:Kelvin top customers · Oct 2026"
"${V[@]}" expect-text --text "China Telecom (Macau)" --scope "figure:Follow up · Oct 2026 · 18 accounts"
"${V[@]}" expect-text --text 'HK$53,000' --scope "figure:Follow up · Oct 2026 · 18 accounts"
"${V[@]}" expect-text --text "潮物士多 GADGET STORE" --scope "figure:Follow up · Oct 2026 · 18 accounts"
"${V[@]}" expect-text --text "Domain Computer Technology (華都)" --scope "figure:Follow up · Oct 2026 · 18 accounts"
"${V[@]}" expect-absent --text "Domain Computer Technol…" --scope "figure:Follow up · Oct 2026 · 18 accounts"
"${V[@]}" expect-text --text "Not yet" --scope "figure:Follow up · Oct 2026 · 18 accounts"
"${V[@]}" expect-absent --text "Same salesperson filter" --scope "figure:Follow up · Oct 2026 · 18 accounts"
"${V[@]}" expect-absent --text "In-Town" --scope "figure:Follow up · Oct 2026 · 18 accounts"
"${V[@]}" screenshot --name month-follow-up-kelvin --scope css:.monthly__follow
"${V[@]}" expect-text --text "Kelvin" --scope "figure:Kelvin top product models · Oct 2026"
"${V[@]}" expect-absent --text "Aaron" --scope "figure:Kelvin top product models · Oct 2026"
"${V[@]}" screenshot --name month-models-kelvin --scope "figure:Kelvin top product models · Oct 2026"

"${V[@]}" select --label "Salesperson" --value "Kenny Ma"
"${V[@]}" expect-text --text "Megatech" --scope "figure:Kenny top customers · Oct 2026"
"${V[@]}" expect-absent --text "Lancer" --scope "figure:Kenny top customers · Oct 2026"
"${V[@]}" screenshot --name month-customers-kenny --scope "figure:Kenny top customers · Oct 2026"

"${V[@]}" select --label "Salesperson" --value "Aaron Chang"
"${V[@]}" expect-text --text "Vision" --scope "figure:Aaron top customers · Oct 2026"
"${V[@]}" expect-absent --text "Lancer" --scope "figure:Aaron top customers · Oct 2026"
"${V[@]}" expect-absent --text "Megatech" --scope "figure:Aaron top customers · Oct 2026"
"${V[@]}" expect-absent --text "In-Town" --scope "figure:Aaron top customers · Oct 2026"
"${V[@]}" expect-text --text "YOHO 友和" --scope "figure:Aaron top customers · Oct 2026"
"${V[@]}" expect-absent --text "YOHO友和" --scope "figure:Aaron top customers · Oct 2026"
"${V[@]}" expect-count --text "YOHO 友和" --scope "figure:Aaron top customers · Oct 2026" --count 1
"${V[@]}" screenshot --name month-customers-aaron --scope "figure:Aaron top customers · Oct 2026"
"${V[@]}" expect-text --text "In-Town" --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" expect-text --text "訊購貿易公司 Xungou Trading" --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" expect-text --text 'HK$27,590' --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" expect-text --text 'HK$12,000' --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" expect-absent --text "YOHO" --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" expect-absent --text "Same salesperson filter" --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" expect-text --text "Not yet" --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" expect-absent --text "No accounts to chase in this window." --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" expect-absent --text "China Telecom (Macau)" --scope "figure:Follow up · Oct 2026 · 3 accounts"
"${V[@]}" screenshot --name month-follow-up-aaron --scope css:.monthly__follow
"${V[@]}" aria --name month-follow-up-aaron --scope css:.monthly__follow

"${V[@]}" select --label "Salesperson" --value all
"${V[@]}" expect-value --label "Salesperson" --value all
"${V[@]}" expect-absent --text "Follow up" --scope "Monthly sales"
"${V[@]}" expect-absent --text "Not yet" --scope "Monthly sales"
"${V[@]}" expect-text --text "Vision" --scope "figure:Top customers · Oct 2026"
"${V[@]}" screenshot --name month-customers-all-after-rep --scope "figure:Top customers · Oct 2026"
"${V[@]}" select --label "Review week" --value 2026-W41
"${V[@]}" expect-value --label "Review week" --value 2026-W41
"${V[@]}" expect-text --text "through 10-11" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "6 working days" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "through 09-08" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "W40" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "W41" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-absent --text "W42" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "through 10-11" --scope "figure:Top product models · Oct 2026"
"${V[@]}" expect-row --scope "Monthly sales" --row "Oct 2026" --text 'HK$725,442'
"${V[@]}" screenshot --name month-customers-w41 --scope "figure:Top customers · Oct 2026"
"${V[@]}" screenshot --name month-models-w41 --scope "figure:Top product models · Oct 2026"

"${V[@]}" select --label "Review week" --value 2026-W32
"${V[@]}" expect-value --label "Review week" --value 2026-W32
"${V[@]}" expect-text --text "No Jul 2026 lines are loaded" --scope "figure:Days in review month · Aug 2026"
"${V[@]}" expect-absent --text "Last month" --scope "figure:Days in review month · Aug 2026"
"${V[@]}" expect-text --text "through 08-09" --scope "figure:Top customers · Aug 2026"
"${V[@]}" expect-text --text "No Jul 2026 lines are loaded" --scope "figure:Top customers · Aug 2026"
"${V[@]}" expect-absent --text "Last month" --scope "figure:Top customers · Aug 2026"
"${V[@]}" expect-text --text "through 08-09" --scope "figure:Top product models · Aug 2026"
"${V[@]}" expect-row --scope "Monthly sales" --row "Oct 2026" --text 'HK$725,442'
"${V[@]}" screenshot --name month-days-august --scope "figure:Days in review month · Aug 2026"
"${V[@]}" screenshot --name month-customers-august --scope "figure:Top customers · Aug 2026"
"${V[@]}" select --label "Salesperson" --value "Aaron Chang"
"${V[@]}" expect-text --text "No accounts to chase in this window." --scope "figure:Follow up · Aug 2026 · 0 accounts"
"${V[@]}" expect-absent --text "Not yet" --scope "figure:Follow up · Aug 2026 · 0 accounts"
"${V[@]}" screenshot --name month-follow-up-empty --scope "figure:Follow up · Aug 2026 · 0 accounts"
"${V[@]}" select --label "Salesperson" --value all
