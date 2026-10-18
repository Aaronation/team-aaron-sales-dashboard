---
name: verify-sales-dashboard
description: Drive the Team Aaron weekly manager review in a browser and prove the Vite React sales dashboard. Use when changing review week, MoM, reps, customers, SKUs, monthly sales, the sell-out pie, or hand import, and a unit test is not the user path.
---

# Verify the sales dashboard

The primary surface is one web page, Team Aaron weekly manager review (Momax HK, Galaxy/KA). There is no backend, no router, and no Kingdee auto-sync. Money is HKD. Seed lines load from `public/data/sales-line-items.json`. The sample import file is `public/data/sample-kingdee-import.csv`.

`npm test` (vitest) and `npm run lint` (oxlint) do not open this page. Drive it with the helper below.

Read `features/README.md` before a feature. Run that feature's drive from a fresh `open`. A proof that only hits one entry point does not cover the others.

## Launch

From the repo root, install once per checkout:

```bash
npm ci
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --prefix .cursor/skills/verify-sales-dashboard/helpers
```

The helper uses system Google Chrome (`channel: "chrome"`) when `VERIFY_BROWSER` is unset. If that launch fails:

```bash
npm exec --prefix .cursor/skills/verify-sales-dashboard/helpers -- playwright install chromium
```

and set `VERIFY_BROWSER=chromium` for every later command.

Start the app for verification (not `npm run dev`, which takes port 5173, and not `vite preview`, which takes 4173):

```bash
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs launch
```

That runs `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort` in the repo root, then runs doctor. Ready means the process is alive, `GET /` contains `<title>Team Aaron · Weekly manager review</title>`, the served seed bytes match `public/data/sales-line-items.json`, and a throwaway browser shows the heading `Weekly manager review` plus the regions `Import raw data`, `Weekly scorecard`, and `Monthly sales`. `Loading weekly review…` is not ready. Launch exits non-zero and stops its own pid if that bar is not met.

Stdout includes `ready=yes`, `run_id=`, `base_url=` (`http://127.0.0.1:4174` unless `VERIFY_PORT` is set), and `evidence_dir=`.

The page reaches that state from the bundled seed. No migration and no login. Imports stay in the browser tab's memory. Refresh, or `open`, loads the seed again.

Override port and id together when 4174 is taken. Launch refuses to kill a listener it did not start.

```bash
VERIFY_PORT=4180 VERIFY_RUN_ID=run-b node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs launch
```

Keep that `VERIFY_RUN_ID` on every later command. Two Vite processes in one checkout share `node_modules/.vite`. Prefer one verification server at a time. Two Playwright contexts on one server do not share React state.

Teardown is `cleanup` in the Cleanup section. Launch's failure path already calls it.

## Doctor

Run this before driving, and again whenever the page looks stale:

```bash
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs doctor
```

It is read-only. It checks the recorded server pid is alive, `lsof` shows that pid (or a descendant) listening on the launched port, the HTML title is `Team Aaron · Weekly manager review`, the seed response hashes equal to the checkout file, the heading is `Weekly manager review`, `navigator.language` is `en-HK`, and the viewport is `1440x900`. It writes `doctor.txt` under the run's evidence dir. It does not click, import, or reuse the drive browser.

Do not drive a base URL that doctor did not just accept. A `VERIFY_BASE_URL` that differs from the launched `base_url` is refused.

## Drive

The harness is `verify.mjs`. One drive daemon holds one Chromium context (locale `en-HK`, viewport 1440×900, light color scheme, temporary profile — not the user's Chrome profile). Commands after `open` share that page. A second `open` navigates to `/` again and drops in-memory filters and imports.

```bash
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs open
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs click --role button --name "Load sample export"
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs select --label "Review week" --value 2026-W42
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs fill --label Search --value "GAL26-10-12-001"
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs check --role radio --name "Replace all"
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs set-files --label "Upload CSV, Excel, or JSON" --file public/data/sample-kingdee-import.csv
```

`--label` matches the control's accessible name (combobox `Review week`, searchbox `Search`, upload button `Upload CSV, Excel, or JSON`). The wrapping `<label>` also contains every `<option>`, so the helper does not match that full string.

Stable handles:

| User control | Command |
| --- | --- |
| Heading | role `heading`, name `Weekly manager review` |
| Import | region `Import raw data` |
| Upload | label `Upload CSV, Excel, or JSON` (file input; do not click it) |
| Apply as | radio `Merge into current` (default) or `Replace all` |
| Sample | button `Load sample export` (label becomes `Working…` while busy) |
| Reset | button `Reset to seed` |
| Review week | label `Review week`. Option **value** is `2026-W42`. Visible label is `2026-W42 · 10-12 → 10-18` |
| Salesperson | label `Salesperson`. Option **value** is the full name (`Aaron Chang`). Visible label is the first token (`Aaron`) |
| Department | label `Department`. Values `all` (visible `All`), `Galaxy`, `Galaxy - KA`, `KA` |
| Search | label `Search`, placeholder `Invoice, customer, SKU…` |
| Scorecard | region `Weekly scorecard` |
| Monthly block | region `Monthly sales` |
| Month table | the table in that region whose columnheader is `Month` |
| Sell-out list | `css:.share-list` |
| Week readout | `css:.hero__week` |
| MoM readout | `css:.hero__aside-meta` |
| Rep board | region `Rep month-over-month` |
| Line detail | heading `Week line detail`; sort buttons `Date`, `Customer`, `Salesperson`, `Qty`, `Revenue`; pager `Previous`, `Next` |
| Footer | `role:contentinfo` |

Scope strings for `--scope`:

- `Monthly sales` — region accessible name (also `Import raw data`, `Weekly scorecard`, `Rep month-over-month`)
- `css:.hero__week` — CSS selector, prefix `css:`
- `figure:Sell-out share · Nov 2026` — figure accessible name from its figcaption
- `role:contentinfo` — role, or `role:button|Next` when a name is required

Assertions and evidence:

```bash
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs expect-exact --scope css:.hero__week --text "2026-W42 · 10-12 → 10-18"
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs expect-value --label "Review week" --value 2026-W42
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs expect-text --text 'HK$30,000' --scope "Monthly sales" --exact
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs expect-row --scope "Monthly sales" --row "Nov 2026" --text 'HK$30,000'
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs expect-count --scope css:.share-list --text "10.0%" --exact --count 2
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs expect-absent --text "Nov 2026" --scope "Monthly sales"
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs screenshot --name 04-november-share --scope css:.share-list
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs aria --name 04-november-share --scope css:.share-list
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs sha256 --file public/data/sales-line-items.json --name seed-before
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs expect-sha256 --file public/data/sales-line-items.json --name seed-before
```

Week labels and the MoM line use `·` (U+00B7) and `→` (U+2192). The working-day hint uses `–` (U+2013): `Mon–Fri through 10-18`. The search placeholder ellipsis is `…` (U+2026).

Pass HKD strings in single quotes. Bash expands `"HK$30,000"` (`$3` or `$30`) before the helper sees it.

`expect-text` / `expect-count` / `expect-absent` only match visible text. A closed `<select>` still exposes every option in its text, so do not prove the selected week with a page-level `getByText`. Use `expect-value` plus `expect-exact` on `css:.hero__week`.

The bundled hand-import journey is:

```bash
bash .cursor/skills/verify-sales-dashboard/features/hand-import.drive.sh
```

## Evidence

Write proof under `artifacts/verify-sales-dashboard/<run-id>/` (absolute path is `evidence_dir` from launch). That directory is gitignored. Cleanup does not remove it.

Each drive command appends `journal.jsonl`. `sha256` writes `hashes.json`. `doctor` writes `doctor.txt`. `screenshot` writes `<name>.png`. `aria` writes `<name>.aria.txt`. On a failed drive command the daemon also writes `failure.png`, `failure.aria.txt`, and `failure.txt`.

Proof standard:

- Exercise the controls a manager uses. Do not call `setFilters`, `setPayload`, or vitest.
- Record the action and the resulting state. For hand import that is the before screenshot, the import note, the November row, and the sell-out list after the week change.
- Check side effects. A merge must leave `public/data/sales-line-items.json` byte-for-byte unchanged (`expect-sha256`). The footer text changes from `bundled seed` to `sample-kingdee-import.csv`. Nothing is posted to a network API.
- The sample CSV and the seed JSON are the app's real static files, fetched by the page. Do not stub them.
- There is no dry-run switch. `Load sample export` mutates the open tab. It does not write the repo.
- Do not invent a Kingdee sync client. There is no sync control to drive.

Capture UI proof as an ARIA snapshot plus a screenshot that shows `Weekly manager review` or the region just changed. Assert HKD text (`HK$30,000`), not chart pixel colors.

## Cleanup

Stop only the recorded pids. This sends `SIGTERM`, then `SIGKILL` if needed, to the process group of the drive daemon (`verify.mjs daemon`) and the Vite pid (`vite/bin/vite.js`). It refuses to signal a pid whose `/proc/<pid>/cmdline` does not match. It deletes `/tmp/verify-sales-dashboard/<run-id>/` and the `latest-run-id` pointer when that pointer is this run. It does not delete `artifacts/verify-sales-dashboard/`.

```bash
node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs cleanup
```

Stdout includes `evidence_preserved=yes` and `evidence_files=`. If there is no run, it prints `nothing_to_stop=yes` and exits 0.

Do not `pkill` node, vite, or chrome.

After a failed drive, run cleanup before starting another launch on the same port.

## Helpers

Both scripts are executable. Invoke them from the repo root.

| Script | Role |
| --- | --- |
| `node .cursor/skills/verify-sales-dashboard/helpers/verify.mjs <command>` | Launch, doctor, drive, evidence, cleanup |
| `bash .cursor/skills/verify-sales-dashboard/features/hand-import.drive.sh` | The hand-import journey against an already launched server |
| `bash .cursor/skills/verify-sales-dashboard/helpers/prove-hand-import.sh` | Launch, doctor, that journey, cleanup, then fail if the evidence files are missing or the server pid is still alive |

`verify.mjs` with no args prints the command list. Playwright resolves from `.cursor/skills/verify-sales-dashboard/helpers/node_modules`.

End-to-end proof of this skill:

```bash
bash .cursor/skills/verify-sales-dashboard/helpers/prove-hand-import.sh
```

Other journeys are in `features/`. Run `open` at the start of each so a previous import is not still in the page.
