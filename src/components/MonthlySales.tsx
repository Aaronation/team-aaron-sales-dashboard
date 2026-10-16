import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatMoney,
  MONTHLY_TEAM_TARGETS,
  type MonthTotal,
  type SellOutShare,
} from '../lib/aggregates'

const SLICE_COLORS = ['#2f5d4a', '#6b8f71', '#d4a017', '#c47a4a', '#5c6b5a', '#8a9a88', '#a67c52', '#3d5a4a']

type Props = {
  months: MonthTotal[]
  activeMonthKey: string | null
  shares: SellOutShare[]
  shareLabel: string
  scopeNote: string
  showTarget: boolean
}

export function MonthlySales({
  months,
  activeMonthKey,
  shares,
  shareLabel,
  scopeNote,
  showTarget,
}: Props) {
  const chartRows = months.map((month) => ({
    ...month,
    revenue: Math.round(month.revenue),
  }))
  const grand = months.reduce(
    (sum, month) => ({
      revenue: sum.revenue + month.revenue,
      quantity: sum.quantity + month.quantity,
      lines: sum.lines + month.lines,
    }),
    { revenue: 0, quantity: 0, lines: 0 },
  )
  const pieRows = shares.filter((share) => share.revenue > 0)

  return (
    <section className="monthly" aria-label="Monthly sales">
      <header>
        <h2>Monthly sales</h2>
        <p>{scopeNote}</p>
      </header>
      <div className="monthly__grid">
        <figure className="chart-panel">
          <figcaption>Total sales by month (HKD)</figcaption>
          {chartRows.length === 0 ? (
            <p className="monthly__empty">No sales in the current filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,36,32,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={48} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="revenue" name="Sales" radius={[4, 4, 0, 0]}>
                  {chartRows.map((month) => (
                    <Cell
                      key={month.monthKey}
                      fill={month.monthKey === activeMonthKey ? '#d4a017' : '#2f5d4a'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </figure>

        <figure className="chart-panel">
          <figcaption>Sell-out share · {shareLabel}</figcaption>
          <p className="monthly__caption">
            Each salesperson’s percentage of sell-out (line total, HKD) for the full calendar
            month of the review week.
          </p>
          {pieRows.length === 0 ? (
            <p className="monthly__empty">No sell-out in {shareLabel}.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieRows}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={92}
                    paddingAngle={1}
                    stroke="#fcfaf6"
                    isAnimationActive={false}
                    labelLine={false}
                    label={(raw) => {
                      const props = raw as {
                        cx?: number
                        cy?: number
                        midAngle?: number
                        innerRadius?: number
                        outerRadius?: number
                        fill?: string
                        payload?: { share?: number }
                      }
                      const share = props.payload?.share ?? 0
                      // Small wedges stay unlabeled; the list under the chart still shows their percent.
                      if (share < 0.15) return null
                      const cx = Number(props.cx)
                      const cy = Number(props.cy)
                      const midAngle = Number(props.midAngle)
                      const inner = Number(props.innerRadius ?? 0)
                      const outer = Number(props.outerRadius ?? 0)
                      if (![cx, cy, midAngle, outer].every((n) => Number.isFinite(n))) return null
                      const radius = inner + (outer - inner) * 0.62
                      const rad = (-midAngle * Math.PI) / 180
                      const light = new Set(['#d4a017', '#8a9a88', '#c47a4a'])
                      const fill = light.has(String(props.fill ?? '').toLowerCase()) ? '#1a2420' : '#fff'
                      return (
                        <text
                          x={cx + radius * Math.cos(rad)}
                          y={cy + radius * Math.sin(rad)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={fill}
                          fontSize={12}
                          fontWeight={600}
                        >
                          {(share * 100).toFixed(1)}%
                        </text>
                      )
                    }}
                  >
                    {pieRows.map((share, index) => (
                      <Cell key={share.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, item) => {
                      const share = Number(
                        (item as { payload?: { share?: number } } | undefined)?.payload?.share ?? 0,
                      )
                      return [
                        `${formatMoney(Number(value))} · ${(share * 100).toFixed(1)}%`,
                        String(name),
                      ]
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="share-list">
                {shares.map((share, index) => (
                  <li key={share.name}>
                    <span
                      className="share-list__swatch"
                      style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                    />
                    <span>{share.name}</span>
                    <span className="share-list__pct">{(share.share * 100).toFixed(1)}%</span>
                    <span className="muted">{formatMoney(share.revenue)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </figure>
      </div>

      <div className="table-scroll">
        <table className="monthly-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Sales (HKD)</th>
              <th>Qty</th>
              <th>Lines</th>
              <th>Customers</th>
              {showTarget ? <th>Team target</th> : null}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => {
              const target = MONTHLY_TEAM_TARGETS[month.monthKey]
              const active = month.monthKey === activeMonthKey
              return (
                <tr key={month.monthKey} className={active ? 'is-active' : undefined}>
                  <td>
                    {month.label}
                    {active ? <span className="muted"> · review month</span> : null}
                  </td>
                  <td>{formatMoney(month.revenue)}</td>
                  <td>{Math.round(month.quantity).toLocaleString()}</td>
                  <td>{month.lines.toLocaleString()}</td>
                  <td>{month.customers.toLocaleString()}</td>
                  {showTarget ? (
                    <td>
                      {target
                        ? `${formatMoney(target)} · ${((month.revenue / target) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
          {months.length > 0 ? (
            <tfoot>
              <tr>
                <th>All months</th>
                <td>{formatMoney(grand.revenue)}</td>
                <td>{Math.round(grand.quantity).toLocaleString()}</td>
                <td>{grand.lines.toLocaleString()}</td>
                <td />
                {showTarget ? <td /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  )
}
