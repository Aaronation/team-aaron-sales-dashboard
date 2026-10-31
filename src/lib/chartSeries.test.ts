/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterMtdThroughWeek, monthDaily, monthKeyFromDate, reviewWindow, sumRevenue } from './aggregates'
import { mtdWorkingDays } from './hkHolidays'
import { AMBER, CLAY, CREAM, SAGE, TAUPE, customerWeekFill } from './palette'
import {
  customerWorkingDayMom,
  modelRepStacks,
  monthDailyComparison,
  mtdComparisonSpan,
  orderSeriesLikeShares,
  previousMonthKey,
  segmentKey,
  workingDaysOfMonth,
} from './chartSeries'
import type { LineItem, SalesPayload } from './types'

function line(
  date: string,
  totalAmount: number,
  extra: Partial<LineItem> = {},
): LineItem {
  return {
    source: 'test',
    invoice: extra.invoice ?? `INV-${date}-${totalAmount}`,
    tradingPartner: null,
    customer: extra.customer ?? 'ADDL',
    date,
    year: '2026',
    month: null,
    week: null,
    day: null,
    department: extra.department ?? 'Galaxy',
    salesperson: extra.salesperson ?? 'Aaron Chang',
    sku: extra.sku ?? 'SKU',
    productModel: extra.productModel === undefined ? 'MODEL' : extra.productModel,
    category: null,
    quantity: extra.quantity ?? 1,
    unitPrice: totalAmount,
    totalAmount,
    productName: null,
    customerCode: null,
  }
}

describe('working-day month comparison', () => {
  it('overlays the first working day of last month on the first working day of this month', () => {
    const items = [
      line('2026-10-02', 100),
      line('2026-10-06', 50),
      line('2026-09-01', 80, { customer: 'ADDL' }),
      line('2026-10-01', 999),
    ]
    const comparison = monthDailyComparison(items, '2026-10')

    expect(previousMonthKey('2026-10')).toBe('2026-09')
    expect(workingDaysOfMonth('2026-10')[0]).toBe('2026-10-02')
    expect(workingDaysOfMonth('2026-09')[0]).toBe('2026-09-01')
    expect(comparison.hasPrior).toBe(true)
    expect(comparison.priorMonthLabel).toBe('Sep 2026')
    expect(comparison.points.map((point) => point.date)).toEqual(['2026-10-02', '2026-10-05', '2026-10-06'])
    expect(comparison.points.map((point) => point.priorDate)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ])
    expect(comparison.points.map((point) => point.revenue)).toEqual([100, 0, 50])
    expect(comparison.points.map((point) => point.priorRevenue)).toEqual([80, 0, 0])
    expect(comparison.points[0]?.index).toBe(1)
  })

  it('leaves the last-month line empty when that month has no lines', () => {
    const comparison = monthDailyComparison([line('2026-08-03', 40)], '2026-08')
    expect(comparison.hasPrior).toBe(false)
    expect(comparison.priorMonthKey).toBe('2026-07')
    expect(comparison.points.length).toBeGreaterThan(0)
    expect(comparison.points.every((point) => point.priorRevenue == null)).toBe(true)
    expect(comparison.points.every((point) => point.priorDate == null)).toBe(true)
  })

  it('stops the prior line when last month has fewer working days', () => {
    const items = [line('2026-03-31', 10), line('2026-02-02', 5)]
    const comparison = monthDailyComparison(items, '2026-03')
    const last = comparison.points[comparison.points.length - 1]
    expect(last?.date).toBe('2026-03-31')
    expect(comparison.points.some((point) => point.priorDate == null)).toBe(true)
    expect(comparison.points.find((point) => point.priorDate == null)?.priorRevenue).toBeNull()
  })

  it('matches the seeded October axis and September’s first working day', () => {
    const payload = JSON.parse(readFileSync('public/data/sales-line-items.json', 'utf8')) as SalesPayload
    const comparison = monthDailyComparison(payload.lineItems, '2026-10')
    const current = monthDaily(payload.lineItems, '2026-10')
    expect(comparison.points.map((point) => point.date)).toEqual(current.map((day) => day.date))
    expect(comparison.points[0]).toMatchObject({
      date: '2026-10-02',
      priorDate: '2026-09-01',
      index: 1,
    })
    expect(comparison.points[0]?.revenue).toBeGreaterThan(0)
    expect(comparison.points[0]?.priorRevenue).toBeGreaterThan(0)
    const october = payload.lineItems.filter((row) => row.date && monthKeyFromDate(row.date) === '2026-10')
    const summed = comparison.points.reduce((sum, point) => sum + point.revenue, 0)
    const raw = october.reduce((sum, row) => sum + row.totalAmount, 0)
    expect(summed).toBeCloseTo(raw, 6)
  })
})

describe('customer working-day MoM and model reps', () => {
  it('compares each customer on the same working-day count, including days inside that span', () => {
    const items = [
      line('2026-10-03', 40, { customer: 'Harbour', invoice: 'sat' }),
      line('2026-10-16', 10, { customer: 'Harbour', invoice: 'fri' }),
      line('2026-10-19', 999, { customer: 'Harbour', invoice: 'after' }),
      line('2026-10-12', 100, { customer: 'Vision', invoice: 'vis' }),
      line('2026-09-01', 3, { customer: 'Harbour', invoice: 'sep1' }),
      line('2026-09-05', 7, { customer: 'Harbour', invoice: 'sep-sat' }),
      line('2026-09-16', 500, { customer: 'Harbour', invoice: 'sep-late' }),
    ]
    const mom = customerWorkingDayMom(items, '2026-10', '2026-10-18')
    expect(mom.span.workingDayCount).toBe(11)
    expect(mom.span.throughDate).toBe('2026-10-18')
    expect(mom.span.priorThroughDate).toBe('2026-09-15')
    expect(mom.hasPrior).toBe(true)
    expect(mom.bars.map((bar) => bar.name)).toEqual(['Vision', 'Harbour'])
    expect(mom.bars[0]).toMatchObject({ current: 100, prior: 0 })
    expect(mom.bars[1]).toMatchObject({ current: 50, prior: 10 })
    expect(mom.weeks.map((week) => week.label)).toEqual(['W40', 'W42'])
    expect(Object.values(mom.bars[1]?.weeks ?? {}).reduce((sum, amount) => sum + amount, 0)).toBe(50)
    expect(mom.bars[0]?.weeks[mom.weeks[1]?.key ?? '']).toBe(100)
    expect(segmentKey('week', mom.weeks[0]?.key ?? '')).toBe(`week:${mom.weeks[0]?.key}`)
    expect(customerWeekFill(0)).toBe(CREAM)
    expect(customerWeekFill(1)).toBe(SAGE)
    expect(customerWeekFill(2)).toBe(AMBER)
    expect(customerWeekFill(3)).toBe(CLAY)
    expect(customerWeekFill(4)).toBe(TAUPE)
  })

  it('shortens both charts when the selected week ends earlier in the month', () => {
    const items = [
      line('2026-10-06', 20, { customer: 'Harbour', invoice: 'early' }),
      line('2026-10-12', 80, { customer: 'Harbour', invoice: 'later' }),
      line('2026-09-01', 5, { customer: 'Harbour', invoice: 'sep' }),
      line('2026-09-09', 15, { customer: 'Harbour', invoice: 'sep-after-6' }),
    ]
    const early = customerWorkingDayMom(items, '2026-10', '2026-10-11')
    const later = customerWorkingDayMom(items, '2026-10', '2026-10-18')
    expect(early.span).toMatchObject({ workingDayCount: 6, priorThroughDate: '2026-09-08' })
    expect(early.weeks.map((week) => week.label)).toEqual(['W41'])
    expect(early.bars[0]).toMatchObject({ current: 20, prior: 5 })
    expect(later.weeks.map((week) => week.label)).toEqual(['W41', 'W42'])
    expect(later.bars[0]).toMatchObject({ current: 100, prior: 20 })
  })

  it('drops the last-month bar when that month has no lines, and follows the salesperson filter', () => {
    const items = [
      line('2026-08-03', 40, { customer: 'Harbour', salesperson: 'Aaron Chang', invoice: 'a' }),
      line('2026-08-04', 15, { customer: 'Vision', salesperson: 'Kelvin Lai', invoice: 'k' }),
    ]
    const all = customerWorkingDayMom(items, '2026-08', '2026-08-09')
    expect(all.hasPrior).toBe(false)
    expect(all.span.priorMonthKey).toBe('2026-07')
    expect(all.span.priorThroughDate).toBe('2026-07-08')
    expect(all.bars.every((bar) => bar.prior == null)).toBe(true)
    const kelvin = customerWorkingDayMom(
      items.filter((row) => row.salesperson === 'Kelvin Lai'),
      '2026-08',
      '2026-08-09',
    )
    expect(kelvin.bars.map((bar) => bar.name)).toEqual(['Vision'])
    expect(kelvin.bars[0]?.current).toBe(15)
  })

  it('stacks product models by salesperson quantity inside the MTD window', () => {
    const items = [
      line('2026-10-02', 20, { productModel: 'PX20', salesperson: 'Aaron Chang', quantity: 2, invoice: 'a' }),
      line('2026-10-05', 50, { productModel: 'PX20', salesperson: 'Kelvin Lai', quantity: 5, invoice: 'b' }),
      line('2026-10-06', 90, { productModel: 'LED1', salesperson: 'Aaron Chang', quantity: 9, invoice: 'c' }),
      line('2026-10-12', 40, { productModel: 'LED1', salesperson: 'Aaron Chang', quantity: 4, invoice: 'late' }),
      line('2026-10-06', 10, { productModel: null, sku: 'BARE', salesperson: 'Kenny Ma', quantity: 4, invoice: 'd' }),
    ]
    const early = modelRepStacks(items, '2026-10', '2026-10-11')
    expect(early.bars.map((bar) => bar.name)).toEqual(['LED1', 'PX20', 'BARE'])
    expect(early.bars[0]?.total).toBe(9)
    const full = modelRepStacks(items, '2026-10', '2026-10-18')
    expect(full.bars[0]).toMatchObject({ name: 'LED1', total: 13 })
    expect(full.bars.find((bar) => bar.name === 'PX20')?.segments['Aaron Chang']).toBe(2)
    expect(full.bars.find((bar) => bar.name === 'PX20')?.segments['Kelvin Lai']).toBe(5)
    expect(full.series.map((series) => series.label)).toEqual(['Aaron', 'Kelvin', 'Kenny'])

    const ordered = orderSeriesLikeShares(full.series, [
      { name: 'Kelvin Lai' },
      { name: 'Aaron Chang' },
      { name: 'Kenny Ma' },
    ])
    expect(ordered.map((series) => series.key)).toEqual(['Kelvin Lai', 'Aaron Chang', 'Kenny Ma'])
  })

  it('uses the seeded October MTD window for customers and reps', () => {
    const payload = JSON.parse(readFileSync('public/data/sales-line-items.json', 'utf8')) as SalesPayload
    const throughWeek = customerWorkingDayMom(payload.lineItems, '2026-10', '2026-10-18')
    const throughEarlier = customerWorkingDayMom(payload.lineItems, '2026-10', '2026-10-11')
    const models = modelRepStacks(payload.lineItems, '2026-10', '2026-10-18')
    const modelsEarlier = modelRepStacks(payload.lineItems, '2026-10', '2026-10-11')
    expect(mtdComparisonSpan('2026-10', '2026-10-18')).toMatchObject({
      workingDayCount: 11,
      priorThroughDate: '2026-09-15',
    })
    expect(throughWeek.weeks.map((week) => week.label)).toEqual(['W40', 'W41', 'W42'])
    expect(throughEarlier.weeks.map((week) => week.label)).toEqual(['W40', 'W41'])
    expect(throughWeek.bars).toHaveLength(10)
    expect(throughWeek.hasPrior).toBe(true)
    expect(throughWeek.bars.every((bar) => bar.prior != null && bar.current > 0)).toBe(true)
    for (const bar of throughWeek.bars) {
      const stacked = Object.values(bar.weeks).reduce((sum, amount) => sum + amount, 0)
      expect(stacked).toBeCloseTo(bar.current, 6)
    }
    const weekTotal = throughWeek.bars.reduce((sum, bar) => sum + bar.current, 0)
    const earlierTotal = throughEarlier.bars.reduce((sum, bar) => sum + bar.current, 0)
    expect(earlierTotal).toBeLessThan(weekTotal)
    const kelvin = customerWorkingDayMom(
      payload.lineItems.filter((row) => row.salesperson === 'Kelvin Lai'),
      '2026-10',
      '2026-10-18',
    )
    expect(kelvin.bars.length).toBeGreaterThan(0)
    expect(kelvin.bars.reduce((sum, bar) => sum + bar.current, 0)).toBeLessThan(weekTotal)
    expect(models.series.map((series) => series.label)).toEqual(['Aaron', 'Kelvin', 'Kenny'])
    expect(models.bars[0]?.name).not.toMatch(/Aaron|Kelvin|Kenny/)
    const modelQty = models.bars.reduce((sum, bar) => sum + bar.total, 0)
    const earlierQty = modelsEarlier.bars.reduce((sum, bar) => sum + bar.total, 0)
    expect(earlierQty).toBeLessThan(modelQty)
  })
})

describe('review week that ends in the next month', () => {
  const filters = { weekKey: '2026-W44', salesperson: 'all', department: 'all', query: '' }

  it('keeps 2026-W44 in October, with a non-zero MTD through the month end', () => {
    const window = reviewWindow('2026-W44')
    expect(window).toMatchObject({
      range: { start: '2026-10-26', end: '2026-11-01' },
      monthKey: '2026-10',
      throughDate: '2026-10-31',
    })
    expect(reviewWindow('2026-W43')).toMatchObject({
      monthKey: '2026-10',
      throughDate: '2026-10-25',
    })
    expect(reviewWindow('2026-W42')).toMatchObject({
      monthKey: '2026-10',
      throughDate: '2026-10-18',
    })

    const covered = mtdWorkingDays('2026-10', window!.throughDate, [window!.throughDate])
    expect(covered.elapsed).toBe(20)
    expect(covered.total).toBe(20)
    expect(mtdWorkingDays('2026-11', '2026-11-01', ['2026-11-01']).elapsed).toBe(0)

    const items = [
      line('2026-10-13', 400, { invoice: 'early' }),
      line('2026-10-20', 800, { invoice: 'mid', customer: 'Vision' }),
      line('2026-10-27', 1600, { invoice: 'late', customer: 'Wonderland' }),
      line('2026-11-01', 50, { invoice: 'sunday', customer: 'ADDL' }),
    ]
    const throughW44 = filterMtdThroughWeek(items, filters, '2026-W44')
    expect(throughW44.map((row) => row.invoice)).toEqual(['early', 'mid', 'late'])
    expect(sumRevenue(throughW44)).toBe(2800)

    const throughW43 = filterMtdThroughWeek(items, { ...filters, weekKey: '2026-W43' }, '2026-W43')
    expect(throughW43.map((row) => row.invoice)).toEqual(['early', 'mid'])
    expect(sumRevenue(throughW43)).toBe(1200)
    const throughW43Days = mtdWorkingDays(
      '2026-10',
      '2026-10-25',
      items.map((row) => row.date),
    )
    expect(throughW43Days.elapsed).toBe(15)
    expect(throughW43Days.through).toBe('2026-10-25')
    const throughW44Days = mtdWorkingDays(
      '2026-10',
      window!.throughDate,
      items.map((row) => row.date),
    )
    expect(throughW44Days).toMatchObject({ elapsed: 17, total: 20, through: '2026-10-27' })

    const october = customerWorkingDayMom(throughW44, '2026-10', '2026-10-31')
    expect(october.bars.map((bar) => bar.name)).toEqual(['Wonderland', 'Vision', 'ADDL'])
    expect(october.span.workingDayCount).toBe(20)
    expect(modelRepStacks(throughW44, '2026-10', '2026-10-31').bars.length).toBeGreaterThan(0)
  })

  it('caps seeded W42 elapsed days at the latest October entry', () => {
    const payload = JSON.parse(readFileSync('public/data/sales-line-items.json', 'utf8')) as SalesPayload
    const window = reviewWindow('2026-W42')
    expect(window?.throughDate).toBe('2026-10-18')
    const rows = filterMtdThroughWeek(
      payload.lineItems,
      { weekKey: '2026-W42', salesperson: 'all', department: 'all', query: '' },
      '2026-W42',
    )
    expect(
      mtdWorkingDays(
        '2026-10',
        window!.throughDate,
        payload.lineItems.map((row) => row.date),
      ),
    ).toMatchObject({ elapsed: 7, total: 20, through: '2026-10-12' })
    expect(Math.round(sumRevenue(rows))).toBe(725442)
  })
})
