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
  averageSellingPrice,
  formatAsp,
  formatMoney,
  formatMonthLabel,
  MONTHLY_TEAM_TARGETS,
  shortName,
  tickLabel,
  type MonthlyRepAsp,
  type MonthTotal,
  type RepAchievement,
  type SellOutShare,
} from '../lib/aggregates'
import {
  orderSeriesLikeShares,
  segmentKey,
  type CustomerMom,
  type MonthDayComparison,
  type StackBar,
  type StackSeries,
} from '../lib/chartSeries'
import { AMBER, GRID, INK, LIGHT_SLICE_FILLS, OLIVE, TAUPE, customerBarColor, customerWeekFill, sliceColorAt } from '../lib/palette'

function SeriesLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="series-legend">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          <span className="series-legend__swatch" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function DayTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload?: { index?: number; label?: string; revenue?: number; priorLabel?: string | null; priorRevenue?: number | null } }[]
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="chart-tip">
      <p className="chart-tip__title">
        Day {row.index} · {row.label}
      </p>
      <p>This month · {formatMoney(row.revenue ?? 0)}</p>
      <p>
        Last month{row.priorLabel ? ` · ${row.priorLabel}` : ''} ·{' '}
        {row.priorRevenue == null ? '—' : formatMoney(row.priorRevenue)}
      </p>
    </div>
  )
}

function MomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload?: { fullName?: string; current?: number; prior?: number | null } }[]
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="chart-tip">
      <p className="chart-tip__title">{row.fullName}</p>
      <p>This period · {formatMoney(row.current ?? 0)}</p>
      {row.prior == null ? null : <p>Last month · {formatMoney(row.prior)}</p>}
    </div>
  )
}

function StackTooltip({
  active,
  payload,
  format,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; payload?: { fullName?: string } }[]
  format: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((row) => row.value != null && Number(row.value) !== 0)
  const title = payload[0]?.payload?.fullName
  return (
    <div className="chart-tip">
      {title ? <p className="chart-tip__title">{title}</p> : null}
      {rows.map((row) => (
        <p key={String(row.name)}>
          {row.name} · {format(Number(row.value))}
        </p>
      ))}
    </div>
  )
}

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
    <text x={x} y={y} dy={4} textAnchor="end" fill={INK} fontSize={12}>
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
  dayComparison: MonthDayComparison | null
  customerMom: CustomerMom | null
  modelStacks: { series: StackSeries[]; bars: StackBar[] }
  mtdThroughLabel: string | null
  salesperson: string
  teamMtdAsp: number | null
  mtdAspByRep: ReadonlyMap<string, number | null>
  repMonthAsp: MonthlyRepAsp
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
  dayComparison,
  customerMom,
  modelStacks,
  mtdThroughLabel,
  salesperson,
  teamMtdAsp,
  mtdAspByRep,
  repMonthAsp,
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
  const grandAsp = averageSellingPrice(grand.revenue, grand.quantity)
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
  const topCustomers = (customerMom?.bars ?? []).map((customer) => ({
    name: tickLabel(customer.name, 24),
    fullName: customer.name,
    current: Math.round(customer.current),
    prior: customer.prior == null ? null : Math.round(customer.prior),
    ...Object.fromEntries(
      (customerMom?.weeks ?? []).map((week) => [
        segmentKey('week', week.key),
        Math.round(customer.weeks[week.key] ?? 0),
      ]),
    ),
  }))
  const modelSeries = orderSeriesLikeShares(modelStacks.series, shares)
  const topModels = modelStacks.bars.map((model) => ({
    name: model.name,
    fullName: model.name,
    ...Object.fromEntries(
      modelSeries.map((series) => [
        segmentKey('rep', series.key),
        Math.round(model.segments[series.key] ?? 0),
      ]),
    ),
  }))
  const dayRows = (dayComparison?.points ?? []).map((day) => ({
    ...day,
    revenue: Math.round(day.revenue),
    priorRevenue: day.priorRevenue == null ? null : Math.round(day.priorRevenue),
  }))

  return (
    <section className="monthly" aria-label="Monthly sales">
      <header>
        <h2>Monthly sales</h2>
        <p>{scopeNote}</p>
        <p>
          Days and customer comparisons line up by working-day index (day 1 on day 1), not calendar
          date. Weekends and Hong Kong public holidays stay off the day axis. Top customers and top
          models run from the 1st through the end of the selected week.
        </p>
      </header>
      <div className="monthly__grid">
        <figure className="chart-panel">
          <figcaption>Total sales by month (HKD)</figcaption>
          {chartRows.length === 0 ? (
            <p className="monthly__empty">No sales in the current filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={48} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="revenue" name="Sales" radius={[6, 6, 0, 0]}>
                  {chartRows.map((month) => (
                    <Cell
                      key={month.monthKey}
                      fill={month.monthKey === activeMonthKey ? AMBER : OLIVE}
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
                    stroke={TAUPE}
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
                      const fill = LIGHT_SLICE_FILLS.has(String(props.fill ?? '').toLowerCase()) ? INK : '#fff'
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

      <figure className="chart-panel chart-stack">
        <figcaption>Days in review month · {shareLabel}</figcaption>
        <p className="monthly__caption">
          {dayComparison?.hasPrior
            ? 'Solid line runs through the last day with sales; the dashed line is the same index last month.'
            : `No ${dayComparison?.priorMonthLabel ?? 'prior month'} lines are loaded, so only this month’s working days are shown.`}
        </p>
        {dayRows.length === 0 ? (
          <p className="monthly__empty">No daily sales in {shareLabel}.</p>
        ) : (
          <>
            <ul className="series-legend">
              <li>
                <span className="series-legend__swatch" style={{ background: TAUPE }} />
                This month
              </li>
              {dayComparison?.hasPrior ? (
                <li>
                  <span className="series-legend__swatch series-legend__swatch--dashed" />
                  Last month
                </li>
              ) : null}
            </ul>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dayRows}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={48} />
                <Tooltip content={<DayTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="This month"
                  stroke={TAUPE}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                {dayComparison?.hasPrior ? (
                  <Line
                    type="monotone"
                    dataKey="priorRevenue"
                    name="Last month"
                    stroke={OLIVE}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls={false}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </figure>

      <figure className="chart-panel chart-stack">
        <figcaption>{customerTitle}</figcaption>
        <p className="monthly__caption">
          {customerMom?.hasPrior && customerMom.span.priorThroughDate
            ? `This period stacks weeks from the start of ${shareLabel} through ${mtdThroughLabel} (${customerMom.span.workingDayCount} working days), compared with last month through ${customerMom.span.priorThroughDate.slice(5)}.`
            : customerMom
              ? `No ${customerMom.span.priorMonthLabel} lines are loaded, so this period stacks weeks from the start of ${shareLabel} through ${mtdThroughLabel} with no comparison bar.`
              : 'Choose a review week to see month-to-date customers.'}
        </p>
        {topCustomers.length === 0 ? (
          <p className="monthly__empty">No customers in {shareLabel}.</p>
        ) : (
          <>
            <ul className="series-legend">
              {(customerMom?.weeks ?? []).map((week, index) => (
                <li key={week.key}>
                  <span className="series-legend__swatch" style={{ background: customerWeekFill(index) }} />
                  {week.label}
                </li>
              ))}
              {customerMom?.hasPrior ? (
                <li>
                  <span className="series-legend__swatch series-legend__swatch--muted" />
                  Last month
                </li>
              ) : null}
            </ul>
            <ResponsiveContainer width="100%" height={520}>
              <BarChart data={topCustomers} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={196} tick={CustomerTick} />
                <Tooltip content={<MomTooltip />} />
                {(customerMom?.weeks ?? []).map((week, index) => (
                  <Bar
                    key={week.key}
                    dataKey={segmentKey('week', week.key)}
                    name={week.label}
                    stackId="current"
                    fill={customerWeekFill(index)}
                    stroke={TAUPE}
                    strokeWidth={1}
                    isAnimationActive={false}
                  />
                ))}
                {customerMom?.hasPrior ? (
                  <Bar
                    dataKey="prior"
                    name="Last month"
                    fill={OLIVE}
                    fillOpacity={0.45}
                    isAnimationActive={false}
                  />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </figure>

      <figure className="chart-panel chart-stack">
        <figcaption>{modelTitle}</figcaption>
        <p className="monthly__caption">
          Top 10 by quantity from the start of {shareLabel} through {mtdThroughLabel ?? 'the selected week'}, stacked by salesperson.
        </p>
        {topModels.length === 0 ? (
          <p className="monthly__empty">No product models in {shareLabel}.</p>
        ) : (
          <>
            <SeriesLegend
              items={modelSeries.map((series, index) => ({
                label: series.label,
                color: customerBarColor(shares, series.key, sliceColorAt(index)),
              }))}
            />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topModels}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={64}
                />
                <YAxis />
                <Tooltip content={<StackTooltip format={(value) => `${value.toLocaleString()} units`} />} />
                {modelSeries.map((series, index) => (
                  <Bar
                    key={series.key}
                    dataKey={segmentKey('rep', series.key)}
                    name={series.label}
                    stackId="rep"
                    fill={customerBarColor(shares, series.key, sliceColorAt(index))}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </figure>

      <div className="table-scroll monthly-metrics">
        <table className="monthly-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Sales (HKD)</th>
              <th>Qty</th>
              <th>ASP</th>
              {repMonthAsp.reps.map((name) => (
                <th key={name}>{shortName(name)} ASP</th>
              ))}
              <th>Invoices</th>
              <th>Customers</th>
              {showTarget ? <th>Team target</th> : null}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => {
              const target = MONTHLY_TEAM_TARGETS[month.monthKey]
              const active = month.monthKey === activeMonthKey
              const repAsp = repMonthAsp.byMonth.get(month.monthKey)
              return (
                <tr key={month.monthKey} className={active ? 'is-active' : undefined}>
                  <td>
                    {month.label}
                    {active ? <span className="muted"> · review month</span> : null}
                  </td>
                  <td>{formatMoney(month.revenue)}</td>
                  <td>{Math.round(month.quantity).toLocaleString()}</td>
                  <td>{formatAsp(month.asp)}</td>
                  {repMonthAsp.reps.map((name) => (
                    <td key={name}>{formatAsp(repAsp?.get(name) ?? null)}</td>
                  ))}
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
                <td>{formatAsp(grandAsp)}</td>
                {repMonthAsp.reps.map((name) => (
                  <td key={name}>{formatAsp(repMonthAsp.totals.get(name) ?? null)}</td>
                ))}
                <td>{grand.invoices.toLocaleString()}</td>
                <td />
                {showTarget ? <td /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <RepTargets
        rows={repRows}
        activeMonthKey={activeMonthKey}
        mtdThroughLabel={mtdThroughLabel}
        teamMtdAsp={teamMtdAsp}
        mtdAspByRep={mtdAspByRep}
      />
    </section>
  )
}

function RepTargets({
  rows,
  activeMonthKey,
  mtdThroughLabel,
  teamMtdAsp,
  mtdAspByRep,
}: {
  rows: RepAchievement[]
  activeMonthKey: string | null
  mtdThroughLabel: string | null
  teamMtdAsp: number | null
  mtdAspByRep: ReadonlyMap<string, number | null>
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
        reps. Targets are team-level and are not resized by the department filter. MTD ASP uses the
        review filters and the same MTD cutoff as the scorecard. A selected salesperson leaves the
        other reps’ ASP as —.
      </p>

      {reviewRows.length > 0 ? (
        <div className="rep-targets__block">
          <h4>{reviewLabel} · review month</h4>
          <p className="monthly__caption">
            Team MTD ASP through {mtdThroughLabel ?? '—'} is {formatAsp(teamMtdAsp)}. ASP is
            tax-inclusive sell-out divided by units.
          </p>
          <div className="table-scroll">
            <table className="monthly-table">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Sell-out (HKD)</th>
                  <th>Target</th>
                  <th>Achieve</th>
                  <th>MTD ASP</th>
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
                    <td className="mono">{formatAsp(mtdAspByRep.get(row.name) ?? null)}</td>
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
