import { useMemo, useState } from 'react'
import type { LineItem } from '../lib/types'
import { formatMoney } from '../lib/aggregates'

type Props = { rows: LineItem[] }

type SortKey = 'date' | 'totalAmount' | 'quantity' | 'customer' | 'salesperson'

const PAGE = 40

export function LineTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [asc, setAsc] = useState(false)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    const copy = [...rows]
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
          Page {safePage + 1} / {pageCount} · {rows.length.toLocaleString()} rows
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
              <th>SKU / Model</th>
              <th>
                <button type="button" onClick={() => toggle('quantity')}>
                  Qty
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('totalAmount')}>
                  Amount (HKD)
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={`${r.invoice}-${r.sku}-${r.date}-${i}`}>
                <td>{r.date}</td>
                <td className="mono">{r.invoice}</td>
                <td>{r.customer}</td>
                <td>{r.salesperson}</td>
                <td>
                  <span className="mono">{r.productModel || r.sku}</span>
                  {r.productName ? (
                    <span className="muted"> · {r.productName.slice(0, 40)}</span>
                  ) : null}
                </td>
                <td>{r.quantity}</td>
                <td>{formatMoney(r.totalAmount)}</td>
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
