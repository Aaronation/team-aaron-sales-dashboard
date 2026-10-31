import { isWorkingDay } from './hkHolidays'
import type { Filters, LineItem, Targets } from './types'

/** 2026 team sell-out targets (HKD), from Aaron’s monthly target sheet. */
export const MONTHLY_TEAM_TARGETS: Record<string, number> = {
  '2026-01': 2_800_000,
  '2026-02': 2_200_000,
  '2026-03': 2_700_000,
  '2026-04': 2_900_000,
  '2026-05': 2_800_000,
  '2026-06': 3_000_000,
  '2026-07': 3_500_000,
  '2026-08': 3_500_000,
  '2026-09': 3_300_000,
  '2026-10': 3_300_000,
  '2026-11': 3_200_000,
  '2026-12': 3_400_000,
}

export const DEFAULT_SPLITS: Record<string, number> = {
  'Aaron Chang': 0.49,
  'Kelvin Lai': 0.31,
  'Kenny Ma': 0.2,
}

/** ISO week key: 2026-W41 */
export function isoWeekKey(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function parseWeekKey(weekKey: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey)
  if (!m) return null
  return { year: Number(m[1]), week: Number(m[2]) }
}

export function weekDateRange(weekKey: string): { start: string; end: string } | null {
  const p = parseWeekKey(weekKey)
  if (!p) return null
  const jan4 = new Date(Date.UTC(p.year, 0, 4))
  const day = jan4.getUTCDay() || 7
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - day + 1)
  const start = new Date(week1Mon)
  start.setUTCDate(week1Mon.getUTCDate() + (p.week - 1) * 7)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function monthEndIso(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${monthKey}-${String(last).padStart(2, '0')}`
}

export type ReviewWindow = {
  range: { start: string; end: string }
  /** Month of the week's Thursday. A Mon–Sun week that ends on the 1st stays in the month that holds Mon–Thu. */
  monthKey: string
  /** Week end, clamped to the last day of `monthKey`. */
  throughDate: string
}

/**
 * Review month and MTD cutoff for a week.
 * ISO weeks are named by Thursday, so 2026-W44 (10-26 → 11-01) is still October.
 * Using Sunday 11-01 as the month made MTD and the monthly charts look at an empty November.
 */
export function reviewWindow(weekKey: string): ReviewWindow | null {
  const range = weekDateRange(weekKey)
  if (!range) return null
  const thursday = new Date(range.start + 'T12:00:00Z')
  thursday.setUTCDate(thursday.getUTCDate() + 3)
  const monthKey = thursday.toISOString().slice(0, 7)
  const monthLast = monthEndIso(monthKey)
  return {
    range,
    monthKey,
    throughDate: range.end > monthLast ? monthLast : range.end,
  }
}

/** Shift a calendar date by N months, clamping day (e.g. Mar 31 → Feb 28). */
export function addMonthsClamped(isoDate: string, deltaMonths: number): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + deltaMonths)
  const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, maxDay))
  return d.toISOString().slice(0, 10)
}

/**
 * MoM “same period”: selected range shifted back one calendar month.
 * e.g. 2026-10-05→10-11 → 2026-09-05→09-11 (not the previous ISO week).
 */
export function samePeriodLastMonth(range: {
  start: string
  end: string
}): { start: string; end: string } {
  return {
    start: addMonthsClamped(range.start, -1),
    end: addMonthsClamped(range.end, -1),
  }
}

export function formatRangeLabel(range: { start: string; end: string }): string {
  return `${range.start.slice(5)} → ${range.end.slice(5)}`
}

export function monthKeyFromDate(iso: string): string {
  return iso.slice(0, 7)
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const name = MONTH_SHORT[Number(month) - 1]
  if (!year || !name) return monthKey
  return `${name} ${year}`
}

export function listWeekKeys(items: LineItem[]): string[] {
  const set = new Set<string>()
  for (const r of items) {
    if (r.date) set.add(isoWeekKey(r.date))
  }
  return [...set].sort()
}

function matchesDimFilters(row: LineItem, f: Filters): boolean {
  if (f.salesperson !== 'all' && row.salesperson !== f.salesperson) return false
  if (f.department !== 'all' && row.department !== f.department) return false
  const q = f.query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    row.invoice,
    row.customer,
    row.tradingPartner,
    row.sku,
    row.productModel,
    row.productName,
    row.salesperson,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export function filterItems(items: LineItem[], f: Filters): LineItem[] {
  return items.filter((row) => {
    if (!row.date) return false
    if (f.weekKey !== 'all' && isoWeekKey(row.date) !== f.weekKey) return false
    return matchesDimFilters(row, f)
  })
}

/** Salesperson, department, and search only — not the review week. */
export function filterIgnoringWeek(items: LineItem[], f: Filters): LineItem[] {
  return items.filter((row) => matchesDimFilters(row, f))
}

export type MonthTotal = {
  monthKey: string
  label: string
  revenue: number
  quantity: number
  invoices: number
  customers: number
  /** Sell-out ÷ units for the lines in this month. Null when units are zero. */
  asp: number | null
}

export function monthlyTotals(items: LineItem[]): MonthTotal[] {
  const map = new Map<
    string,
    Omit<MonthTotal, 'invoices' | 'customers' | 'asp'> & {
      customerSet: Set<string>
      invoiceSet: Set<string>
    }
  >()
  for (const row of items) {
    if (!row.date) continue
    const monthKey = monthKeyFromDate(row.date)
    let cur = map.get(monthKey)
    if (!cur) {
      cur = {
        monthKey,
        label: formatMonthLabel(monthKey),
        revenue: 0,
        quantity: 0,
        customerSet: new Set(),
        invoiceSet: new Set(),
      }
      map.set(monthKey, cur)
    }
    cur.revenue += row.totalAmount || 0
    cur.quantity += row.quantity || 0
    if (row.invoice) cur.invoiceSet.add(row.invoice)
    if (row.customer) cur.customerSet.add(row.customer)
  }
  return [...map.values()]
    .map(({ customerSet, invoiceSet, ...rest }) => ({
      ...rest,
      customers: customerSet.size,
      invoices: invoiceSet.size,
      asp: averageSellingPrice(rest.revenue, rest.quantity),
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
}

export type MonthlyRepAsp = {
  /** Aaron, Kelvin, Kenny, then any other salesperson who has lines. */
  reps: string[]
  /** Calendar month → salesperson → ASP. Missing lines are null. */
  byMonth: Map<string, Map<string, number | null>>
  /** Salesperson → ASP across every line passed in. */
  totals: Map<string, number | null>
}

/** Per-rep ASP for the same lines that feed the monthly metrics table. */
export function monthlyRepAsp(items: LineItem[]): MonthlyRepAsp {
  const byMonthRaw = new Map<string, Map<string, { revenue: number; quantity: number }>>()
  const totalRaw = new Map<string, { revenue: number; quantity: number }>()
  const seen = new Set<string>()

  for (const row of items) {
    if (!row.date) continue
    const name = row.salesperson || 'Unassigned'
    seen.add(name)
    const monthKey = monthKeyFromDate(row.date)
    let month = byMonthRaw.get(monthKey)
    if (!month) {
      month = new Map()
      byMonthRaw.set(monthKey, month)
    }
    const cell = month.get(name) ?? { revenue: 0, quantity: 0 }
    cell.revenue += row.totalAmount || 0
    cell.quantity += row.quantity || 0
    month.set(name, cell)
    const all = totalRaw.get(name) ?? { revenue: 0, quantity: 0 }
    all.revenue += row.totalAmount || 0
    all.quantity += row.quantity || 0
    totalRaw.set(name, all)
  }

  const extras = [...seen]
    .filter((name) => DEFAULT_SPLITS[name] == null)
    .sort((a, b) => a.localeCompare(b))
  const reps = [...Object.keys(DEFAULT_SPLITS), ...extras]
  const byMonth = new Map<string, Map<string, number | null>>()
  for (const [monthKey, month] of byMonthRaw) {
    const aspByRep = new Map<string, number | null>()
    for (const name of reps) {
      const cell = month.get(name)
      aspByRep.set(name, cell ? averageSellingPrice(cell.revenue, cell.quantity) : null)
    }
    byMonth.set(monthKey, aspByRep)
  }
  const totals = new Map<string, number | null>()
  for (const name of reps) {
    const cell = totalRaw.get(name)
    totals.set(name, cell ? averageSellingPrice(cell.revenue, cell.quantity) : null)
  }
  return { reps, byMonth, totals }
}

export type SellOutShare = {
  name: string
  revenue: number
  quantity: number
  lines: number
  /** Fraction of net sell-out (line totalAmount) in the set. */
  share: number
}

/** Each salesperson’s share of sell-out. Sell-out is the line total (HKD). */
export function sellOutShares(items: LineItem[]): SellOutShare[] {
  const grouped = groupBy(items, (row) => row.salesperson || 'Unassigned')
  const total = grouped.reduce((sum, row) => sum + row.revenue, 0)
  return grouped.map((row) => ({
    name: row.name,
    revenue: row.revenue,
    quantity: row.quantity,
    lines: row.lines,
    share: total !== 0 ? row.revenue / total : 0,
  }))
}

export type RepMonthFigure = {
  monthKey: string
  label: string
  revenue: number
  target: number | null
  achieve: number | null
}

export type RepAchievement = {
  name: string
  hasSplit: boolean
  months: RepMonthFigure[]
}

/** Per-rep monthly target: team month target × DEFAULT_SPLITS. Null when either is missing. */
export function repMonthTarget(name: string, monthKey: string): number | null {
  const team = MONTHLY_TEAM_TARGETS[monthKey]
  const split = DEFAULT_SPLITS[name]
  if (team == null || split == null) return null
  return team * split
}

/**
 * Sell-out, derived target, and achieve rate per salesperson and calendar month.
 * Split reps stay in DEFAULT_SPLITS order even at zero revenue. Other reps follow
 * by total revenue and have a null target (shown as —).
 */
export function repMonthAchievements(items: LineItem[]): RepAchievement[] {
  const revenue = new Map<string, Map<string, number>>()
  const monthKeys = new Set<string>()
  for (const row of items) {
    if (!row.date) continue
    const name = row.salesperson || 'Unassigned'
    const monthKey = monthKeyFromDate(row.date)
    monthKeys.add(monthKey)
    let byMonth = revenue.get(name)
    if (!byMonth) {
      byMonth = new Map()
      revenue.set(name, byMonth)
    }
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + (row.totalAmount || 0))
  }
  const months = [...monthKeys].sort()
  const extras = [...revenue.keys()]
    .filter((name) => DEFAULT_SPLITS[name] == null)
    .sort((a, b) => {
      const total = (rep: string) =>
        [...(revenue.get(rep)?.values() ?? [])].reduce((sum, amount) => sum + amount, 0)
      return total(b) - total(a) || a.localeCompare(b)
    })
  return [...Object.keys(DEFAULT_SPLITS), ...extras].map((name) => {
    const byMonth = revenue.get(name)
    return {
      name,
      hasSplit: DEFAULT_SPLITS[name] != null,
      months: months.map((monthKey) => {
        const monthRevenue = byMonth?.get(monthKey) ?? 0
        const target = repMonthTarget(name, monthKey)
        return {
          monthKey,
          label: formatMonthLabel(monthKey),
          revenue: monthRevenue,
          target,
          achieve: target != null && target > 0 ? monthRevenue / target : null,
        }
      }),
    }
  })
}

/** Inclusive calendar date range (used for MoM same-period baseline). */
export function filterByDateRange(
  items: LineItem[],
  f: Filters,
  start: string,
  end: string,
): LineItem[] {
  return items.filter((row) => {
    if (!row.date) return false
    if (row.date < start || row.date > end) return false
    return matchesDimFilters(row, f)
  })
}

/** Month-to-date items in the review month (the week's Thursday) through `reviewWindow().throughDate`. */
export function filterMtdThroughWeek(items: LineItem[], f: Filters, weekKey: string): LineItem[] {
  const window = reviewWindow(weekKey)
  if (!window) return []
  const q = f.query.trim().toLowerCase()
  return items.filter((row) => {
    if (!row.date) return false
    if (monthKeyFromDate(row.date) !== window.monthKey) return false
    if (row.date > window.throughDate) return false
    if (f.salesperson !== 'all' && row.salesperson !== f.salesperson) return false
    if (f.department !== 'all' && row.department !== f.department) return false
    if (!q) return true
    const hay = [row.invoice, row.customer, row.sku, row.productModel, row.productName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b),
  )
}

export function sumRevenue(items: LineItem[]): number {
  return items.reduce((s, r) => s + (r.totalAmount || 0), 0)
}

export function sumQty(items: LineItem[]): number {
  return items.reduce((s, r) => s + (r.quantity || 0), 0)
}

/** Tax-inclusive sell-out divided by units. Zero units is null, not zero. */
export function averageSellingPrice(revenue: number, quantity: number): number | null {
  if (!Number.isFinite(revenue) || !Number.isFinite(quantity) || quantity === 0) return null
  return revenue / quantity
}

/** ASP for a filtered line set: sum(totalAmount) / sum(quantity). */
export function asp(items: LineItem[]): number | null {
  return averageSellingPrice(sumRevenue(items), sumQty(items))
}

export function uniqueCustomers(items: LineItem[]): number {
  return new Set(items.map((r) => r.customer).filter(Boolean)).size
}

export function uniqueInvoices(items: LineItem[]): number {
  return new Set(items.map((row) => row.invoice).filter(Boolean)).size
}

/** Unique invoice count per group key (salesperson, and so on). */
export function invoiceCountsBy(
  items: LineItem[],
  keyFn: (row: LineItem) => string | null | undefined,
): Map<string, number> {
  const sets = new Map<string, Set<string>>()
  for (const row of items) {
    const key = keyFn(row)
    if (!key || !row.invoice) continue
    let invoices = sets.get(key)
    if (!invoices) {
      invoices = new Set()
      sets.set(key, invoices)
    }
    invoices.add(row.invoice)
  }
  return new Map([...sets].map(([key, invoices]) => [key, invoices.size]))
}

export type NamedTotal = {
  name: string
  revenue: number
  quantity: number
  lines: number
  asp: number | null
}

export function groupBy(
  items: LineItem[],
  keyFn: (r: LineItem) => string | null | undefined,
): NamedTotal[] {
  const map = new Map<string, Omit<NamedTotal, 'asp'>>()
  for (const r of items) {
    const k = keyFn(r)
    if (!k) continue
    const cur = map.get(k) ?? { name: k, revenue: 0, quantity: 0, lines: 0 }
    cur.revenue += r.totalAmount || 0
    cur.quantity += r.quantity || 0
    cur.lines += 1
    map.set(k, cur)
  }
  return [...map.values()]
    .map((row) => ({ ...row, asp: averageSellingPrice(row.revenue, row.quantity) }))
    .sort((a, b) => b.revenue - a.revenue)
}

export type NamedDelta = NamedTotal & {
  prevRevenue: number
  deltaPct: number | null
}

export function groupByWithPrior(
  current: LineItem[],
  previous: LineItem[],
  keyFn: (r: LineItem) => string | null | undefined,
): NamedDelta[] {
  const cur = groupBy(current, keyFn)
  const prevMap = new Map(groupBy(previous, keyFn).map((x) => [x.name, x]))
  return cur.map((c) => {
    const p = prevMap.get(c.name)
    const prevRevenue = p?.revenue ?? 0
    const deltaPct =
      prevRevenue > 0 ? (c.revenue - prevRevenue) / prevRevenue : c.revenue > 0 ? null : 0
    return { ...c, prevRevenue, deltaPct }
  })
}

export function dailyTrend(items: LineItem[]): { date: string; revenue: number; quantity: number }[] {
  const map = new Map<string, { date: string; revenue: number; quantity: number }>()
  for (const r of items) {
    if (!r.date) continue
    const cur = map.get(r.date) ?? { date: r.date, revenue: 0, quantity: 0 }
    cur.revenue += r.totalAmount || 0
    cur.quantity += r.quantity || 0
    map.set(r.date, cur)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Working days from the 1st of `monthKey` through the last day that has sales
 * in that month. A working day is Monday–Friday and not a Hong Kong public
 * holiday (`isWorkingDay`). Weekends and holidays are omitted. Working days
 * with no invoices are zero. Days after the data ends are omitted.
 */
export function monthDaily(
  items: LineItem[],
  monthKey: string,
): { date: string; revenue: number; quantity: number }[] {
  const present = dailyTrend(
    items.filter((row) => row.date != null && monthKeyFromDate(row.date) === monthKey),
  )
  if (present.length === 0) return []
  const byDay = new Map(present.map((day) => [day.date, day]))
  const last = present[present.length - 1].date
  const out: { date: string; revenue: number; quantity: number }[] = []
  const cursor = new Date(`${monthKey}-01T12:00:00Z`)
  const end = new Date(`${last}T12:00:00Z`)
  while (cursor.getTime() <= end.getTime()) {
    const date = cursor.toISOString().slice(0, 10)
    if (isWorkingDay(date)) {
      out.push(byDay.get(date) ?? { date, revenue: 0, quantity: 0 })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0
  return (current - previous) / previous
}

export function teamTargetForMonth(monthKey: string, targets?: Targets): number {
  if (monthKey !== 'all' && MONTHLY_TEAM_TARGETS[monthKey] != null) {
    return MONTHLY_TEAM_TARGETS[monthKey]
  }
  return targets?.annualTeamTarget ?? 3_500_000
}

/** Format amounts in HKD (user-confirmed currency). */
export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: 'HKD',
    maximumFractionDigits: 0,
  }).format(n)
}

/** Unit ASP in HKD with cents. Null (no units) is an em dash. */
export function formatAsp(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: 'HKD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(1)}%`
}

/** Display name for a salesperson. Filter values stay the full raw name. */
export function shortName(full: string): string {
  const trimmed = full.trim()
  if (!trimmed) return full
  return trimmed.split(/\s+/)[0] ?? trimmed
}

const CUSTOMER_SUFFIX =
  /(?:\s+(?:company\s+limited|co\.?,?\s*ltd\.?|limited|ltd\.?|company)|股份有限公司|有限公司)\s*$/i

/** Shorter customer label: trimmed, collapsed spaces, legal suffixes removed. */
export function displayCustomer(name: string): string {
  let text = name.trim().replace(/\s+/g, ' ')
  let previous = ''
  while (text && text !== previous) {
    previous = text
    text = text.replace(CUSTOMER_SUFFIX, '').trim()
  }
  text = text.replace(/股份有限公司|有限公司/g, ' ').replace(/\s+/g, ' ').trim()
  return text || name.trim()
}

export function tickLabel(name: string, max: number): string {
  const shown = displayCustomer(name)
  if (shown.length <= max) return shown
  return `${shown.slice(0, Math.max(1, max - 1))}…`
}

export function weekLabel(weekKey: string): string {
  const range = weekDateRange(weekKey)
  if (!range) return weekKey
  return `${weekKey} · ${range.start.slice(5)} → ${range.end.slice(5)}`
}
