/**
 * Same path as Import → App.handleImport:
 * sheet rows → recordsFromMatrix → ingestRecords → mergeImportedItems.
 * Monthly customer charts then group on `customer` (see groupBy in App.tsx).
 *
 * Merge applies the wGAL map in partnerAliases before that grouping.
 * Replace swaps the working set for the ingested rows and does not rematch.
 */
import { describe, expect, it } from 'vitest'
import { groupBy, sumRevenue } from './aggregates'
import { ingestRecords, mergeImportedItems, recordsFromMatrix } from './ingest'
import { WGAL_PARTNER_ALIASES } from './partnerAliases'
import type { LineItem } from './types'

const VISION_PARTNER = '駿業電腦用品公司 Vision computer'

function ingestSheet(rows: unknown[][]): LineItem[] {
  const table = recordsFromMatrix(rows)
  return ingestRecords(table.records, { source: 'import' }).lineItems
}

function lineItem(
  overrides: Partial<LineItem> & Pick<LineItem, 'invoice' | 'date' | 'totalAmount' | 'customer'>,
): LineItem {
  return {
    source: 'seed',
    invoice: overrides.invoice,
    tradingPartner: overrides.tradingPartner ?? null,
    customer: overrides.customer,
    date: overrides.date,
    year: overrides.year ?? '2026',
    month: overrides.month ?? 'October',
    week: overrides.week ?? 40,
    day: overrides.day ?? 'Friday',
    department: overrides.department ?? 'Galaxy - KA',
    salesperson: overrides.salesperson ?? 'Aaron Chang',
    sku: overrides.sku ?? 'SEED-SKU',
    productModel: overrides.productModel ?? null,
    category: overrides.category ?? null,
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? overrides.totalAmount,
    totalAmount: overrides.totalAmount,
    productName: overrides.productName ?? null,
    customerCode: overrides.customerCode ?? null,
  }
}

/** Kingdee-style sheet: 往来单位 only, no Customer Name / 客户 column. */
function visionPartnerSheet(): unknown[][] {
  return [
    ['单据编号', '单据日期', '往来单位', '销售员', '物料编码', '数量', '价税合计'],
    ['GAL26-10-08-001', '2026-10-08', VISION_PARTNER, 'Aaron Chang', 'UA18UKGDG', 2, 1000],
    ['GAL26-10-09-002', '2026-10-09', VISION_PARTNER, 'Aaron Chang', 'PX20', 1, 2500],
  ]
}

function currentDataset(): LineItem[] {
  return [
    lineItem({
      invoice: 'SEED-001',
      date: '2026-10-02',
      totalAmount: 200,
      customer: 'ADDL',
      tradingPartner: 'Advantage Digital Ltd.',
      sku: 'SEED-SKU',
    }),
  ]
}

describe('customer name rematch on merge', () => {
  it('maps 往来单位 “駿業電腦用品公司 Vision computer” to Vision for charts', () => {
    expect(WGAL_PARTNER_ALIASES[VISION_PARTNER]).toBe('Vision')

    const incoming = ingestSheet(visionPartnerSheet())
    expect(incoming.map((row) => row.customer)).toEqual([VISION_PARTNER, VISION_PARTNER])
    expect(incoming.map((row) => row.tradingPartner)).toEqual([VISION_PARTNER, VISION_PARTNER])

    const merged = mergeImportedItems(currentDataset(), incoming, 'merge')
    const visionRows = merged.lineItems.filter((row) => row.tradingPartner === VISION_PARTNER)

    expect(visionRows).toHaveLength(2)
    expect(visionRows.map((row) => row.customer)).toEqual(['Vision', 'Vision'])

    const chartLabels = groupBy(merged.lineItems, (row) => row.customer)
    expect(chartLabels.map((row) => row.name)).toContain('Vision')
    expect(chartLabels.map((row) => row.name)).not.toContain(VISION_PARTNER)
    expect(chartLabels.find((row) => row.name === 'Vision')).toMatchObject({
      revenue: 3500,
      lines: 2,
    })
  })

  it('rematches an English Trading Partner header the same way', () => {
    const incoming = ingestSheet([
      ['Invoice', 'Date', 'Trading Partner', 'Salesperson', 'SKU', 'Quantity', 'Total Amount'],
      ['GAL26-10-10-003', '2026-10-10', VISION_PARTNER, 'Aaron Chang', 'LED1', 1, 800],
    ])
    expect(incoming[0]?.customer).toBe(VISION_PARTNER)

    const merged = mergeImportedItems([], incoming, 'merge')
    expect(merged.lineItems).toHaveLength(1)
    expect(merged.lineItems[0]?.customer).toBe('Vision')
    expect(groupBy(merged.lineItems, (row) => row.customer).map((row) => row.name)).toEqual(['Vision'])
  })

  it.each([
    ['客户', 'Harbour Retail'],
    ['客户名称', 'Island Shop'],
    ['Customer Name', 'Kowloon Mart'],
  ] as const)('keeps an explicit %s column (%s) instead of the wGAL alias', (header, customerName) => {
    const amountHeader = header === 'Customer Name' ? 'Total Amount' : '价税合计'
    const headers =
      header === 'Customer Name'
        ? ['Invoice', 'Date', 'Trading Partner', header, 'Salesperson', 'SKU', 'Quantity', amountHeader]
        : ['单据编号', '单据日期', '往来单位', header, '销售员', '物料编码', '数量', amountHeader]
    const incoming = ingestSheet([
      headers,
      ['GAL26-10-11-004', '2026-10-11', VISION_PARTNER, customerName, 'Kelvin Lai', 'CAB1', 1, 640],
    ])

    expect(incoming[0]?.customer).toBe(customerName)
    expect(incoming[0]?.tradingPartner).toBe(VISION_PARTNER)

    const merged = mergeImportedItems(currentDataset(), incoming, 'merge')
    const imported = merged.lineItems.find((row) => row.invoice === 'GAL26-10-11-004')
    expect(imported?.customer).toBe(customerName)
    expect(groupBy(merged.lineItems, (row) => row.customer).map((row) => row.name)).toContain(customerName)
    expect(groupBy(merged.lineItems, (row) => row.customer).map((row) => row.name)).not.toContain('Vision')
  })

  it('rematches when the customer cell is present but blank', () => {
    const incoming = ingestSheet([
      ['单据编号', '单据日期', '往来单位', '客户', '销售员', '物料编码', '数量', '价税合计'],
      ['GAL26-10-12-005', '2026-10-12', VISION_PARTNER, '', 'Aaron Chang', 'UA18UKGDG', 1, 400],
    ])
    expect(incoming[0]?.customer).toBe(VISION_PARTNER)

    const merged = mergeImportedItems([], incoming, 'merge')
    expect(merged.lineItems[0]?.customer).toBe('Vision')
  })
})

describe('merge into current vs replace', () => {
  it('adds new rows, and a second merge of the same sheet does not double-count', () => {
    const current = currentDataset()
    const firstIncoming = ingestSheet(visionPartnerSheet())
    const first = mergeImportedItems(current, firstIncoming, 'merge')

    expect(first.added).toBe(2)
    expect(first.replaced).toBe(0)
    expect(first.lineItems).toHaveLength(3)
    expect(sumRevenue(first.lineItems)).toBe(3700)

    // Re-parse the same file. Ingest still stores the long 往来单位 until Merge rematches.
    const secondIncoming = ingestSheet(visionPartnerSheet())
    expect(secondIncoming.every((row) => row.customer === VISION_PARTNER)).toBe(true)

    const second = mergeImportedItems(first.lineItems, secondIncoming, 'merge')
    expect(second.added).toBe(0)
    expect(second.replaced).toBe(2)
    expect(second.lineItems).toHaveLength(first.lineItems.length)
    expect(sumRevenue(second.lineItems)).toBe(sumRevenue(first.lineItems))
    expect(groupBy(second.lineItems, (row) => row.customer).find((row) => row.name === 'Vision')).toMatchObject({
      revenue: 3500,
      lines: 2,
    })

    const extra = ingestSheet([
      ['单据编号', '单据日期', '往来单位', '销售员', '物料编码', '数量', '价税合计'],
      ['GAL26-10-13-006', '2026-10-13', VISION_PARTNER, 'Aaron Chang', 'LED1', 1, 400],
    ])
    const third = mergeImportedItems(second.lineItems, extra, 'merge')
    expect(third.added).toBe(1)
    expect(third.replaced).toBe(0)
    expect(third.lineItems).toHaveLength(4)
    expect(sumRevenue(third.lineItems)).toBe(4100)
    expect(third.lineItems.find((row) => row.invoice === 'GAL26-10-13-006')?.customer).toBe('Vision')
  })

  it('replace swaps the working set for the ingested rows', () => {
    const current = mergeImportedItems(currentDataset(), ingestSheet(visionPartnerSheet()), 'merge')
    expect(current.lineItems).toHaveLength(3)

    const incoming = ingestSheet(visionPartnerSheet())
    const replaced = mergeImportedItems(current.lineItems, incoming, 'replace')

    expect(replaced.added).toBe(incoming.length)
    expect(replaced.replaced).toBe(0)
    expect(replaced.lineItems).toHaveLength(2)
    expect(replaced.lineItems.map((row) => row.invoice).sort()).toEqual([
      'GAL26-10-08-001',
      'GAL26-10-09-002',
    ])
    expect(replaced.lineItems.some((row) => row.invoice === 'SEED-001')).toBe(false)
    expect(sumRevenue(replaced.lineItems)).toBe(sumRevenue(incoming))
    // Alias rematch runs on Merge only. Replace keeps the customer text ingest stored.
    expect(replaced.lineItems.map((row) => row.customer)).toEqual([VISION_PARTNER, VISION_PARTNER])
  })
})
