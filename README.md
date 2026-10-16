# Team Aaron — Weekly manager review

Web app for **sales managers** to review Team Aaron (Galaxy/KA) performance on a **weekly** cadence: pick a review week, compare it to the **same calendar dates last month** (MoM), scan reps / customers / SKUs, then open line detail. All money amounts are **HKD**.

Seed data is parsed from the Team Aaron Excel reference workbooks (Oct + Aug enhanced).

Phase 2 adds three things on top of that weekly review:

- **Monthly sales** — each calendar month’s total sell-out (bar chart and summary table). The review week does not clip the month. The highlighted row is the month of the selected week.
- **Sell-out pie** — each salesperson’s share of that month’s sell-out, as a percentage. Sell-out is the line `totalAmount` (there is no separate sell-out column in the seed). The rep filter does not hide other slices.
- **Hand import** — upload a CSV or Excel export (or the dashboard JSON) to update the in-memory data. KingdeeAI auto-sync is out of scope. `ingestRecords()` in `src/lib/ingest.ts` is the shared mapper a future sync should call.

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

## Try the import

1. `npm run dev` and open the app.
2. Use **Load sample export** (merge). That fetches `public/data/sample-kingdee-import.csv`, a small Kingdee-style file with Chinese headers.
3. November 2026 appears on the monthly chart at **HK$30,000**. The weekly review stays on the current week until you change it.
4. Pick a November review week (2026-W45 or 2026-W46). The sell-out pie for Nov 2026 is Aaron Chang 50%, Kelvin Lai 30%, Kenny Ma 10%, Riley Cho 10%.
5. **Replace all** with the same file leaves only those five rows. **Reset to seed** restores the bundled JSON.

You can also upload your own `.csv`, `.xlsx`, or dashboard `.json`. Legacy `.xls` is not accepted — export `.xlsx` or CSV from Kingdee. The import lasts for the browser session only.

Ambiguous numeric dates (`06/11/2026`) are read as day/month/year.

### Expected columns

| Dashboard field | Required | Accepted headers |
| --- | --- | --- |
| Date | yes | Date, 日期, 单据日期, 业务日期, 开票日期 |
| Amount | yes, or quantity × unit price | Total Amount, Amount, 金额, 价税合计, 销售金额 |
| Salesperson | needed for the pie | Salesperson, 销售员, 业务员 |
| Quantity | no | Quantity, 数量, 实发数量 |
| Unit price | no | Unit Price, 单价, 含税单价 |
| Invoice | no | Invoice, 单据编号, 发票号 |
| Customer | no | Customer Name, 客户, 客户名称. If those are empty, 往来单位 / 交易对象 is copied in (trading partner is still kept). |
| Department | no | Sales Department, 部门, 销售部门 |
| SKU | no | SKU, 物料编码, 商品编码 |
| Product model | no | 产品型号, 规格型号, Product Model |
| Product name | no | Product Name, 物料名称, 商品名称 |

A title block above the header row is skipped. Rows labeled 合计 / Total are skipped. **Merge** adds new lines and replaces a line when invoice, SKU, date, quantity, amount, and customer all match. **Replace** swaps the working set and keeps the team targets from the seed.

CSV may be UTF-8 or GB18030. Excel workbooks use the sheet named `Data` when several sheets match.

## Stack

Vite + React + TypeScript + Recharts. Excel files are read in the browser with `read-excel-file`. No backend.
