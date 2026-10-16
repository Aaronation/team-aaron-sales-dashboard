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
import { formatMoney, formatPct, shortName } from '../lib/aggregates'

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
    <text x={x} y={y} dy={4} textAnchor="end" fill="#3d342c" fontSize={11}>
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
    name: c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name,
    revenue: Math.round(c.revenue),
    delta: c.deltaPct,
  }))

  const topSku = bySku.slice(0, 8).map((s) => ({
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,52,44,0.08)" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={48} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} />
            <Legend />
            <Bar
              dataKey="priorPeriod"
              name="Same period last month"
              fill="#DFCF99"
              radius={[4, 4, 0, 0]}
            />
            <Bar dataKey="thisPeriod" name="This week" fill="#9AAB78" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </figure>

      <figure className="chart-panel">
        <figcaption>Days in review week</figcaption>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,52,44,0.08)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={48} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} />
            <Line type="monotone" dataKey="revenue" stroke="#866C5A" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </figure>

      <figure className="chart-panel">
        <figcaption>{customerTitle}</figcaption>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={topCust} layout="vertical" margin={{ left: 4, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,52,44,0.08)" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
            <YAxis type="category" dataKey="name" width={118} tick={CustomerTick} />
            <Tooltip
              formatter={(v, name) =>
                name === 'revenue' ? formatMoney(Number(v)) : String(v)
              }
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload
                if (!d) return ''
                const delta =
                  d.delta == null ? 'new vs prior month' : `MoM ${formatPct(d.delta as number)}`
                return `${d.name} · ${delta}`
              }}
            />
            <Bar dataKey="revenue" fill={customerBarColor} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </figure>

      <figure className="chart-panel">
        <figcaption>{skuTitle}</figcaption>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topSku}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,52,44,0.08)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={64}
            />
            <YAxis />
            <Tooltip
              formatter={(v, name) =>
                name === 'qty' ? Number(v).toLocaleString() : formatMoney(Number(v))
              }
            />
            <Bar dataKey="qty" fill={skuBarColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </figure>
    </section>
  )
}
