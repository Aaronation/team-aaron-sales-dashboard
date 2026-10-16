import { useMemo, useState } from 'react'
import type { LineItem } from '../lib/types'
import { displayCustomer, formatMoney, shortName } from '../lib/aggregates'

type Props = { rows: LineItem[] }

type InvoiceRow = {
  invoice: string
  date: string | null
  customer: string | null
  salesperson: string | null
  quantity: number
  totalAmount: number
}

type SortKey = 'date' | 'totalAmount' | 'quantity' | 'customer' | 'salesperson'

const PAGE = 40

function joined(values: Set<string>): string | null {
  const list = [...values]
  if (list.length === 0) return null
  if (list.length === 1) return list[0]
  return list.sort((a, b) => a.localeCompare(b)).join(', ')
}

/** One row per invoice. Revenue and quantity are the sums of that invoice’s lines. */
function invoicesFromLines(rows: LineItem[]): InvoiceRow[] {
  const map = new Map<
    string,
    InvoiceRow & { dates: Set<string>; customers: Set<string>; reps: Set<string> }
  >()
  for (const row of rows) {
    const invoice = row.invoice || '(no invoice)'
    let cur = map.get(invoice)
    if (!cur) {
      cur = {
        invoice,
        date: row.date,
        customer: row.customer,
        salesperson: row.salesperson,
        quantity: 0,
        totalAmount: 0,
        dates: new Set(),
        customers: new Set(),
        reps: new Set(),
      }
      map.set(invoice, cur)
    }
    cur.quantity += row.quantity || 0
    cur.totalAmount += row.totalAmount || 0
    if (row.date) cur.dates.add(row.date)
    if (row.customer) cur.customers.add(row.customer)
    if (row.salesperson) cur.reps.add(row.salesperson)
  }
  return [...map.values()].map((cur) => ({
    invoice: cur.invoice,
    date: [...cur.dates].sort()[0] ?? cur.date,
    customer: joined(cur.customers),
    salesperson: joined(cur.reps),
    quantity: cur.quantity,
    totalAmount: cur.totalAmount,
  }))
}

export function LineTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [asc, setAsc] = useState(false)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    const copy = invoicesFromLines(rows)
    copy.sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') {
        return asc ? av - bv : bv - av
      }
      return asc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return copy
  }, [rows, sortKey, asc])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const slice = sorted.slice(safePage * PAGE, safePage * PAGE + PAGE)

  function toggle(key: SortKey) {
    if (sortKey === key) setAsc(!asc)
    else {
      setSortKey(key)
      setAsc(key === 'customer' || key === 'salesperson')
    }
    setPage(0)
  }

  return (
    <section className="table-wrap">
      <header className="table-wrap__head">
        <h2>Week line detail</h2>
        <p>
          Page {safePage + 1} / {pageCount} · {sorted.length.toLocaleString()} invoices
        </p>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => toggle('date')}>
                  Date
                </button>
              </th>
              <th>Invoice</th>
              <th>
                <button type="button" onClick={() => toggle('customer')}>
                  Customer
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('salesperson')}>
                  Salesperson
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('quantity')}>
                  Qty
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('totalAmount')}>
                  Revenue
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.invoice}>
                <td>{r.date}</td>
                <td className="mono">{r.invoice}</td>
                <td title={r.customer ?? undefined}>{r.customer ? displayCustomer(r.customer) : ''}</td>
                <td>{r.salesperson ? shortName(r.salesperson) : ''}</td>
                <td>{Math.round(r.quantity).toLocaleString()}</td>
                <td className="mono">{formatMoney(r.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button type="button" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>
          Previous
        </button>
        <button
          type="button"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage(safePage + 1)}
        >
          Next
        </button>
      </div>
    </section>
  )
}
