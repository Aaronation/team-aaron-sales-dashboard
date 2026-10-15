# Team Aaron — Weekly manager review

Web app for **sales managers** to review Team Aaron (Galaxy/KA) performance on a **weekly** cadence: pick a review week, compare it to the **same calendar dates last month** (MoM), scan reps / customers / SKUs, then open line detail. All money amounts are **HKD**.

Seed data is parsed from the Team Aaron Excel reference workbooks (Oct + Aug enhanced).

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build
npm run preview  # serve dist/
```

## Data

- Runtime file: `public/data/sales-line-items.json` (~10k line items, Aug–Oct 2026).
- Re-extract from xlsx (requires `openpyxl`):

```bash
python3 scripts/extract-xlsx.py \
  /path/to/Team-Aaron-Sales-Dashboard-wGAL-202610.xlsx \
  /path/to/Team-Aaron-Sales-Dashboard-wGAL-202608-enhanced.xlsx \
  --out public/data/sales-line-items.json
```

## Stack

Vite + React + TypeScript + Recharts. No backend.
