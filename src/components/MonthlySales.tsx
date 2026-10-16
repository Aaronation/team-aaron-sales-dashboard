import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatMoney,
  formatMonthLabel,
  MONTHLY_TEAM_TARGETS,
  shortName,
  tickLabel,
  type MonthTotal,
  type NamedTotal,
  type RepAchievement,
  type SellOutShare,
} from '../lib/aggregates'
import { sliceColorAt } from '../lib/palette'

function CustomerTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: string | number
  y?: string | number
  payload?: { value?: string }
}) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#3d342c" fontSize={12}>
      {payload?.value}
    </text>
  )
}

type Props = {
  months: MonthTotal[]
  activeMonthKey: string | null
  shares: SellOutShare[]
  shareLabel: string
  scopeNote: string
  showTarget: boolean
  repRows: RepAchievement[]
  monthCustomers: NamedTotal[]
  monthDays: { date: string; revenue: number }[]
  monthModels: NamedTotal[]
  salesperson: string
  customerBarColor: string
  modelBarColor: string
}

function formatAchieve(achieve: number | null): string {
  if (achieve == null) return '—'
  return `${(achieve * 100).toFixed(1)}%`
}

export function MonthlySales({
  months,
  activeMonthKey,
  shares,
  shareLabel,
  scopeNote,
  showTarget,
  repRows,
  monthCustomers,
  monthDays,
  monthModels,
  salesperson,
  customerBarColor,
  modelBarColor,
}: Props) {
  const chartRows = months.map((month) => ({
    ...month,
    revenue: Math.round(month.revenue),
  }))
  const grand = months.reduce(
    (sum, month) => ({
      revenue: sum.revenue + month.revenue,
      quantity: sum.quantity + month.quantity,
      invoices: sum.invoices + month.invoices,
    }),
    { revenue: 0, quantity: 0, invoices: 0 },
  )
  const repLabel = salesperson === 'all' ? null : shortName(salesperson)
  const pieRows = shares
    .filter((share) => share.revenue > 0)
    .map((share) => ({ ...share, name: shortName(share.name) }))
  const customerTitle = repLabel
    ? `${repLabel} top customers · ${shareLabel}`
    : `Top customers · ${shareLabel}`
  const modelTitle = repLabel
    ? `${repLabel} top product models · ${shareLabel}`
    : `Top product models · ${shareLabel}`
  const topCustomers = monthCustomers.slice(0, 10).map((customer) => ({
    name: tickLabel(customer.name, 24),
    fullName: customer.name,
    revenue: Math.round(customer.revenue),
  }))
  const topModels = [...monthModels]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 10)
    .map((model) => ({
      name: model.name,
      qty: Math.round(model.quantity),
      revenue: Math.round(model.revenue),
    }))
  const dayRows = monthDays.map((day) => ({
    date: day.date.slice(5),
    revenue: Math.round(day.revenue),
  }))

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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,52,44,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={48} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="revenue" name="Sales" radius={[4, 4, 0, 0]}>
                  {chartRows.map((month) => (
                    <Cell
                      key={month.monthKey}
                      fill={month.monthKey === activeMonthKey ? '#E0B44A' : '#9AAB78'}
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
                    stroke="#866C5A"
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
                      const light = new Set(['#dfcf99', '#e0b44a', '#f3ead8', '#d8853f', '#9aab78'])
                      const fill = light.has(String(props.fill ?? '').toLowerCase()) ? '#3d342c' : '#fff'
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
                      <Cell key={share.name} fill={sliceColorAt(index)} />
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
                      style={{ background: sliceColorAt(index) }}
                    />
                    <span>{shortName(share.name)}</span>
                    <span className="share-list__pct">{(share.share * 100).toFixed(1)}%</span>
                    <span className="muted">{formatMoney(share.revenue)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </figure>
      </div>

      <figure className="chart-panel monthly-customers">
        <figcaption>Days in review month · {shareLabel}</figcaption>
        <p className="monthly__caption">
          Daily sell-out for the full calendar month of the review week. Days with no sales are
          zero. The axis stops on the last day that has sales.
        </p>
        {dayRows.length === 0 ? (
          <p className="monthly__empty">No daily sales in {shareLabel}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dayRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,52,44,0.08)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={48} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#866C5A" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </figure>

      <figure className="chart-panel monthly-customers">
        <figcaption>{customerTitle}</figcaption>
        <p className="monthly__caption">
          Top 10 by sell-out (HKD) for the review month. Follows the salesperson, department, and
          search filters.
        </p>
        {topCustomers.length === 0 ? (
          <p className="monthly__empty">No customers in {shareLabel}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={topCustomers} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,52,44,0.08)" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
              <YAxis type="category" dataKey="name" width={196} tick={CustomerTick} />
              <Tooltip
                formatter={(value) => formatMoney(Number(value))}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { fullName?: string } | undefined
                  return row?.fullName ?? ''
                }}
              />
              <Bar dataKey="revenue" name="Sell-out" fill={customerBarColor} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </figure>

      <figure className="chart-panel monthly-customers">
        <figcaption>{modelTitle}</figcaption>
        <p className="monthly__caption">
          Top 10 product models by quantity for the review month. Follows the salesperson,
          department, and search filters.
        </p>
        {topModels.length === 0 ? (
          <p className="monthly__empty">No product models in {shareLabel}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topModels}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,52,44,0.08)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={64}
              />
              <YAxis />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString()} units`, 'Qty']}
              />
              <Bar dataKey="qty" name="Qty" fill={modelBarColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </figure>

      <div className="table-scroll">
        <table className="monthly-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Sales (HKD)</th>
              <th>Qty</th>
              <th>Invoices</th>
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
                  <td>{month.invoices.toLocaleString()}</td>
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
                <td>{grand.invoices.toLocaleString()}</td>
                <td />
                {showTarget ? <td /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <RepTargets rows={repRows} activeMonthKey={activeMonthKey} />
    </section>
  )
}

function RepTargets({
  rows,
  activeMonthKey,
}: {
  rows: RepAchievement[]
  activeMonthKey: string | null
}) {
  if (rows.length === 0 || rows.every((row) => row.months.length === 0)) return null
  const monthColumns = rows[0]?.months ?? []
  const reviewLabel = activeMonthKey ? formatMonthLabel(activeMonthKey) : null
  const reviewRows = activeMonthKey
    ? rows.flatMap((row) => {
        const figure = row.months.find((month) => month.monthKey === activeMonthKey)
        return figure ? [{ row, figure }] : []
      })
    : []

  return (
    <div className="rep-targets">
      <h3>Monthly target by salesperson</h3>
      <p className="monthly__caption">
        Targets are the team month target × split: Aaron 49%, Kelvin 31%, Kenny 20%.
        Achieve rate is that rep’s month sell-out divided by their target. Reps without a split,
        including Unassigned, show sell-out against —. The salesperson filter does not hide other
        reps. Targets are team-level and are not resized by the department filter.
      </p>

      {reviewRows.length > 0 ? (
        <div className="rep-targets__block">
          <h4>{reviewLabel} · review month</h4>
          <div className="table-scroll">
            <table className="monthly-table">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Sell-out (HKD)</th>
                  <th>Target</th>
                  <th>Achieve</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map(({ row, figure }) => (
                  <tr key={row.name}>
                    <td>{shortName(row.name)}</td>
                    <td className="mono">{formatMoney(figure.revenue)}</td>
                    <td className="mono">{figure.target == null ? '—' : formatMoney(figure.target)}</td>
                    <td className="rep-targets__achieve">
                      <span>{formatAchieve(figure.achieve)}</span>
                      {figure.achieve != null ? (
                        <span className="rep-targets__bar" aria-hidden="true">
                          <span style={{ width: `${Math.min(figure.achieve, 1) * 100}%` }} />
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {monthColumns.length >= 2 ? (
        <div className="rep-targets__block">
          <h4>Achieve by month</h4>
          <div className="table-scroll">
            <table className="monthly-table">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  {monthColumns.map((month) => (
                    <th
                      key={month.monthKey}
                      className={month.monthKey === activeMonthKey ? 'is-active' : undefined}
                    >
                      {month.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name}>
                    <td>{shortName(row.name)}</td>
                    {row.months.map((month) => (
                      <td
                        key={month.monthKey}
                        className={month.monthKey === activeMonthKey ? 'is-active' : undefined}
                      >
                        <span>{formatAchieve(month.achieve)}</span>
                        <span className="rep-targets__sub">
                          {month.target == null ? 'no target' : formatMoney(month.target)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
