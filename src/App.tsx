import { useEffect, useMemo, useState } from 'react'
import { Charts } from './components/Charts'
import { FilterBar } from './components/FilterBar'
import { KpiRow } from './components/KpiRow'
import { LineTable } from './components/LineTable'
import { RepBoard } from './components/RepBoard'
import {
  dailyTrend,
  filterByDateRange,
  filterItems,
  filterMtdThroughWeek,
  formatRangeLabel,
  groupByWithPrior,
  isoWeekKey,
  listWeekKeys,
  monthKeyFromDate,
  pctDelta,
  samePeriodLastMonth,
  sumQty,
  sumRevenue,
  teamTargetForMonth,
  uniqueCustomers,
  uniqueSorted,
  weekDateRange,
  weekLabel,
} from './lib/aggregates'
import type { Filters, SalesPayload } from './lib/types'
import './App.css'

export default function App() {
  const [payload, setPayload] = useState<SalesPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/sales-line-items.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load data (${r.status})`)
        return r.json() as Promise<SalesPayload>
      })
      .then((data) => {
        if (cancelled) return
        setPayload(data)
        const weeks = listWeekKeys(data.lineItems)
        const latest = weeks[weeks.length - 1] ?? 'all'
        setFilters({
          weekKey: latest,
          salesperson: 'all',
          // Confirmed default: All departments (no pre-selection)
          department: 'all',
          query: '',
        })
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const weeks = useMemo(
    () => (payload ? listWeekKeys(payload.lineItems) : []),
    [payload],
  )
  const salespeople = useMemo(
    () => (payload ? uniqueSorted(payload.lineItems.map((r) => r.salesperson)) : []),
    [payload],
  )
  const departments = useMemo(
    () => (payload ? uniqueSorted(payload.lineItems.map((r) => r.department)) : []),
    [payload],
  )

  const selectedRange =
    filters && filters.weekKey !== 'all' ? weekDateRange(filters.weekKey) : null
  const priorRange = selectedRange ? samePeriodLastMonth(selectedRange) : null

  const thisWeek = useMemo(() => {
    if (!payload || !filters) return []
    return filterItems(payload.lineItems, filters)
  }, [payload, filters])

  const priorPeriod = useMemo(() => {
    if (!payload || !filters || !priorRange) return []
    return filterByDateRange(
      payload.lineItems,
      filters,
      priorRange.start,
      priorRange.end,
    )
  }, [payload, filters, priorRange])

  const mtd = useMemo(() => {
    if (!payload || !filters || filters.weekKey === 'all') return []
    return filterMtdThroughWeek(payload.lineItems, filters, filters.weekKey)
  }, [payload, filters])

  const bySp = useMemo(
    () => groupByWithPrior(thisWeek, priorPeriod, (r) => r.salesperson),
    [thisWeek, priorPeriod],
  )
  const byCust = useMemo(
    () => groupByWithPrior(thisWeek, priorPeriod, (r) => r.customer),
    [thisWeek, priorPeriod],
  )
  const bySku = useMemo(
    () => groupByWithPrior(thisWeek, priorPeriod, (r) => r.productModel || r.sku),
    [thisWeek, priorPeriod],
  )
  const daily = useMemo(() => dailyTrend(thisWeek), [thisWeek])

  if (error) {
    return (
      <div className="shell shell--error">
        <p>Could not load sales data: {error}</p>
      </div>
    )
  }

  if (!payload || !filters) {
    return (
      <div className="shell shell--loading">
        <p>Loading weekly review…</p>
      </div>
    )
  }

  const revenue = sumRevenue(thisWeek)
  const prevRevenue = sumRevenue(priorPeriod)
  const delta = pctDelta(revenue, prevRevenue)
  const range = selectedRange
  const monthKey = range ? monthKeyFromDate(range.end) : '2026-10'
  const monthTarget = teamTargetForMonth(monthKey, payload.meta.targets)
  const mtdRevenue = sumRevenue(mtd)
  const dateExtent = payload.lineItems
    .map((r) => r.date)
    .filter((d): d is string => Boolean(d))
    .sort()
  const dataFrom = dateExtent[0]
  const dataTo = dateExtent[dateExtent.length - 1]
  const priorLabel = priorRange ? formatRangeLabel(priorRange) : null

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero__brand">
          <p className="hero__eyebrow">Team Aaron · Galaxy / KA</p>
          <h1>Weekly manager review</h1>
          <p className="hero__lede">
            Pick a review week, then compare it to the{' '}
            <strong>same calendar dates last month</strong> (MoM). Scan reps and
            movers, then open line detail. Seeded from the Team Aaron Excel
            examples ({dataFrom} → {dataTo}). Currency: HKD.
          </p>
        </div>
        <div className="hero__aside">
          <p className="hero__week">{weekLabel(filters.weekKey)}</p>
          <p className="hero__aside-meta">
            MoM vs {priorLabel ? `prior month ${priorLabel}` : '—'}
          </p>
        </div>
      </header>

      <FilterBar
        filters={filters}
        weeks={weeks}
        salespeople={salespeople}
        departments={departments}
        onChange={setFilters}
        rowCount={thisWeek.length}
      />

      <KpiRow
        weekLabel={filters.weekKey}
        priorPeriodLabel={priorLabel}
        revenue={revenue}
        prevRevenue={prevRevenue}
        delta={delta}
        customers={uniqueCustomers(thisWeek)}
        prevCustomers={uniqueCustomers(priorPeriod)}
        quantity={sumQty(thisWeek)}
        lines={thisWeek.length}
        mtdRevenue={mtdRevenue}
        monthTarget={monthTarget}
        monthLabel={monthKey}
      />

      <RepBoard rows={bySp} />

      <Charts bySalesperson={bySp} byCustomer={byCust} bySku={bySku} daily={daily} />

      <LineTable rows={thisWeek} />

      <footer className="footer">
        <p>
          Phase 1 web app · {payload.meta.mergedRows.toLocaleString()} line items ·
          ISO week {filters.weekKey}
          {priorRange
            ? ` · MoM baseline ${priorRange.start} → ${priorRange.end}`
            : ''}
          {thisWeek[0]?.date
            ? ` · sample day ${isoWeekKey(thisWeek[0].date!)}`
            : ''}
        </p>
      </footer>
    </div>
  )
}
