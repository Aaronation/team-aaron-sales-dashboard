import { formatMoney, formatPct } from '../lib/aggregates'

type Props = {
  weekLabel: string
  priorPeriodLabel: string | null
  revenue: number
  prevRevenue: number
  delta: number | null
  customers: number
  prevCustomers: number
  quantity: number
  lines: number
  mtdRevenue: number
  monthTarget: number
  monthLabel: string
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="delta delta--new">new</span>
  const cls = value > 0 ? 'delta delta--up' : value < 0 ? 'delta delta--down' : 'delta'
  return <span className={cls}>{formatPct(value)}</span>
}

export function KpiRow({
  weekLabel,
  priorPeriodLabel,
  revenue,
  prevRevenue,
  delta,
  customers,
  prevCustomers,
  quantity,
  lines,
  mtdRevenue,
  monthTarget,
  monthLabel,
}: Props) {
  const mtdPct = monthTarget > 0 ? mtdRevenue / monthTarget : 0
  const custDelta =
    prevCustomers > 0 ? (customers - prevCustomers) / prevCustomers : customers > 0 ? null : 0

  return (
    <section className="kpis" aria-label="Weekly scorecard">
      <div>
        <p className="kpis__label">This week (HKD) · {weekLabel}</p>
        <p className="kpis__value">{formatMoney(revenue)}</p>
        <p className="kpis__hint">
          vs same period last month ({priorPeriodLabel ?? '—'}) {formatMoney(prevRevenue)}{' '}
          <Delta value={delta} />
        </p>
      </div>
      <div>
        <p className="kpis__label">Month-over-month</p>
        <p className="kpis__value">
          <Delta value={delta} />
        </p>
        <p className="kpis__hint">
          {lines.toLocaleString()} lines · {quantity.toLocaleString()} units
        </p>
      </div>
      <div>
        <p className="kpis__label">Unique customers</p>
        <p className="kpis__value">{customers.toLocaleString()}</p>
        <p className="kpis__hint">
          same period last month {prevCustomers.toLocaleString()}{' '}
          <Delta value={custDelta} />
        </p>
      </div>
      <div>
        <p className="kpis__label">MTD context (HKD) · {monthLabel}</p>
        <p className="kpis__value">
          {formatMoney(mtdRevenue)}
          <span className="kpis__sub"> / {formatMoney(monthTarget)}</span>
        </p>
        <p className="kpis__hint">{(mtdPct * 100).toFixed(1)}% of monthly target</p>
      </div>
    </section>
  )
}
