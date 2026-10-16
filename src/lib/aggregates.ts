import type { Filters, LineItem, Targets } from './types'

export const MONTHLY_TEAM_TARGETS: Record<string, number> = {
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
  lines: number
  customers: number
}

export function monthlyTotals(items: LineItem[]): MonthTotal[] {
  const map = new Map<string, MonthTotal & { customerSet: Set<string> }>()
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
        lines: 0,
        customers: 0,
        customerSet: new Set(),
      }
      map.set(monthKey, cur)
    }
    cur.revenue += row.totalAmount || 0
    cur.quantity += row.quantity || 0
    cur.lines += 1
    if (row.customer) cur.customerSet.add(row.customer)
  }
  return [...map.values()]
    .map(({ customerSet, ...rest }) => ({ ...rest, customers: customerSet.size }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
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

/** Month-to-date items in the same calendar month as the week's Thursday (or end). */
export function filterMtdThroughWeek(items: LineItem[], f: Filters, weekKey: string): LineItem[] {
  const range = weekDateRange(weekKey)
  if (!range) return []
  const monthKey = monthKeyFromDate(range.end)
  const q = f.query.trim().toLowerCase()
  return items.filter((row) => {
    if (!row.date) return false
    if (monthKeyFromDate(row.date) !== monthKey) return false
    if (row.date > range.end) return false
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

export function uniqueCustomers(items: LineItem[]): number {
  return new Set(items.map((r) => r.customer).filter(Boolean)).size
}

export type NamedTotal = { name: string; revenue: number; quantity: number; lines: number }

export function groupBy(
  items: LineItem[],
  keyFn: (r: LineItem) => string | null | undefined,
): NamedTotal[] {
  const map = new Map<string, NamedTotal>()
  for (const r of items) {
    const k = keyFn(r)
    if (!k) continue
    const cur = map.get(k) ?? { name: k, revenue: 0, quantity: 0, lines: 0 }
    cur.revenue += r.totalAmount || 0
    cur.quantity += r.quantity || 0
    cur.lines += 1
    map.set(k, cur)
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
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

export function formatPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(1)}%`
}

export function shortName(full: string): string {
  return full.split(' ')[0] ?? full
}

export function weekLabel(weekKey: string): string {
  const range = weekDateRange(weekKey)
  if (!range) return weekKey
  return `${weekKey} · ${range.start.slice(5)} → ${range.end.slice(5)}`
}
