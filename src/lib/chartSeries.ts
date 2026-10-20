import {
  addMonthsClamped,
  formatMonthLabel,
  monthDaily,
  monthKeyFromDate,
  shortName,
} from './aggregates'
import { isWorkingDay } from './hkHolidays'
import type { LineItem } from './types'

export type MonthDayPoint = {
  /** 1-based working-day index inside the month. */
  index: number
  date: string
  /** Review-month label, MM-DD. */
  label: string
  revenue: number
  priorDate: string | null
  /** Prior-month label, MM-DD. */
  priorLabel: string | null
  /** Null when that index has no working day last month, or last month has no lines. */
  priorRevenue: number | null
}

export type MonthDayComparison = {
  priorMonthKey: string
  priorMonthLabel: string
  hasPrior: boolean
  points: MonthDayPoint[]
}

export type StackSeries = {
  key: string
  label: string
}

export type StackBar = {
  name: string
  total: number
  segments: Record<string, number>
}

export function previousMonthKey(monthKey: string): string {
  return addMonthsClamped(`${monthKey}-01`, -1).slice(0, 7)
}

export function segmentKey(kind: 'rep', id: string): string {
  return `${kind}:${id}`
}

export type MtdSpan = {
  monthKey: string
  /** End of the selected review week, clamped to the review month. */
  throughDate: string
  priorMonthKey: string
  priorMonthLabel: string
  /** Working days from the 1st through `throughDate`. */
  workingDayCount: number
  /**
   * Last calendar day of the prior span: the working day at the same index.
   * Null when this window has no working days, or last month has none.
   */
  priorThroughDate: string | null
}

function monthEnd(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${monthKey}-${String(last).padStart(2, '0')}`
}

/** Monday–Friday in the month, excluding Hong Kong public holidays. */
export function workingDaysOfMonth(monthKey: string): string[] {
  const dates: string[] = []
  const cursor = new Date(`${monthKey}-01T12:00:00Z`)
  const end = new Date(`${monthEnd(monthKey)}T12:00:00Z`)
  while (cursor.getTime() <= end.getTime()) {
    const date = cursor.toISOString().slice(0, 10)
    if (isWorkingDay(date)) dates.push(date)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function revenueByDate(items: LineItem[], monthKey: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of items) {
    if (!row.date || monthKeyFromDate(row.date) !== monthKey) continue
    map.set(row.date, (map.get(row.date) ?? 0) + (row.totalAmount || 0))
  }
  return map
}

/**
 * Review-month working days, same cutoff as `monthDaily` (through the last day with sales),
 * with last month’s revenue on the same working-day index.
 * Index 1 is the first working day of each month, not the same calendar date.
 */
export function monthDailyComparison(items: LineItem[], monthKey: string): MonthDayComparison {
  const priorMonthKey = previousMonthKey(monthKey)
  const current = monthDaily(items, monthKey)
  const priorRevenue = revenueByDate(items, priorMonthKey)
  const hasPrior = priorRevenue.size > 0
  const priorDates = hasPrior ? workingDaysOfMonth(priorMonthKey) : []
  return {
    priorMonthKey,
    priorMonthLabel: formatMonthLabel(priorMonthKey),
    hasPrior,
    points: current.map((day, index) => {
      const priorDate = priorDates[index] ?? null
      return {
        index: index + 1,
        date: day.date,
        label: day.date.slice(5),
        revenue: day.revenue,
        priorDate,
        priorLabel: priorDate ? priorDate.slice(5) : null,
        priorRevenue: priorDate == null ? null : (priorRevenue.get(priorDate) ?? 0),
      }
    }),
  }
}

function rankedEntries(totals: Map<string, number>, limit: number): [string, number][] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
}

/**
 * Month-to-date window for the selected review week, and the prior month’s
 * matching span. This period runs from the 1st through `throughDate` (the week’s
 * end). Last month ends on the working day with the same index, not the same
 * calendar date.
 */
export function mtdComparisonSpan(monthKey: string, throughDate: string): MtdSpan {
  const monthStart = `${monthKey}-01`
  const monthLast = monthEnd(monthKey)
  const through = throughDate < monthStart ? monthStart : throughDate > monthLast ? monthLast : throughDate
  const currentDays = workingDaysOfMonth(monthKey).filter((date) => date <= through)
  const priorMonthKey = previousMonthKey(monthKey)
  const priorDays = workingDaysOfMonth(priorMonthKey)
  const priorThroughDate =
    currentDays.length === 0 ? null : (priorDays[currentDays.length - 1] ?? priorDays[priorDays.length - 1] ?? null)
  return {
    monthKey,
    throughDate: through,
    priorMonthKey,
    priorMonthLabel: formatMonthLabel(priorMonthKey),
    workingDayCount: currentDays.length,
    priorThroughDate,
  }
}

export type CustomerMomBar = {
  name: string
  current: number
  /** Null when last month has no loaded lines. Zero means the span had no sales. */
  prior: number | null
}

export type CustomerMom = {
  span: MtdSpan
  hasPrior: boolean
  bars: CustomerMomBar[]
}

function inMonthThrough(date: string, monthKey: string, throughDate: string): boolean {
  return monthKeyFromDate(date) === monthKey && date <= throughDate
}

/**
 * Top customers for the review-month MTD window, each with last month’s sell-out
 * on the matching working-day span. `items` should already follow salesperson,
 * department, and search.
 */
export function customerWorkingDayMom(
  items: LineItem[],
  monthKey: string,
  throughDate: string,
  limit = 10,
): CustomerMom {
  const span = mtdComparisonSpan(monthKey, throughDate)
  const hasPrior = items.some(
    (row) => row.date != null && monthKeyFromDate(row.date) === span.priorMonthKey,
  )
  const currentTotals = new Map<string, number>()
  const priorTotals = new Map<string, number>()
  for (const row of items) {
    if (!row.date || !row.customer) continue
    const amount = row.totalAmount || 0
    if (inMonthThrough(row.date, monthKey, span.throughDate)) {
      currentTotals.set(row.customer, (currentTotals.get(row.customer) ?? 0) + amount)
    }
    if (span.priorThroughDate && inMonthThrough(row.date, span.priorMonthKey, span.priorThroughDate)) {
      priorTotals.set(row.customer, (priorTotals.get(row.customer) ?? 0) + amount)
    }
  }
  const bars = rankedEntries(currentTotals, limit).map(([name, current]) => ({
    name,
    current,
    prior: hasPrior ? (priorTotals.get(name) ?? 0) : null,
  }))
  return { span, hasPrior, bars }
}

/**
 * Top product models by quantity, split by salesperson, for the review-month
 * MTD window (the 1st through `throughDate`).
 * Model identity matches the existing chart: product model, or SKU when the model is empty.
 */
export function modelRepStacks(
  items: LineItem[],
  monthKey: string,
  throughDate: string,
  limit = 10,
): { series: StackSeries[]; bars: StackBar[] } {
  const through = mtdComparisonSpan(monthKey, throughDate).throughDate
  const totals = new Map<string, { quantity: number; revenue: number }>()
  const byRep = new Map<string, Map<string, { quantity: number; revenue: number }>>()
  for (const row of items) {
    if (!row.date || !inMonthThrough(row.date, monthKey, through)) continue
    const model = row.productModel || row.sku
    if (!model) continue
    const rep = row.salesperson || 'Unassigned'
    const quantity = row.quantity || 0
    const revenue = row.totalAmount || 0
    const total = totals.get(model) ?? { quantity: 0, revenue: 0 }
    total.quantity += quantity
    total.revenue += revenue
    totals.set(model, total)
    let reps = byRep.get(model)
    if (!reps) {
      reps = new Map()
      byRep.set(model, reps)
    }
    const current = reps.get(rep) ?? { quantity: 0, revenue: 0 }
    current.quantity += quantity
    current.revenue += revenue
    reps.set(rep, current)
  }
  const ranked = [...totals.entries()]
    .sort(
      (a, b) => b[1].quantity - a[1].quantity || b[1].revenue - a[1].revenue || a[0].localeCompare(b[0]),
    )
    .slice(0, limit)
  const repTotals = new Map<string, number>()
  const bars = ranked.map(([name, total]) => {
    const segments: Record<string, number> = {}
    for (const [rep, amount] of byRep.get(name) ?? []) {
      if (amount.quantity === 0) continue
      segments[rep] = amount.quantity
      repTotals.set(rep, (repTotals.get(rep) ?? 0) + amount.quantity)
    }
    return { name, total: total.quantity, segments }
  })
  const series = [...repTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => ({ key: name, label: shortName(name) }))
  return { series, bars }
}

/** Pie order first, then any rep who is not on the sell-out list. */
export function orderSeriesLikeShares(
  series: StackSeries[],
  shares: { name: string }[],
): StackSeries[] {
  const rank = new Map(shares.map((share, index) => [share.name, index]))
  return [...series].sort((a, b) => {
    const aRank = rank.get(a.key) ?? rank.size + 1
    const bRank = rank.get(b.key) ?? rank.size + 1
    if (aRank !== bRank) return aRank - bRank
    return a.label.localeCompare(b.label)
  })
}
