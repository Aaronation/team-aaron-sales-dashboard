import type { NamedDelta } from '../lib/aggregates'
import { formatAsp, formatMoney, formatPct, shortName } from '../lib/aggregates'

type Props = { rows: NamedDelta[]; invoiceCounts: Map<string, number> }

export function RepBoard({ rows, invoiceCounts }: Props) {
  return (
    <section className="rep-board" aria-label="Rep month-over-month">
      <header>
        <h2>Rep board</h2>
        <p>This week vs same calendar dates last month — talking points for 1:1s</p>
      </header>
      <ul>
        {rows.map((r) => {
          const cls =
            r.deltaPct == null
              ? 'rep-board__delta'
              : r.deltaPct > 0
                ? 'rep-board__delta rep-board__delta--up'
                : r.deltaPct < 0
                  ? 'rep-board__delta rep-board__delta--down'
                  : 'rep-board__delta'
          return (
            <li key={r.name}>
              <div>
                <strong>{shortName(r.name)}</strong>
                <span className="muted">
                  {(invoiceCounts.get(r.name) ?? 0).toLocaleString()} invoices ·{' '}
                  {r.quantity.toLocaleString()} units · ASP {formatAsp(r.asp)}
                </span>
              </div>
              <div className="rep-board__nums">
                <span>{formatMoney(r.revenue)}</span>
                <span className={cls}>
                  {r.deltaPct == null ? 'new' : formatPct(r.deltaPct)} MoM
                </span>
                <span className="muted">prior period {formatMoney(r.prevRevenue)}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
