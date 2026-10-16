import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NamedDelta } from '../lib/aggregates'
import { formatMoney, formatPct, shortName, tickLabel } from '../lib/aggregates'
import { GRID, INK, OLIVE, SAGE, TAUPE } from '../lib/palette'

type Daily = { date: string; revenue: number; quantity: number }

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
    <text x={x} y={y} dy={4} textAnchor="end" fill={INK} fontSize={11}>
      {payload?.value}
    </text>
  )
}

type Props = {
  bySalesperson: NamedDelta[]
  byCustomer: NamedDelta[]
  bySku: NamedDelta[]
  daily: Daily[]
  customerTitle: string
  customerBarColor: string
  skuTitle: string
  skuBarColor: string
}

export function Charts({
  bySalesperson,
  byCustomer,
  bySku,
  daily,
  customerTitle,
  customerBarColor,
  skuTitle,
  skuBarColor,
}: Props) {
  const repData = bySalesperson.map((s) => ({
    name: shortName(s.name),
    thisPeriod: Math.round(s.revenue),
    priorPeriod: Math.round(s.prevRevenue),
  }))

  const topCust = byCustomer.slice(0, 10).map((c) => ({
    name: tickLabel(c.name, 16),
    fullName: c.name,
    revenue: Math.round(c.revenue),
    delta: c.deltaPct,
  }))

  const topSku = [...bySku]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 10)
    .map((s) => ({
      name: s.name,
      qty: Math.round(s.quantity),
      revenue: Math.round(s.revenue),
    }))

  const trend = daily.map((d) => ({
    date: d.date.slice(5),
    revenue: Math.round(d.revenue),
  }))

  return (
    <section className="charts">
      <figure className="chart-panel chart-panel--wide">
        <figcaption>Reps · this week vs same period last month</figcaption>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={repData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={48} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} />
            <Legend formatter={(value) => <span style={{ color: INK }}>{value}</span>} />
            <Bar
              dataKey="priorPeriod"
              name="Same period last month"
              fill={SAGE}
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="thisPeriod" name="This week" fill={OLIVE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </figure>

      <figure className="chart-panel">
        <figcaption>Days in review week</figcaption>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={48} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} />
            <Line type="monotone" dataKey="revenue" stroke={TAUPE} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </figure>

      <figure className="chart-panel">
        <figcaption>{customerTitle}</figcaption>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={topCust} layout="vertical" margin={{ left: 4, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
            <YAxis type="category" dataKey="name" width={118} tick={CustomerTick} />
            <Tooltip
              formatter={(v, name) =>
                name === 'revenue' ? formatMoney(Number(v)) : String(v)
              }
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload as { fullName?: string; delta?: number | null } | undefined
                if (!d) return ''
                const delta =
                  d.delta == null ? 'new vs prior month' : `MoM ${formatPct(d.delta as number)}`
                return `${d.fullName ?? ''} · ${delta}`
              }}
            />
            <Bar dataKey="revenue" fill={customerBarColor} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </figure>

      <figure className="chart-panel chart-panel--wide">
        <figcaption>{skuTitle}</figcaption>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topSku}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={64}
            />
            <YAxis />
            <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} units`, 'Qty']} />
            <Bar dataKey="qty" name="Qty" fill={skuBarColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </figure>
    </section>
  )
}
