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
  invoices: number
  mtdRevenue: number
  monthTarget: number
  monthLabel: string
  monthRevenue: number
  reviewMonthLabel: string
  mtdWorkingDays: number
  monthWorkingDays: number
  workingDaysThrough: string
  holidaysLoaded: boolean
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
  invoices,
  mtdRevenue,
  monthTarget,
  monthLabel,
  monthRevenue,
  reviewMonthLabel,
  mtdWorkingDays,
  monthWorkingDays,
  workingDaysThrough,
  holidaysLoaded,
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
          {invoices.toLocaleString()} invoices · {quantity.toLocaleString()} units
        </p>
        <p className="kpis__label kpis__label--sub">Monthly revenue · {reviewMonthLabel}</p>
        <p className="kpis__month">{formatMoney(monthRevenue)}</p>
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
      <div>
        <p className="kpis__label">MTD working days · {reviewMonthLabel}</p>
        <p className="kpis__value">
          {mtdWorkingDays}
          <span className="kpis__sub"> of {monthWorkingDays}</span>
        </p>
        <p className="kpis__hint">Mon–Fri through {workingDaysThrough}</p>
        <p className="kpis__hint">
          {holidaysLoaded ? 'HK public holidays excluded' : 'Weekends excluded'}
        </p>
      </div>
    </section>
  )
}
