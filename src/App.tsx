import { useEffect, useMemo, useRef, useState } from 'react'
import { Charts } from './components/Charts'
import { FilterBar } from './components/FilterBar'
import { ForecastPanel } from './components/ForecastPanel'
import { ImportPanel } from './components/ImportPanel'
import { KpiRow } from './components/KpiRow'
import { LineTable } from './components/LineTable'
import { MonthlySales } from './components/MonthlySales'
import { RepBoard } from './components/RepBoard'
import {
  dailyTrend,
  filterByDateRange,
  filterIgnoringWeek,
  filterItems,
  filterMtdThroughWeek,
  formatMonthLabel,
  formatRangeLabel,
  groupByWithPrior,
  invoiceCountsBy,
  isoWeekKey,
  listWeekKeys,
  monthKeyFromDate,
  monthlyTotals,
  pctDelta,
  repMonthAchievements,
  samePeriodLastMonth,
  sellOutShares,
  shortName,
  sumQty,
  sumRevenue,
  teamTargetForMonth,
  uniqueCustomers,
  uniqueInvoices,
  uniqueSorted,
  reviewWindow,
  weekLabel,
} from './lib/aggregates'
import { customerWorkingDayMom, modelRepStacks, monthDailyComparison } from './lib/chartSeries'
import { forecastForReview, forecastScopeNote, reviewTarget } from './lib/forecast'
import { mtdWorkingDays } from './lib/hkHolidays'
import { initialFilters, reconcileFilters } from './lib/filters'
import { ALL_REPS_SKU_BAR, customerBarColor } from './lib/palette'
import { mergeImportedItems, type ImportMode } from './lib/ingest'
import { readImportFile, type LoadedImport } from './lib/readImportFile'
import type { Filters, LineItem, SalesPayload } from './lib/types'
import {
  browserWorkingSetStore,
  loadDashboard,
  resetDashboard,
  saveFilters,
  saveImport,
} from './lib/workingSet'
import './App.css'

const workingSetStore = browserWorkingSetStore()

async function fetchSeed(kind: 'data' | 'seed' = 'data'): Promise<SalesPayload> {
  const response = await fetch('/data/sales-line-items.json')
  if (!response.ok) {
    const label = kind === 'seed' ? 'seed data' : 'data'
    throw new Error(`Failed to load ${label} (${response.status})`)
  }
  return (await response.json()) as SalesPayload
}

function monthlyScopeNote(filters: Filters): string {
  const parts: string[] = []
  if (filters.salesperson !== 'all') parts.push(shortName(filters.salesperson))
  if (filters.department !== 'all') parts.push(filters.department)
  const query = filters.query.trim()
  if (query) parts.push(`search “${query}”`)
  const scope = parts.length ? `Narrowed to ${parts.join(' · ')}.` : 'All reps and departments.'
  return `${scope} Month totals ignore the review week. The sell-out pie keeps every rep.`
}

function dateSpan(items: LineItem[]): string | null {
  const dates = items.map((row) => row.date).filter((date): date is string => Boolean(date)).sort()
  if (dates.length === 0) return null
  if (dates[0] === dates[dates.length - 1]) return dates[0]
  return `${dates[0]} → ${dates[dates.length - 1]}`
}

function describeImport(
  loaded: LoadedImport,
  mode: ImportMode,
  integrated: { added: number; replaced: number; lineItems: LineItem[] },
): string {
  const span = dateSpan(loaded.lineItems)
  const spanText = span ? ` (${span})` : ''
  const base =
    mode === 'replace'
      ? `Replaced dashboard data with ${loaded.lineItems.length.toLocaleString()} rows from ${loaded.label}${spanText}.`
      : `Merged ${loaded.label}${spanText}: ${integrated.added.toLocaleString()} added, ${integrated.replaced.toLocaleString()} updated. ${integrated.lineItems.length.toLocaleString()} rows now.`
  const extra = loaded.warnings.slice(0, 2).join(' ')
  return extra ? `${base} ${extra}` : base
}

export default function App() {
  const [payload, setPayload] = useState<SalesPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters | null>(null)
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const importingRef = useRef(false)
  const persistedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadDashboard(workingSetStore, () => fetchSeed())
      .then((loaded) => {
        if (cancelled) return
        persistedRef.current = loaded.source === 'saved'
        setSaved(loaded.source === 'saved')
        setPayload(loaded.payload)
        setFilters(loaded.filters)
        setImportNote(loaded.note)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleFilters(next: Filters) {
    setFilters(next)
    if (!persistedRef.current) return
    try {
      saveFilters(workingSetStore, next)
    } catch {
      // The imported lines stay saved. This filter change may reset on refresh.
    }
  }

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

  const review = filters && filters.weekKey !== 'all' ? reviewWindow(filters.weekKey) : null
  const selectedRange = review?.range ?? null
  const priorRange = selectedRange ? samePeriodLastMonth(selectedRange) : null
  const workingDays = review
    ? mtdWorkingDays(review.monthKey, review.throughDate)
    : { elapsed: 0, total: 0, holidaysLoaded: false }

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

  const monthScoped = useMemo(() => {
    if (!payload || !filters) return []
    return filterIgnoringWeek(payload.lineItems, filters)
  }, [payload, filters])
  const months = useMemo(() => monthlyTotals(monthScoped), [monthScoped])

  const shareMonthKey = review?.monthKey ?? null
  const dayComparison = useMemo(
    () => (shareMonthKey ? monthDailyComparison(monthScoped, shareMonthKey) : null),
    [monthScoped, shareMonthKey],
  )
  const mtdThrough = review?.throughDate ?? null
  const customerMom = useMemo(
    () =>
      shareMonthKey && mtdThrough
        ? customerWorkingDayMom(monthScoped, shareMonthKey, mtdThrough)
        : null,
    [monthScoped, shareMonthKey, mtdThrough],
  )
  const modelStacks = useMemo(
    () =>
      shareMonthKey && mtdThrough
        ? modelRepStacks(monthScoped, shareMonthKey, mtdThrough)
        : { series: [], bars: [] },
    [monthScoped, shareMonthKey, mtdThrough],
  )
  const weekInvoices = useMemo(
    () => invoiceCountsBy(thisWeek, (row) => row.salesperson),
    [thisWeek],
  )
  const shareRows = useMemo(() => {
    if (!payload || !filters) return []
    const monthKey = filters.weekKey === 'all' ? null : reviewWindow(filters.weekKey)?.monthKey
    const base = filterIgnoringWeek(payload.lineItems, {
      weekKey: filters.weekKey,
      salesperson: 'all',
      department: filters.department,
      query: filters.query,
    })
    if (!monthKey) return base
    return base.filter((row) => row.date != null && monthKeyFromDate(row.date) === monthKey)
  }, [payload, filters])
  const shares = useMemo(() => sellOutShares(shareRows), [shareRows])
  const repRows = useMemo(() => {
    if (!payload || !filters) return []
    const base = filterIgnoringWeek(payload.lineItems, {
      weekKey: filters.weekKey,
      salesperson: 'all',
      department: filters.department,
      query: filters.query,
    })
    return repMonthAchievements(base)
  }, [payload, filters])

  async function handleImport(file: File, mode: ImportMode) {
    if (!payload || importingRef.current) return
    importingRef.current = true
    setImporting(true)
    setImportError(null)
    try {
      const loaded = await readImportFile(file)
      const integrated = mergeImportedItems(payload.lineItems, loaded.lineItems, mode)
      const generatedFrom =
        mode === 'replace'
          ? [`import:${loaded.label}`]
          : [...payload.meta.generatedFrom, `import:${loaded.label}`]
      const next: SalesPayload = {
        ...payload,
        meta: {
          ...payload.meta,
          generatedFrom,
          mergedRows: integrated.lineItems.length,
        },
        lineItems: integrated.lineItems,
      }
      const note = describeImport(loaded, mode, integrated)
      const reconciled = reconcileFilters(filters ?? initialFilters(next.lineItems), next.lineItems)
      try {
        await saveImport(workingSetStore, next, reconciled, note)
        persistedRef.current = true
        setSaved(true)
      } catch {
        setImportError('This browser could not save the latest import.')
      }
      setPayload(next)
      setFilters(reconciled)
      setImportNote(note)
    } catch (err) {
      setImportError(err instanceof Error && err.message ? err.message : 'Import failed.')
    } finally {
      importingRef.current = false
      setImporting(false)
    }
  }

  async function handleLoadSample(mode: ImportMode) {
    const response = await fetch('/data/sample-kingdee-import.csv')
    if (!response.ok) {
      setImportError('Sample export is missing.')
      return
    }
    const blob = await response.blob()
    await handleImport(new File([blob], 'sample-kingdee-import.csv', { type: 'text/csv' }), mode)
  }

  async function handleReset() {
    if (importingRef.current) return
    importingRef.current = true
    setImporting(true)
    setImportError(null)
    try {
      const restored = await resetDashboard(workingSetStore, () => fetchSeed('seed'))
      persistedRef.current = false
      setSaved(false)
      setPayload(restored.payload)
      setFilters(restored.filters)
      setImportNote(restored.note)
    } catch (err) {
      setImportError(err instanceof Error && err.message ? err.message : 'Could not restore seed data.')
    } finally {
      importingRef.current = false
      setImporting(false)
    }
  }

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
  const monthKey = review?.monthKey ?? '2026-10'
  const monthTarget = teamTargetForMonth(monthKey, payload.meta.targets)
  const pacedTarget = reviewTarget(filters.salesperson, monthKey, payload.meta.targets)
  const mtdRevenue = sumRevenue(mtd)
  const monthForecast = selectedRange
    ? forecastForReview({
        monthKey,
        throughDate: review?.throughDate ?? selectedRange.end,
        mtdRevenue,
        target: pacedTarget.amount,
      })
    : null
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
            movers, then open line detail. Monthly totals and each rep’s sell-out
            share sit under the scorecard, with target pace and a working-day
            forecast beside it. Seeded from the Team Aaron Excel
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

      <ImportPanel
        busy={importing}
        note={importNote}
        error={importError}
        onImportFile={(file, mode) => {
          void handleImport(file, mode)
        }}
        onLoadSample={(mode) => {
          void handleLoadSample(mode)
        }}
        onReset={() => {
          void handleReset()
        }}
        saved={saved}
      />

      <FilterBar
        filters={filters}
        weeks={weeks}
        salespeople={salespeople}
        departments={departments}
        onChange={handleFilters}
        rowCount={uniqueInvoices(thisWeek)}
        disabled={importing}
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
        invoices={uniqueInvoices(thisWeek)}
        mtdRevenue={mtdRevenue}
        monthTarget={monthTarget}
        monthLabel={monthKey}
        monthRevenue={months.find((month) => month.monthKey === monthKey)?.revenue ?? 0}
        reviewMonthLabel={formatMonthLabel(monthKey)}
        mtdWorkingDays={workingDays.elapsed}
        monthWorkingDays={workingDays.total}
        workingDaysThrough={review ? review.throughDate.slice(5) : '—'}
        holidaysLoaded={workingDays.holidaysLoaded}
      />

      {selectedRange && monthForecast ? (
        <ForecastPanel
          monthLabel={formatMonthLabel(monthKey)}
          throughLabel={review ? review.throughDate.slice(5) : selectedRange.end.slice(5)}
          targetLabel={pacedTarget.label}
          scopeNote={forecastScopeNote(filters)}
          result={monthForecast}
        />
      ) : null}

      <MonthlySales
        months={months}
        activeMonthKey={shareMonthKey}
        shares={shares}
        shareLabel={shareMonthKey ? formatMonthLabel(shareMonthKey) : 'All loaded months'}
        scopeNote={monthlyScopeNote(filters)}
        showTarget={filters.salesperson === 'all'}
        repRows={repRows}
        dayComparison={dayComparison}
        customerMom={customerMom}
        modelStacks={modelStacks}
        mtdThroughLabel={mtdThrough ? mtdThrough.slice(5) : null}
        salesperson={filters.salesperson}
      />

      <RepBoard rows={bySp} invoiceCounts={weekInvoices} />

      <Charts
        bySalesperson={bySp}
        byCustomer={byCust}
        bySku={bySku}
        daily={daily}
        customerTitle={
          filters.salesperson === 'all'
            ? 'Top customers this week'
            : `${shortName(filters.salesperson)} top customers`
        }
        customerBarColor={customerBarColor(shares, filters.salesperson)}
        skuTitle={
          filters.salesperson === 'all'
            ? 'Top product models (qty)'
            : `${shortName(filters.salesperson)} top product models`
        }
        skuBarColor={customerBarColor(shares, filters.salesperson, ALL_REPS_SKU_BAR)}
      />

      <LineTable rows={thisWeek} />

      <footer className="footer">
        <p>
          Phase 3 · {uniqueInvoices(payload.lineItems).toLocaleString()} invoices · ISO week{' '}
          {filters.weekKey}
          {payload.meta.generatedFrom.some((name) => name.startsWith('import:'))
            ? ` · ${payload.meta.generatedFrom
                .filter((name) => name.startsWith('import:'))
                .map((name) => name.replace(/^import:/, ''))
                .join(', ')}`
            : ' · bundled seed'}
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
