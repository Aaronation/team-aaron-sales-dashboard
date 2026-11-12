import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterItems, groupBy, uniqueCustomers } from './aggregates'
import { customerWorkingDayMom, followUpAccounts } from './chartSeries'
import { WGAL_PARTNER_ALIASES, canonicalCustomerLabel, canonicalizeCustomers, customerMatchKey } from './partnerAliases'
import type { LineItem, SalesPayload } from './types'

function line(
  date: string,
  totalAmount: number,
  customer: string,
  extra: Partial<LineItem> = {},
): LineItem {
  return {
    source: 'test',
    invoice: extra.invoice ?? `INV-${date}-${customer}-${totalAmount}`,
    tradingPartner: extra.tradingPartner ?? null,
    customer,
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

describe('customer whitespace and case identity', () => {
  it('ignores spaces, full-width spaces, and letter case without merging different companies', () => {
    expect(customerMatchKey('YOHO友和')).toBe(customerMatchKey('YOHO 友和'))
    expect(customerMatchKey('YOHO\u3000友和')).toBe(customerMatchKey('yoho 友和'))
    expect(customerMatchKey("YAN'S COMPUTER")).toBe(customerMatchKey("Yan's Computer"))
    expect(customerMatchKey('  節拍')).toBe(customerMatchKey('節拍'))
    expect(customerMatchKey('CTM')).not.toBe(customerMatchKey('CTM Limited'))
    expect(customerMatchKey('Vision')).not.toBe(customerMatchKey('Vision computer'))
  })

  it('prefers the readable spaced label when both forms exist', () => {
    expect(canonicalCustomerLabel(['YOHO友和', 'YOHO友和', 'YOHO 友和'])).toBe('YOHO 友和')
    expect(canonicalCustomerLabel(["YAN'S COMPUTER", "Yan's Computer"])).toBe("Yan's Computer")
    expect(canonicalCustomerLabel(['  節拍', '節拍'])).toBe('節拍')
    expect(canonicalCustomerLabel(['CTM', 'CTM Limited'])).not.toBe('CTM')
    expect(canonicalCustomerLabel(['CTM Limited'])).toBe('CTM Limited')
  })

  it('combines the YOHO pair on the chart and keeps it off follow-up when this period has sales', () => {
    const items = [
      line('2026-10-06', 100, 'YOHO友和', { invoice: 'glued', quantity: 2 }),
      line('2026-10-08', 40, 'YOHO 友和', { invoice: 'spaced', quantity: 1 }),
      line('2026-09-02', 25, 'YOHO友和', { invoice: 'prior-glued', quantity: 1 }),
      line('2026-09-03', 15, 'yoho\u3000友和', { invoice: 'prior-wide', quantity: 1 }),
      line('2026-10-06', 500, 'CTM', { invoice: 'ctm' }),
      line('2026-10-06', 80, 'CTM Limited', { invoice: 'ctm-ltd' }),
      line('2026-09-02', 9, 'Harbour', { invoice: 'harbour-prior' }),
    ]
    const mom = customerWorkingDayMom(items, '2026-10', '2026-10-18')
    expect(mom.bars.map((bar) => bar.name)).toEqual(['CTM', 'YOHO 友和', 'CTM Limited'])
    expect(mom.bars.find((bar) => bar.name === 'YOHO 友和')).toMatchObject({
      current: 140,
      prior: 40,
      asp: 140 / 3,
      priorAsp: 20,
    })
    expect(uniqueCustomers(items.filter((row) => row.date?.startsWith('2026-10')))).toBe(3)
    expect(groupBy(canonicalizeCustomers(items), (row) => row.customer).map((row) => row.name)).toEqual([
      'CTM',
      'YOHO 友和',
      'CTM Limited',
      'Harbour',
    ])

    const chase = followUpAccounts(items, '2026-10', '2026-10-18', 'Aaron Chang')
    expect(chase?.map((account) => account.name)).toEqual(['Harbour'])
    expect(chase?.some((account) => customerMatchKey(account.name) === customerMatchKey('YOHO友和'))).toBe(false)
  })

  it('sums a prior-only whitespace pair into one follow-up row', () => {
    const items = [
      line('2026-09-02', 30, 'YOHO友和', { invoice: 'a' }),
      line('2026-09-04', 12, 'YOHO 友和', { invoice: 'b' }),
    ]
    expect(followUpAccounts(items, '2026-10', '2026-10-18', 'Aaron Chang')).toEqual([
      { name: 'YOHO 友和', prior: 42 },
    ])
  })

  it('finds either YOHO spelling from search and leaves the wGAL map in place', () => {
    const items = [
      line('2026-10-12', 10, 'YOHO友和', { invoice: 'g' }),
      line('2026-10-12', 20, 'YOHO 友和', { invoice: 's' }),
      line('2026-10-12', 5, 'Vision', { invoice: 'v' }),
    ]
    const filters = { weekKey: '2026-W42', salesperson: 'all', department: 'all', query: 'YOHO友和' }
    expect(filterItems(items, filters).map((row) => row.invoice).sort()).toEqual(['g', 's'])
    expect(filterItems(items, { ...filters, query: 'YOHO 友和' }).map((row) => row.invoice).sort()).toEqual([
      'g',
      's',
    ])
    expect(filterItems(items, { ...filters, query: 'CTM' })).toEqual([])
    expect(WGAL_PARTNER_ALIASES['駿業電腦用品公司 Vision computer']).toBe('Vision')
    expect(WGAL_PARTNER_ALIASES['YOHO友和']).toBe('YOHO友和')
  })

  it('combines seeded YOHO on 2026-W42 into one customer with both windows', () => {
    const payload = JSON.parse(readFileSync('public/data/sales-line-items.json', 'utf8')) as SalesPayload
    const through = '2026-10-18'
    const priorEnd = '2026-09-15'
    const aaronItems = payload.lineItems.filter((row) => row.salesperson === 'Aaron Chang')
    const mom = customerWorkingDayMom(aaronItems, '2026-10', through, 50)
    const yohoBars = mom.bars.filter((bar) => customerMatchKey(bar.name) === customerMatchKey('YOHO友和'))
    expect(yohoBars).toHaveLength(1)
    expect(yohoBars[0]?.name).toBe('YOHO 友和')
    const team = customerWorkingDayMom(payload.lineItems, '2026-10', through, 500)
    expect(team.bars.filter((bar) => customerMatchKey(bar.name) === customerMatchKey('YOHO友和'))).toHaveLength(1)

    const windowTotal = (start: string, end: string) =>
      payload.lineItems
        .filter(
          (row) =>
            row.customer != null &&
            customerMatchKey(row.customer) === customerMatchKey('YOHO友和') &&
            row.date != null &&
            row.date >= start &&
            row.date <= end,
        )
        .reduce((sum, row) => sum + row.totalAmount, 0)

    expect(yohoBars[0]?.current).toBeCloseTo(windowTotal('2026-10-01', through), 6)
    expect(yohoBars[0]?.prior).toBeCloseTo(windowTotal('2026-09-01', priorEnd), 6)
    expect(yohoBars[0]?.current).toBeCloseTo(9077.92, 6)
    expect(yohoBars[0]?.prior).toBeCloseTo(78162.3, 6)

    const aaron = followUpAccounts(payload.lineItems, '2026-10', through, 'Aaron Chang')
    expect(aaron?.some((account) => customerMatchKey(account.name) === customerMatchKey('YOHO友和'))).toBe(false)
    const ctm = team.bars.find((bar) => bar.name === 'CTM')
    const ctmLimited = team.bars.find((bar) => bar.name === 'CTM Limited')
    expect(ctm?.name).toBe('CTM')
    expect(ctmLimited).toBeUndefined()
  })
})
