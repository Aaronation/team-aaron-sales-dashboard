/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { asp, averageSellingPrice, filterItems, filterMtdThroughWeek, formatAsp, sumQty, sumRevenue } from './aggregates'
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
    expect(formatAsp(asp(items))).toBe('HK$500.00')
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
    expect(formatAsp(75)).toBe('HK$75.00')
  })

  it('keeps a negative unit total when returns exceed sales', () => {
    expect(asp([line(100, -4)])).toBe(-25)
    expect(formatAsp(-25)).toBe('-HK$25.00')
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
      teamWeek: 'HK$106.72',
      teamMtd: 'HK$113.65',
      aaronWeek: 'HK$97.42',
      kelvinWeek: 'HK$161.94',
      aaronMtd: 'HK$94.01',
      kelvinMtd: 'HK$158.93',
    })
  })
})
