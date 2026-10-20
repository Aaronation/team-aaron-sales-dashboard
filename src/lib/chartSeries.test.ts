/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isoWeekKey, monthDaily, monthKeyFromDate } from './aggregates'
import {
  customerWeekStacks,
  modelRepStacks,
  monthDailyComparison,
  orderSeriesLikeShares,
  previousMonthKey,
  segmentKey,
  weekTick,
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

describe('customer weeks and model reps', () => {
  it('stacks a customer by ISO week and keeps the top customers', () => {
    const early = '2026-10-02'
    const later = '2026-10-06'
    const items = [
      line(early, 10, { customer: 'Harbour', invoice: 'a' }),
      line(later, 30, { customer: 'Harbour', invoice: 'b' }),
      line(early, 100, { customer: 'Vision', invoice: 'c' }),
      line('2026-09-01', 500, { customer: 'Vision', invoice: 'old' }),
    ]
    const stacks = customerWeekStacks(items, '2026-10', 10)
    expect(stacks.bars.map((bar) => bar.name)).toEqual(['Vision', 'Harbour'])
    expect(stacks.bars[0]).toMatchObject({ total: 100 })
    expect(stacks.bars[1]?.total).toBe(40)
    const earlyWeek = isoWeekKey(early)
    const laterWeek = isoWeekKey(later)
    expect(stacks.series.map((series) => series.key)).toEqual([earlyWeek, laterWeek].sort())
    expect(stacks.series.map((series) => series.label)).toEqual(
      [earlyWeek, laterWeek].sort().map((week) => weekTick(week)),
    )
    expect(stacks.bars[1]?.segments[earlyWeek]).toBe(10)
    expect(stacks.bars[1]?.segments[laterWeek]).toBe(30)
    expect(segmentKey('week', earlyWeek)).toBe(`week:${earlyWeek}`)
  })

  it('stacks product models by salesperson quantity', () => {
    const items = [
      line('2026-10-02', 20, { productModel: 'PX20', salesperson: 'Aaron Chang', quantity: 2, invoice: 'a' }),
      line('2026-10-05', 50, { productModel: 'PX20', salesperson: 'Kelvin Lai', quantity: 5, invoice: 'b' }),
      line('2026-10-06', 90, { productModel: 'LED1', salesperson: 'Aaron Chang', quantity: 9, invoice: 'c' }),
      line('2026-10-06', 10, { productModel: null, sku: 'BARE', salesperson: 'Kenny Ma', quantity: 4, invoice: 'd' }),
    ]
    const stacks = modelRepStacks(items, '2026-10')
    expect(stacks.bars.map((bar) => bar.name)).toEqual(['LED1', 'PX20', 'BARE'])
    expect(stacks.bars[1]?.total).toBe(7)
    expect(stacks.bars[1]?.segments['Aaron Chang']).toBe(2)
    expect(stacks.bars[1]?.segments['Kelvin Lai']).toBe(5)
    expect(stacks.series.map((series) => series.label)).toEqual(['Aaron', 'Kelvin', 'Kenny'])

    const ordered = orderSeriesLikeShares(stacks.series, [
      { name: 'Kelvin Lai' },
      { name: 'Aaron Chang' },
      { name: 'Kenny Ma' },
    ])
    expect(ordered.map((series) => series.key)).toEqual(['Kelvin Lai', 'Aaron Chang', 'Kenny Ma'])
  })

  it('uses the seeded October weeks and reps for the visible stacks', () => {
    const payload = JSON.parse(readFileSync('public/data/sales-line-items.json', 'utf8')) as SalesPayload
    const customers = customerWeekStacks(payload.lineItems, '2026-10')
    const models = modelRepStacks(payload.lineItems, '2026-10')
    expect(customers.bars).toHaveLength(10)
    expect(customers.series.map((series) => series.label)).toEqual(['W40', 'W41', 'W42'])
    for (const bar of customers.bars) {
      const stacked = Object.values(bar.segments).reduce((sum, amount) => sum + amount, 0)
      expect(stacked).toBeCloseTo(bar.total, 6)
    }
    expect(models.series.map((series) => series.label)).toEqual(['Aaron', 'Kelvin', 'Kenny'])
    expect(models.bars[0]?.name).not.toMatch(/Aaron|Kelvin|Kenny/)
  })
})
