# Sales dashboard verification map

This directory is the maintained source for verifying the user-facing behavior of the Team Aaron weekly manager review. Read this index, then use the matching feature file as the recipe.

The page is one URL. There is no login and no Kingdee sync control.

## Baseline preconditions

- Repo root dependencies are installed with `npm ci`.
- Helper dependencies are installed with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --prefix .cursor/skills/verify-sales-dashboard/helpers`.
- `node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs launch` has exited 0. Default base URL is `http://127.0.0.1:4174`.
- `node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs doctor` reports `seed_matches_checkout=yes`, `heading=Weekly manager review`, `locale=en-HK`, and `viewport=1440x900`.
- Drive commands use that same run. Set `VERIFY_RUN_ID` when it is not the latest launch.
- Start each feature from `open`, which loads the bundled seed. A later command in the same process sees in-memory imports until the next `open`.
- Never drive a Vite process this run did not start. Never `pkill` by process name.

## Driving conventions

- The harness is `verify.mjs`. Commands are literal. Keep quotes, week values, and `HK$` amounts unchanged.
- Prefer roles, labels, and the `css:` handles named in each feature. Do not click by coordinates.
- Select weeks and salespeople by option value, not by the shortened visible label.
- Assert visible HTML text (tables, share list, hero, footer). Recharts SVG is not the proof.
- The helper's browser locale is `en-HK`, so money renders as `HK$30,000`. The sample merge note says `10,118 rows now` (distinct line keys after merge, not 10,121+5).
- In shell commands, put `HK$` amounts in single quotes so bash does not expand `$`.
- Restore the seed with `open` or the `Reset to seed` button before a later feature. Do not delete proof files during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the last screen.
- UI proof is an ARIA snapshot plus a screenshot of the region that changed.
- Mutation proof includes a second view: the footer import name, the month table, and `expect-sha256` on `public/data/sales-line-items.json`.
- Record the feature id in the evidence file name.
- If an entry point cannot be reached, report the command and the missing precondition. Do not mark it verified through a different control.

## Feature entry contract

Each feature file starts with an H1 and one paragraph, then exactly these H2 sections, in order:

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with verify.mjs`
4. `Gotchas`

## Features

- [Review week](./review-week.md) — pick an ISO week and compare it with the same calendar dates last month.
- [Reps, customers, and SKUs](./rep-customer-sku.md) — filter the week, read the rep board, and page the invoice table.
- [Monthly sales](./monthly-sales.md) — month totals for the loaded lines. The review week does not clip them.
- [Sell-out pie](./sell-out-pie.md) — each rep's share of the review week's calendar month.
- [Hand import](./hand-import.md) — merge, replace, or reset from a CSV, Excel, or JSON file, including the sample export.
