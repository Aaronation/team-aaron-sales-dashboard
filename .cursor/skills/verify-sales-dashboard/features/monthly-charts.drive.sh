#!/usr/bin/env bash
# Seed smoke for the three monthly charts. Requires verify.mjs launch.
# Does not start or stop the server. On a fresh profile, open loads the bundled seed.
set -euo pipefail
export LANG="${LANG:-C.UTF-8}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
V=(node "$ROOT/.cursor/skills/verify-sales-dashboard/helpers/verify.mjs")

"${V[@]}" open
"${V[@]}" expect-value --label "Review week" --value 2026-W42
"${V[@]}" expect-row --scope "Monthly sales" --row "Oct 2026" --text 'HK$725,442'
"${V[@]}" expect-text --text "working-day index" --scope "figure:Days in review month · Oct 2026"
"${V[@]}" expect-text --text "This month" --scope "figure:Days in review month · Oct 2026"
"${V[@]}" expect-text --text "Last month" --scope "figure:Days in review month · Oct 2026"
"${V[@]}" screenshot --name month-days --scope "figure:Days in review month · Oct 2026"
"${V[@]}" aria --name month-days --scope "figure:Days in review month · Oct 2026"
"${V[@]}" expect-text --text "W40" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "W41" --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "W42" --scope "figure:Top customers · Oct 2026"
"${V[@]}" screenshot --name month-customers --scope "figure:Top customers · Oct 2026"
"${V[@]}" expect-text --text "Aaron" --scope "figure:Top product models · Oct 2026"
"${V[@]}" expect-text --text "Kelvin" --scope "figure:Top product models · Oct 2026"
"${V[@]}" expect-text --text "Kenny" --scope "figure:Top product models · Oct 2026"
"${V[@]}" screenshot --name month-models --scope "figure:Top product models · Oct 2026"
"${V[@]}" select --label "Review week" --value 2026-W32
"${V[@]}" expect-value --label "Review week" --value 2026-W32
"${V[@]}" expect-text --text "No Jul 2026 lines are loaded" --scope "figure:Days in review month · Aug 2026"
"${V[@]}" expect-absent --text "Last month" --scope "figure:Days in review month · Aug 2026"
"${V[@]}" expect-row --scope "Monthly sales" --row "Oct 2026" --text 'HK$725,442'
"${V[@]}" screenshot --name month-days-august --scope "figure:Days in review month · Aug 2026"
