/**
 * Same path as Import → App.handleImport:
 * sheet rows → recordsFromMatrix → ingestRecords → mergeImportedItems.
 * Monthly customer charts then group on `customer` (see groupBy in App.tsx).
 *
 * Merge applies the wGAL map in partnerAliases before that grouping.
 * Merge then replaces every invoice number present in the file and keeps the rest.
 * Replace swaps the working set for the ingested rows and does not rematch.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterItems, groupBy, isoWeekKey, listWeekKeys, sumRevenue } from './aggregates'
import { reconcileFilters } from './filters'
import { ingestRecords, lineKey, mergeImportedItems, recordsFromMatrix } from './ingest'
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

describe('invoice-aware merge', () => {
  const shop39 = 'Lancer 領先 Shop39'
  const shop11 = 'Lancer 領先 Shop11'

  it('replaces revised qty, price, and date on the same invoice', () => {
    const current = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'UD31Q22UKR',
        quantity: 10,
        unitPrice: 132,
        totalAmount: 1320,
        customer: 'Lancer',
        tradingPartner: shop39,
        salesperson: 'Kelvin Lai',
      }),
    ]
    const incoming = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-06',
        sku: 'UD31Q22UKR',
        quantity: 4,
        unitPrice: 200,
        totalAmount: 800,
        customer: 'Lancer',
        tradingPartner: shop39,
        salesperson: 'Kelvin Lai',
        source: 'import',
      }),
    ]

    const merged = mergeImportedItems(current, incoming, 'merge')

    expect(merged.added).toBe(0)
    expect(merged.replaced).toBe(1)
    expect(merged.lineItems).toHaveLength(1)
    expect(merged.lineItems[0]).toMatchObject({
      date: '2026-10-06',
      quantity: 4,
      unitPrice: 200,
      totalAmount: 800,
    })
    expect(sumRevenue(merged.lineItems)).toBe(sumRevenue(incoming))
    expect(sumRevenue(merged.lineItems)).toBe(800)
  })

  it('drops a line the revised invoice no longer includes', () => {
    const current = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'UD31Q22UKR',
        quantity: 10,
        unitPrice: 132,
        totalAmount: 1320,
        customer: 'Lancer',
        tradingPartner: shop39,
        salesperson: 'Kelvin Lai',
      }),
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'TP11W',
        quantity: 1,
        unitPrice: 1722,
        totalAmount: 1722,
        customer: 'Lancer',
        tradingPartner: shop39,
        salesperson: 'Kelvin Lai',
      }),
    ]
    const incoming = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'UD31Q22UKR',
        quantity: 10,
        unitPrice: 132,
        totalAmount: 1320,
        customer: 'Lancer',
        tradingPartner: shop39,
        salesperson: 'Kelvin Lai',
        source: 'import',
      }),
    ]

    const merged = mergeImportedItems(current, incoming, 'merge')
    const revised = merged.lineItems.filter((row) => row.invoice === 'SI26100020')

    expect(revised.map((row) => row.sku)).toEqual(['UD31Q22UKR'])
    expect(sumRevenue(revised)).toBe(1320)
    expect(sumRevenue(revised)).toBe(sumRevenue(incoming))
    expect(merged.added).toBe(0)
    expect(merged.replaced).toBe(1)
  })

  it('keeps an invoice the file does not mention', () => {
    const kept = lineItem({
      invoice: 'SI-KEEP',
      date: '2026-09-30',
      sku: 'KEEP-SKU',
      totalAmount: 500,
      customer: 'Vision',
    })
    const current = [
      kept,
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'OLD',
        totalAmount: 3042,
        customer: 'Lancer',
        tradingPartner: shop39,
        salesperson: 'Kelvin Lai',
      }),
    ]
    const incoming = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'NEW',
        totalAmount: 900,
        customer: 'Lancer',
        tradingPartner: shop11,
        salesperson: 'Kelvin Lai',
        source: 'import',
      }),
    ]

    const merged = mergeImportedItems(current, incoming, 'merge')

    expect(merged.lineItems.find((row) => row.invoice === 'SI-KEEP')).toMatchObject({
      totalAmount: 500,
      customer: 'Vision',
      sku: 'KEEP-SKU',
    })
    expect(sumRevenue(merged.lineItems.filter((row) => row.invoice === 'SI26100020'))).toBe(900)
  })

  it('adds an invoice that is only in the file', () => {
    const current = [
      lineItem({
        invoice: 'SI-KEEP',
        date: '2026-09-30',
        totalAmount: 500,
        customer: 'Vision',
      }),
    ]
    const incoming = [
      lineItem({
        invoice: 'SI-NEW',
        date: '2026-10-04',
        sku: 'NEW-SKU',
        totalAmount: 200,
        customer: 'Lancer',
        salesperson: 'Kelvin Lai',
        source: 'import',
      }),
    ]

    const merged = mergeImportedItems(current, incoming, 'merge')

    expect(merged.added).toBe(1)
    expect(merged.replaced).toBe(0)
    expect(merged.lineItems.map((row) => row.invoice)).toEqual(['SI-KEEP', 'SI-NEW'])
    expect(sumRevenue(merged.lineItems)).toBe(700)
  })

  it('stays stable when the same invoice snapshot is merged again', () => {
    const current = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'OLD',
        quantity: 9,
        totalAmount: 3042,
        customer: 'Lancer',
        tradingPartner: shop39,
        salesperson: 'Kelvin Lai',
      }),
      lineItem({
        invoice: 'SI-KEEP',
        date: '2026-09-30',
        totalAmount: 500,
        customer: 'Vision',
      }),
    ]
    const incoming = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'UD31-REV',
        quantity: 2,
        unitPrice: 500,
        totalAmount: 1000,
        customer: shop11,
        tradingPartner: shop11,
        salesperson: 'Kelvin Lai',
        source: 'import',
      }),
      lineItem({
        invoice: 'SI-NEW',
        date: '2026-10-02',
        sku: 'NEW-SKU',
        quantity: 1,
        totalAmount: 500,
        customer: shop11,
        tradingPartner: shop11,
        salesperson: 'Kelvin Lai',
        source: 'import',
      }),
    ]

    const first = mergeImportedItems(current, incoming, 'merge')
    const second = mergeImportedItems(first.lineItems, incoming, 'merge')

    expect(first.lineItems.find((row) => row.sku === 'OLD')).toBeUndefined()
    expect(first.lineItems.filter((row) => row.invoice === 'SI26100020')).toMatchObject([
      { sku: 'UD31-REV', totalAmount: 1000, quantity: 2, customer: 'Lancer' },
    ])
    expect(sumRevenue(first.lineItems.filter((row) => row.invoice === 'SI26100020'))).toBe(1000)
    expect(second.added).toBe(0)
    expect(second.replaced).toBe(2)
    expect(second.lineItems).toHaveLength(first.lineItems.length)
    expect(sumRevenue(second.lineItems)).toBe(sumRevenue(first.lineItems))
    expect(second.lineItems.map((row) => row.invoice)).toEqual(first.lineItems.map((row) => row.invoice))
    expect(second.lineItems.find((row) => row.invoice === 'SI-KEEP')?.totalAmount).toBe(500)
  })

  it('rematches a Lancer shop while replacing the invoice snapshot', () => {
    const current = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'UD31Q22UKR',
        totalAmount: 3042,
        customer: shop39,
        tradingPartner: shop39,
        salesperson: 'Kelvin Lai',
      }),
      lineItem({
        invoice: 'SI-KEEP',
        date: '2026-09-15',
        totalAmount: 420,
        customer: 'Vision',
      }),
    ]
    const incoming = ingestSheet([
      ['单据编号', '单据日期', '往来单位', '销售员', '物料编码', '数量', '价税合计'],
      ['SI26100020', '2026-10-02', shop11, 'Kelvin Lai', 'UD31-REV', 2, 1000],
      ['SI-NEW', '2026-10-04', shop11, 'Kelvin Lai', 'NEW-SKU', 1, 250],
    ])
    expect(incoming.map((row) => row.customer)).toEqual([shop11, shop11])

    const merged = mergeImportedItems(current, incoming, 'merge')

    expect(merged.lineItems.filter((row) => row.invoice === 'SI26100020')).toMatchObject([
      { customer: 'Lancer', sku: 'UD31-REV', totalAmount: 1000, quantity: 2 },
    ])
    expect(merged.lineItems.find((row) => row.invoice === 'SI-NEW')).toMatchObject({
      customer: 'Lancer',
      totalAmount: 250,
    })
    expect(merged.lineItems.find((row) => row.invoice === 'SI-KEEP')?.totalAmount).toBe(420)
    expect(sumRevenue(merged.lineItems.filter((row) => row.invoice === 'SI26100020'))).toBe(1000)
    expect(sumRevenue(merged.lineItems)).toBe(1670)
  })

  it('keeps an explicit customer name when replacing an invoice', () => {
    const current = [
      lineItem({
        invoice: 'SI26100020',
        date: '2026-10-02',
        sku: 'OLD',
        totalAmount: 3042,
        customer: 'Lancer',
        tradingPartner: shop39,
      }),
    ]
    const incoming = ingestSheet([
      ['单据编号', '单据日期', '往来单位', '客户', '销售员', '物料编码', '数量', '价税合计'],
      ['SI26100020', '2026-10-02', shop11, 'Harbour Retail', 'Kelvin Lai', 'NEW', 1, 900],
    ])

    const merged = mergeImportedItems(current, incoming, 'merge')

    expect(merged.lineItems).toHaveLength(1)
    expect(merged.lineItems[0]).toMatchObject({
      customer: 'Harbour Retail',
      tradingPartner: shop11,
      sku: 'NEW',
      totalAmount: 900,
    })
  })

  it('does not double-count identical lines inside one invoice', () => {
    const line = lineItem({
      invoice: 'SI-1',
      date: '2026-10-02',
      sku: 'A',
      quantity: 2,
      totalAmount: 40,
      customer: 'Vision',
    })
    const merged = mergeImportedItems(
      [lineItem({ invoice: 'SI-KEEP', date: '2026-10-01', totalAmount: 10, customer: 'ADDL' })],
      [line, { ...line }],
      'merge',
    )
    const invoice = merged.lineItems.filter((row) => row.invoice === 'SI-1')

    expect(invoice).toHaveLength(1)
    expect(sumRevenue(invoice)).toBe(40)
    expect(merged.added).toBe(1)
    expect(merged.lineItems).toHaveLength(2)
  })

  it('replaces bundled seed invoice SI26100020 and keeps a neighbor invoice', () => {
    const seed = JSON.parse(
      readFileSync(new URL('../../public/data/sales-line-items.json', import.meta.url), 'utf8'),
    ) as { lineItems: LineItem[] }
    const before = seed.lineItems.filter((row) => row.invoice === 'SI26100020')
    const neighbor = seed.lineItems.filter((row) => row.invoice === 'SI26100055')
    expect(before).toHaveLength(9)
    expect(sumRevenue(before)).toBe(3042)
    expect(new Set(before.map((row) => lineKey(row))).size).toBe(before.length)

    const incoming = ingestSheet([
      ['单据编号', '单据日期', '往来单位', '销售员', '物料编码', '数量', '价税合计'],
      ['SI26100020', '2026-10-02', shop11, 'Kelvin Lai', 'UD31-REV', 2, 1000],
      ['SI-NEW-AWARE', '2026-10-02', shop11, 'Kelvin Lai', 'NEW-SKU', 1, 500],
    ])
    const uniqueBefore = new Set(seed.lineItems.map((row) => lineKey(row))).size
    const first = mergeImportedItems(seed.lineItems, incoming, 'merge')

    expect(first.added).toBe(1)
    expect(first.replaced).toBe(1)
    expect(first.lineItems).toHaveLength(uniqueBefore - before.length + incoming.length)
    expect(first.lineItems.filter((row) => row.invoice === 'SI26100020')).toMatchObject([
      { customer: 'Lancer', sku: 'UD31-REV', quantity: 2, totalAmount: 1000 },
    ])
    expect(sumRevenue(first.lineItems.filter((row) => row.invoice === 'SI-NEW-AWARE'))).toBe(500)
    expect(sumRevenue(first.lineItems.filter((row) => row.invoice === 'SI26100055'))).toBe(
      sumRevenue(neighbor),
    )
    expect(first.lineItems.filter((row) => row.invoice === 'SI26100055')).toHaveLength(neighbor.length)

    const second = mergeImportedItems(first.lineItems, incoming, 'merge')
    expect(second.added).toBe(0)
    expect(second.replaced).toBe(2)
    expect(second.lineItems).toHaveLength(first.lineItems.length)
    expect(sumRevenue(second.lineItems.filter((row) => row.invoice === 'SI26100020'))).toBe(1000)
  })

  it('does not wipe other rows that have no invoice number', () => {
    const current = [
      lineItem({ invoice: '', date: '2026-10-01', sku: 'A', totalAmount: 10, customer: 'ADDL' }),
      lineItem({ invoice: '', date: '2026-10-02', sku: 'B', totalAmount: 20, customer: 'Vision' }),
    ]
    const incoming = [
      lineItem({
        invoice: '',
        date: '2026-10-03',
        sku: 'C',
        totalAmount: 30,
        customer: 'Harbour',
        source: 'import',
      }),
    ]

    const merged = mergeImportedItems(current, incoming, 'merge')

    expect(merged.lineItems).toHaveLength(3)
    expect(sumRevenue(merged.lineItems)).toBe(60)
    expect(merged.added).toBe(1)
    expect(merged.replaced).toBe(0)
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

/** Headers from the Kingdee English “List Data” export (Team-20261020). */
const ENGLISH_EXPORT_HEADERS = [
  'No.',
  'Document Number',
  'Trading Partner',
  'Business Date',
  'Amount',
  'Sales Department',
  'Salesperson',
  'Material Code',
  'Material Name',
  'Quantity',
  'Unit Price',
  'Tax-Inclusive Amount',
  'Specification',
  'Customer code',
  '销售出库单备注',
  '产品型号',
]

describe('English Kingdee List Data export', () => {
  it('reads Business Date, the tax-inclusive line amount, and 产品型号', () => {
    const incoming = ingestSheet([
      ENGLISH_EXPORT_HEADERS,
      [
        2,
        'GAL26-10-20-001',
        'Wonderland 奇趣天地',
        '2026-10-20',
        null,
        'Galaxy',
        'Aaron Chang',
        'KS-726DG',
        null,
        1,
        88,
        88,
        'Dretec 2KG電子料理磅(最少0.1g) 黑色',
        'C001',
        '',
        'KS-726',
      ],
      [
        3,
        'GAL26-10-20-001',
        'Wonderland 奇趣天地',
        46315,
        null,
        'Galaxy',
        'Aaron Chang',
        'LS-107OR',
        null,
        2,
        39,
        39,
        'long specification that is not the model',
        'C001',
        '',
        'LS-107',
      ],
      [
        4,
        'SI26100869',
        'Advantage Digital Ltd.',
        '2026-10-20',
        17899,
        'Galaxy',
        'Aaron Chang',
        'BR9-SKU',
        'name',
        50,
        50,
        50,
        'another long specification',
        'C002',
        '',
        'BR9',
      ],
    ])

    expect(incoming.map((row) => row.date)).toEqual(['2026-10-20', '2026-10-20', '2026-10-20'])
    expect(incoming.map((row) => isoWeekKey(row.date))).toEqual(['2026-W43', '2026-W43', '2026-W43'])
    expect(incoming.map((row) => row.totalAmount)).toEqual([88, 39, 50])
    expect(incoming.map((row) => row.productModel)).toEqual(['KS-726', 'LS-107', 'BR9'])
    expect(incoming.map((row) => row.invoice)).toEqual(['GAL26-10-20-001', 'GAL26-10-20-001', 'SI26100869'])
    expect(incoming.map((row) => row.sku)).toEqual(['KS-726DG', 'LS-107OR', 'BR9-SKU'])

    const seed = [
      lineItem({
        invoice: 'SEED-W42',
        date: '2026-10-12',
        totalAmount: 100,
        customer: 'ADDL',
      }),
    ]
    const merged = mergeImportedItems(seed, incoming, 'merge')
    expect(merged.added).toBe(3)
    expect(merged.replaced).toBe(0)
    expect(listWeekKeys(merged.lineItems)).toContain('2026-W43')
    expect(listWeekKeys(merged.lineItems)).toContain('2026-W42')

    const wonderland = merged.lineItems.filter((row) => row.invoice === 'GAL26-10-20-001')
    expect(wonderland.map((row) => row.customer)).toEqual(['Wonderland', 'Wonderland'])
    expect(merged.lineItems.find((row) => row.invoice === 'SI26100869')?.customer).toBe('ADDL')

    const kept = reconcileFilters(
      { weekKey: '2026-W42', salesperson: 'all', department: 'all', query: '' },
      merged.lineItems,
    )
    expect(kept.weekKey).toBe('2026-W42')
    expect(listWeekKeys(merged.lineItems)).toContain('2026-W43')

    // Same inputs as Top product models (qty): this week’s lines, model or SKU, quantity.
    const rank = (weekKey: string, salesperson = 'all') => {
      const week = filterItems(merged.lineItems, {
        weekKey,
        salesperson,
        department: 'all',
        query: '',
      })
      return [...groupBy(week, (row) => row.productModel || row.sku)]
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .slice(0, 10)
        .map((row) => ({ name: row.name, qty: Math.round(row.quantity) }))
    }

    expect(rank('2026-W43')).toEqual([
      { name: 'BR9', qty: 50 },
      { name: 'LS-107', qty: 2 },
      { name: 'KS-726', qty: 1 },
    ])
    expect(rank('2026-W43', 'Aaron Chang')).toEqual(rank('2026-W43'))
    expect(rank('2026-W42')).toEqual([{ name: 'SEED-SKU', qty: 1 }])
    expect(filterItems(merged.lineItems, { weekKey: '2026-W42', salesperson: 'all', department: 'all', query: '' }).some((row) => row.date === '2026-10-20')).toBe(false)
  })

  it('still uses Amount when the sheet has no tax-inclusive column', () => {
    const rows = ingestSheet([
      ['Date', 'Amount', 'Salesperson'],
      ['2026-10-20', 120, 'Aaron Chang'],
    ])
    expect(rows[0]?.date).toBe('2026-10-20')
    expect(rows[0]?.totalAmount).toBe(120)
    expect(isoWeekKey(rows[0]?.date ?? '')).toBe('2026-W43')
  })

  it('prefers 价税合计 over a repeated 金额 document total', () => {
    const rows = ingestSheet([
      ['单据日期', '金额', '价税合计', '销售员', '规格型号', '产品型号'],
      ['2026-10-08', 9999, 640, 'Aaron Chang', 'long spec text', 'KS-726'],
    ])
    expect(rows[0]?.totalAmount).toBe(640)
    expect(rows[0]?.productModel).toBe('KS-726')
  })

  it('keeps 金额 and Specification when they are the only amount and model columns', () => {
    const rows = ingestSheet([
      ['单据日期', '金额', 'Specification'],
      ['2026-10-08', 640, 'KS-1'],
    ])
    expect(rows[0]?.totalAmount).toBe(640)
    expect(rows[0]?.productModel).toBe('KS-1')
  })
})
