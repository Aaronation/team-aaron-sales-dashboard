/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  asp,
  averageSellingPrice,
  filterIgnoringWeek,
  filterItems,
  filterMtdThroughWeek,
  formatAsp,
  monthlyRepAsp,
  monthlyTotals,
  sumQty,
  sumRevenue,
} from './aggregates'
import type { LineItem } from './types'

function line(
  totalAmount: number,
  quantity: number,
  extra: Partial<LineItem> = {},
): LineItem {
  return {
    source: 'test',
    invoice: extra.invoice ?? 'INV',
    tradingPartner: null,
    customer: extra.customer ?? 'ADDL',
    date: extra.date ?? '2026-10-12',
    year: '2026',
    month: 'October',
    week: 42,
    day: 'Monday',
    department: extra.department ?? 'Galaxy',
    salesperson: extra.salesperson ?? 'Aaron Chang',
    sku: extra.sku ?? 'SKU',
    productModel: null,
    category: null,
    quantity,
    unitPrice: quantity === 0 ? 0 : totalAmount / quantity,
    totalAmount,
    productName: null,
    customerCode: null,
  }
}

describe('average selling price', () => {
  it('divides tax-inclusive sell-out by quantity', () => {
    const items = [line(1000, 2), line(500, 1, { invoice: 'B' })]
    expect(sumRevenue(items)).toBe(1500)
    expect(sumQty(items)).toBe(3)
    expect(asp(items)).toBe(500)
    expect(averageSellingPrice(1500, 3)).toBe(500)
    expect(formatAsp(asp(items))).toBe('HK$500')
  })

  it('returns null when quantity sums to zero', () => {
    expect(averageSellingPrice(80, 0)).toBeNull()
    expect(asp([line(80, 0)])).toBeNull()
    expect(asp([])).toBeNull()
    expect(formatAsp(null)).toBe('—')
    expect(formatAsp(Number.NaN)).toBe('—')
  })

  it('ignores a zero-qty line in the denominator and keeps its sell-out in the numerator', () => {
    const items = [line(100, 2), line(50, 0, { invoice: 'Z' })]
    expect(asp(items)).toBe(75)
    expect(formatAsp(75)).toBe('HK$75')
    expect(formatAsp(113.65)).toBe('HK$114')
    expect(formatAsp(99.5)).toBe('HK$100')
    expect(formatAsp(106.72)).toBe('HK$107')
  })

  it('keeps a negative unit total when returns exceed sales', () => {
    expect(asp([line(100, -4)])).toBe(-25)
    expect(formatAsp(-25)).toBe('-HK$25')
  })

  it('follows the same week and salesperson filters as revenue', () => {
    const items = [
      line(200, 2, { date: '2026-10-12', salesperson: 'Aaron Chang', invoice: 'A' }),
      line(900, 3, { date: '2026-10-13', salesperson: 'Kelvin Lai', invoice: 'K' }),
      line(50, 1, { date: '2026-10-20', salesperson: 'Aaron Chang', invoice: 'L' }),
    ]
    const week = filterItems(items, {
      weekKey: '2026-W42',
      salesperson: 'all',
      department: 'all',
      query: '',
    })
    const aaron = filterItems(items, {
      weekKey: '2026-W42',
      salesperson: 'Aaron Chang',
      department: 'all',
      query: '',
    })
    expect(asp(week)).toBe(1100 / 5)
    expect(asp(aaron)).toBe(100)
    expect(asp(week.filter((row) => row.salesperson === 'Kelvin Lai'))).toBe(300)
  })

  it('puts team ASP on each month and uses sell-out ÷ units for the all-months total', () => {
    const items = [
      line(100, 2, { date: '2026-10-02', salesperson: 'Aaron Chang', invoice: 'a' }),
      line(300, 1, { date: '2026-10-03', salesperson: 'Kelvin Lai', invoice: 'k' }),
      line(50, 0, { date: '2026-09-04', salesperson: 'Aaron Chang', invoice: 'z' }),
    ]
    const months = monthlyTotals(items)
    const october = months.find((month) => month.monthKey === '2026-10')
    const september = months.find((month) => month.monthKey === '2026-09')
    expect(october).toMatchObject({ revenue: 400, quantity: 3, asp: 400 / 3 })
    expect(formatAsp(october?.asp ?? null)).toBe('HK$133')
    expect(september).toMatchObject({ revenue: 50, quantity: 0, asp: null })
    expect(formatAsp(september?.asp ?? null)).toBe('—')

    const grandRevenue = months.reduce((sum, month) => sum + month.revenue, 0)
    const grandQty = months.reduce((sum, month) => sum + month.quantity, 0)
    expect(averageSellingPrice(grandRevenue, grandQty)).toBe(150)
    expect(formatAsp(averageSellingPrice(grandRevenue, grandQty))).toBe('HK$150')

    const reps = monthlyRepAsp(items)
    expect(reps.reps.slice(0, 3)).toEqual(['Aaron Chang', 'Kelvin Lai', 'Kenny Ma'])
    expect(reps.byMonth.get('2026-10')?.get('Aaron Chang')).toBe(50)
    expect(reps.byMonth.get('2026-10')?.get('Kelvin Lai')).toBe(300)
    expect(reps.byMonth.get('2026-10')?.get('Kenny Ma')).toBeNull()
    expect(reps.byMonth.get('2026-09')?.get('Aaron Chang')).toBeNull()
    expect(reps.totals.get('Aaron Chang')).toBe(75)
    expect(reps.totals.get('Kelvin Lai')).toBe(300)
    expect(reps.totals.get('Kenny Ma')).toBeNull()
    expect(formatAsp(reps.byMonth.get('2026-10')?.get('Kelvin Lai') ?? null)).toBe('HK$300')
  })
})

describe('seed ASP', () => {
  const payload = JSON.parse(
    readFileSync(new URL('../../public/data/sales-line-items.json', import.meta.url), 'utf8'),
  ) as { lineItems: LineItem[] }
  const filters = { weekKey: '2026-W42', salesperson: 'all', department: 'all', query: '' }

  it('locks seed week 2026-W42 team, Aaron, and Kelvin ASP', () => {
    const week = filterItems(payload.lineItems, filters)
    const mtd = filterMtdThroughWeek(payload.lineItems, filters, '2026-W42')
    const aaronWeek = filterItems(payload.lineItems, { ...filters, salesperson: 'Aaron Chang' })
    const kelvinWeek = filterItems(payload.lineItems, { ...filters, salesperson: 'Kelvin Lai' })
    const aaronMtd = filterMtdThroughWeek(
      payload.lineItems,
      { ...filters, salesperson: 'Aaron Chang' },
      '2026-W42',
    )
    const kelvinMtd = filterMtdThroughWeek(
      payload.lineItems,
      { ...filters, salesperson: 'Kelvin Lai' },
      '2026-W42',
    )
    expect(sumQty(week)).toBeGreaterThan(0)
    expect(asp(week)).toBe(sumRevenue(week) / sumQty(week))
    expect(asp(mtd)).toBe(sumRevenue(mtd) / sumQty(mtd))
    expect({
      teamWeek: formatAsp(asp(week)),
      teamMtd: formatAsp(asp(mtd)),
      aaronWeek: formatAsp(asp(aaronWeek)),
      kelvinWeek: formatAsp(asp(kelvinWeek)),
      aaronMtd: formatAsp(asp(aaronMtd)),
      kelvinMtd: formatAsp(asp(kelvinMtd)),
    }).toEqual({
      teamWeek: 'HK$107',
      teamMtd: 'HK$114',
      aaronWeek: 'HK$97',
      kelvinWeek: 'HK$162',
      aaronMtd: 'HK$94',
      kelvinMtd: 'HK$159',
    })
  })

  it('locks seed monthly metrics ASP for the team and each rep', () => {
    const items = filterIgnoringWeek(payload.lineItems, {
      weekKey: 'all',
      salesperson: 'all',
      department: 'all',
      query: '',
    })
    const months = monthlyTotals(items)
    const reps = monthlyRepAsp(items)
    const grandRevenue = months.reduce((sum, month) => sum + month.revenue, 0)
    const grandQty = months.reduce((sum, month) => sum + month.quantity, 0)
    const october = months.find((month) => month.monthKey === '2026-10')
    expect(formatAsp(october?.asp ?? null)).toBe('HK$114')
    const aaronMonths = monthlyTotals(
      filterIgnoringWeek(payload.lineItems, { ...filters, salesperson: 'Aaron Chang' }),
    )
    expect(formatAsp(aaronMonths.find((month) => month.monthKey === '2026-10')?.asp ?? null)).toBe(
      'HK$94',
    )
    expect(formatAsp(reps.byMonth.get('2026-10')?.get('Aaron Chang') ?? null)).toBe('HK$94')
    expect(formatAsp(reps.byMonth.get('2026-10')?.get('Kelvin Lai') ?? null)).toBe('HK$159')
    expect(averageSellingPrice(grandRevenue, grandQty)).toBe(grandRevenue / grandQty)
    expect({
      months: months.map((month) => ({
        label: month.label,
        asp: formatAsp(month.asp),
        aaron: formatAsp(reps.byMonth.get(month.monthKey)?.get('Aaron Chang') ?? null),
        kelvin: formatAsp(reps.byMonth.get(month.monthKey)?.get('Kelvin Lai') ?? null),
        kenny: formatAsp(reps.byMonth.get(month.monthKey)?.get('Kenny Ma') ?? null),
      })),
      all: {
        asp: formatAsp(averageSellingPrice(grandRevenue, grandQty)),
        aaron: formatAsp(reps.totals.get('Aaron Chang') ?? null),
        kelvin: formatAsp(reps.totals.get('Kelvin Lai') ?? null),
        kenny: formatAsp(reps.totals.get('Kenny Ma') ?? null),
      },
    }).toEqual({
      months: [
        {
          label: 'Aug 2026',
          asp: 'HK$125',
          aaron: 'HK$108',
          kelvin: 'HK$163',
          kenny: 'HK$144',
        },
        {
          label: 'Sep 2026',
          asp: 'HK$84',
          aaron: 'HK$107',
          kelvin: 'HK$59',
          kenny: 'HK$129',
        },
        {
          label: 'Oct 2026',
          asp: 'HK$114',
          aaron: 'HK$94',
          kelvin: 'HK$159',
          kenny: 'HK$125',
        },
      ],
      all: {
        asp: 'HK$99',
        aaron: 'HK$105',
        kelvin: 'HK$82',
        kenny: 'HK$134',
      },
    })
  })
})
