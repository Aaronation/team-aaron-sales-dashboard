import type { LineItem } from './types'
import { WGAL_PARTNER_ALIASES } from './partnerAliases'

/**
 * Turn tabular records into dashboard line items.
 *
 * File import calls this after reading CSV, Excel, or JSON.
 * A future KingdeeAI sync should fetch rows and call `ingestRecords` too,
 * instead of growing a second mapper. Auto-sync itself is out of scope.
 *
 * Sell-out is `totalAmount` (HKD). Month totals use `date`.
 */

export type ImportMode = 'replace' | 'merge'

export type IngestResult = {
  lineItems: LineItem[]
  warnings: string[]
  skipped: number
}

type Field =
  | 'invoice'
  | 'tradingPartner'
  | 'customer'
  | 'date'
  | 'department'
  | 'salesperson'
  | 'sku'
  | 'productModel'
  | 'category'
  | 'quantity'
  | 'unitPrice'
  | 'totalAmount'
  | 'productName'
  | 'customerCode'
  | 'source'

const FIELD_ALIASES: Record<Field, string[]> = {
  invoice: [
    'invoice',
    'invoiceno',
    'invoicenumber',
    'billno',
    'billnumber',
    'documentno',
    '单据编号',
    '发票号',
    '发票编号',
    '单号',
    '销售单号',
  ],
  tradingPartner: ['tradingpartner', '往来单位', '交易对象'],
  customer: ['customer', 'customername', 'client', '客户', '客户名称', '客户名'],
  date: ['date', 'invoicedate', 'billdate', 'bizdate', 'orderdate', '日期', '业务日期', '单据日期', '开票日期', '销售日期'],
  department: ['department', 'salesdepartment', 'dept', '部门', '销售部门'],
  salesperson: [
    'salesperson',
    'salesman',
    'salesrep',
    'salesrepresentative',
    'seller',
    '销售员',
    '业务员',
    '销售人员',
    '业务人员',
  ],
  sku: ['sku', 'itemcode', 'materialcode', 'productcode', '物料编码', '商品编码', '货品编码', '产品编码'],
  productModel: ['productmodel', 'model', 'spec', 'specification', '产品型号', '规格型号', '型号'],
  category: ['category', 'name', '类别', '分类', '产品类别'],
  quantity: ['quantity', 'qty', '数量', '实发数量', '销售数量'],
  unitPrice: ['unitprice', '单价', '含税单价', '销售单价'],
  totalAmount: [
    'totalamount',
    'amount',
    'totalsales',
    'salesamount',
    'revenue',
    'linetotal',
    '金额',
    '价税合计',
    '销售金额',
    '总金额',
    '合计金额',
  ],
  productName: ['productname', 'itemname', 'materialname', '物料名称', '商品名称', '产品名称', '货品名称'],
  customerCode: ['customercode', '客户编码', '客户代码'],
  source: ['source'],
}

const HEADER_TO_FIELD = new Map<string, Field>()
for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [Field, string[]][]) {
  for (const alias of aliases) HEADER_TO_FIELD.set(normHeader(alias), field)
}

export const IMPORT_COLUMN_HINT =
  'Expected columns: Date (日期 / 单据日期 / 业务日期) and Total Amount (金额 / 价税合计 / 销售金额), or Quantity × Unit Price. Salesperson (销售员 / 业务员) drives the sell-out pie. Optional: Invoice (单据编号), Customer (客户 / 客户名称; 往来单位 is used when that is empty), Department (销售部门), SKU (物料编码), product model (产品型号 / 规格型号). Ambiguous numeric dates are read as day/month/year.'

export function normHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./\\:：()（）[\]【】]+/g, '')
}

export function fieldForHeader(header: string): Field | null {
  return HEADER_TO_FIELD.get(normHeader(header)) ?? null
}

type Column = { field: Field; index: number; specificity: number }

function columnsFromHeader(headers: unknown[]): Column[] {
  const chosen = new Map<Field, Column>()
  headers.forEach((header, index) => {
    if (header == null) return
    const label = String(header).trim()
    if (!label) return
    const field = fieldForHeader(label)
    if (!field) return
    const specificity = normHeader(label).length
    const prev = chosen.get(field)
    if (!prev || specificity > prev.specificity) {
      chosen.set(field, { field, index, specificity })
    }
  })
  return [...chosen.values()].sort((a, b) => a.index - b.index)
}

function headerScore(cols: Column[]): number {
  let score = 0
  for (const col of cols) {
    if (col.field === 'date' || col.field === 'totalAmount') score += 3
    else if (col.field === 'salesperson' || col.field === 'quantity') score += 2
    else score += 1
  }
  return score
}

export function recordsFromMatrix(rows: unknown[][]): {
  records: Record<string, unknown>[]
  warnings: string[]
  fields: Field[]
} {
  const limit = Math.min(rows.length, 30)
  let bestIndex = -1
  let bestScore = 0
  let bestCols: Column[] = []
  for (let i = 0; i < limit; i++) {
    const cols = columnsFromHeader(rows[i] ?? [])
    const score = headerScore(cols)
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
      bestCols = cols
    }
  }

  const fields = bestCols.map((col) => col.field)
  if (bestIndex < 0 || bestScore < 3 || !fields.includes('date')) {
    const preview = (rows[0] ?? [])
      .map((cell) => String(cell ?? '').trim())
      .filter(Boolean)
      .slice(0, 8)
    throw new Error(
      `No date column found${preview.length ? ` (first row: ${preview.join(', ')})` : ''}. Expected Date, 日期, 单据日期, or 业务日期.`,
    )
  }
  if (!fields.includes('totalAmount') && !(fields.includes('quantity') && fields.includes('unitPrice'))) {
    throw new Error(
      `No amount column found (recognized: ${fields.join(', ')}). Expected Total Amount, 金额, 价税合计, or both Quantity and Unit Price.`,
    )
  }

  const warnings: string[] = []
  if (bestIndex > 0) {
    warnings.push(`Skipped ${bestIndex} title row${bestIndex === 1 ? '' : 's'} above the header.`)
  }
  if (!fields.includes('salesperson')) {
    warnings.push('No salesperson column — those rows count as Unassigned on the sell-out pie.')
  }

  const records: Record<string, unknown>[] = []
  for (let r = bestIndex + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every((cell) => cell == null || String(cell).trim() === '')) continue
    const record: Record<string, unknown> = {}
    for (const col of bestCols) record[col.field] = row[col.index] ?? null
    records.push(record)
  }
  return { records, warnings, fields }
}

export function normalizeRecordKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const spec = new Map<Field, number>()
  for (const [key, value] of Object.entries(raw)) {
    const field = fieldForHeader(key)
    if (!field) continue
    const specificity = normHeader(key).length
    const prev = spec.get(field)
    if (prev != null && specificity <= prev) continue
    spec.set(field, specificity)
    out[field] = value
  }
  return out
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isoWeekNumber(iso: string): number {
  const d = new Date(iso + 'T12:00:00Z')
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function calendarParts(iso: string): { year: string; month: string; week: number; day: string } {
  const d = new Date(iso + 'T12:00:00Z')
  return {
    year: iso.slice(0, 4),
    month: MONTH_NAMES[d.getUTCMonth()] ?? '',
    week: isoWeekNumber(iso),
    day: DAY_NAMES[d.getUTCDay()] ?? '',
  }
}

function padDate(year: string, month: string, day: string): string | null {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const check = new Date(iso + 'T12:00:00Z')
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) return null
  return iso
}

function excelSerialToIso(serial: number): string | null {
  if (serial < 20000 || serial > 80000) return null
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

function dateToIso(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null
  const midnightUtc =
    value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0
  if (midnightUtc) return value.toISOString().slice(0, 10)
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseFlexibleDate(value: unknown): string | null {
  if (value instanceof Date) return dateToIso(value)
  if (typeof value === 'number' && Number.isFinite(value)) return excelSerialToIso(value)
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return padDate(iso[1], iso[2], iso[3])

  const zh = /^(\d{4})年(\d{1,2})月(\d{1,2})日?/.exec(text)
  if (zh) return padDate(zh[1], zh[2], zh[3])

  const ymd = /^(\d{4})[./](\d{1,2})[./](\d{1,2})/.exec(text)
  if (ymd) return padDate(ymd[1], ymd[2], ymd[3])

  if (/^\d{5,6}(\.0+)?$/.test(text)) return excelSerialToIso(Number(text))

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  if (compact) return padDate(compact[1], compact[2], compact[3])

  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(text)
  if (dmy) {
    const first = Number(dmy[1])
    const second = Number(dmy[2])
    if (first > 12) return padDate(dmy[3], dmy[2], dmy[1])
    if (second > 12) return padDate(dmy[3], dmy[1], dmy[2])
    return padDate(dmy[3], dmy[2], dmy[1])
  }
  return null
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  let text = value.normalize('NFKC').trim()
  if (!text || text === '-' || text === '—') return null
  let negative = false
  if (text.startsWith('(') && text.endsWith(')')) {
    negative = true
    text = text.slice(1, -1).trim()
  }
  text = text.replace(/^[¥￥$€£]|hk\$|hkd/gi, '').replace(/,/g, '').trim()
  if (!text) return null
  const n = Number(text)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

function textValue(value: unknown): string | null {
  if (value == null || value instanceof Date) return null
  const text = String(value).trim()
  if (!text || text.toLowerCase() === 'null' || text === '-') return null
  return text
}

function isTotalLabel(value: string | null): boolean {
  if (!value) return false
  return /^(合计|总计|小计|total|grand total)$/i.test(value.trim())
}

function recordToLineItem(
  record: Record<string, unknown>,
  sourceDefault: string,
): LineItem | null {
  const date = parseFlexibleDate(record.date)
  const quantity = parseNumber(record.quantity) ?? 0
  const unitPrice = parseNumber(record.unitPrice) ?? 0
  let total = parseNumber(record.totalAmount)
  if (total == null && (record.quantity != null || record.unitPrice != null)) {
    if (parseNumber(record.quantity) != null && parseNumber(record.unitPrice) != null) {
      total = quantity * unitPrice
    }
  }
  if (!date || total == null) return null

  const invoice = textValue(record.invoice) ?? ''
  const tradingPartner = textValue(record.tradingPartner)
  // Kingdee invoice lists name the buyer in 往来单位 and often leave 客户 empty.
  const customer = textValue(record.customer) ?? tradingPartner
  if (isTotalLabel(invoice) || isTotalLabel(customer)) return null

  const parts = calendarParts(date)
  const productName = textValue(record.productName)
  return {
    source: textValue(record.source) ?? sourceDefault,
    invoice,
    tradingPartner,
    customer,
    date,
    year: parts.year,
    month: parts.month,
    week: parts.week,
    day: parts.day,
    department: textValue(record.department),
    salesperson: textValue(record.salesperson),
    sku: textValue(record.sku),
    productModel: textValue(record.productModel),
    category: textValue(record.category),
    quantity,
    unitPrice,
    totalAmount: total,
    productName: productName ? productName.slice(0, 120) : null,
    customerCode: textValue(record.customerCode),
  }
}

export function ingestRecords(
  records: Record<string, unknown>[],
  opts?: { source?: string },
): IngestResult {
  const sourceDefault = opts?.source ?? 'import'
  const lineItems: LineItem[] = []
  let skipped = 0
  let missingSalesperson = 0

  for (const raw of records) {
    const record = normalizeRecordKeys(raw)
    const item = recordToLineItem(record, sourceDefault)
    if (!item) {
      skipped += 1
      continue
    }
    if (!item.salesperson) missingSalesperson += 1
    lineItems.push(item)
  }

  if (lineItems.length === 0) {
    const sample = records
      .slice(0, 3)
      .map((raw) => textValue(normalizeRecordKeys(raw).date))
      .filter((value): value is string => Boolean(value))
    throw new Error(
      sample.length
        ? `No usable rows (${skipped} skipped). Could not read a date and amount (first date value: “${sample[0]}”).`
        : `No usable rows${skipped ? ` (${skipped} skipped)` : ''}. Each row needs a date and an amount, or quantity × unit price.`,
    )
  }

  const warnings: string[] = []
  if (skipped > 0) {
    warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} skipped (missing date or amount).`)
  }
  if (missingSalesperson > 0 && missingSalesperson < lineItems.length) {
    warnings.push(
      `${missingSalesperson} row${missingSalesperson === 1 ? '' : 's'} have no salesperson.`,
    )
  }
  return { lineItems, warnings, skipped }
}

export function lineKey(row: LineItem): string {
  const num = (value: number) => String(Math.round((value || 0) * 1000) / 1000)
  return [
    row.invoice,
    row.sku ?? '',
    row.date ?? '',
    num(row.quantity),
    num(row.totalAmount),
    row.customer ?? '',
  ].join('\u001f')
}

/**
 * Map Kingdee 往来单位 (tradingPartner) → preferred customer label from rows that
 * already carry a short alias (seed: Vision, ADDL, CTM, …). Used on Merge so new
 * invoice lines that only have the full partner name join the same buyer.
 */
export function buildPartnerAliases(items: LineItem[]): Map<string, string> {
  const tallies = new Map<string, Map<string, number>>()
  for (const row of items) {
    const partner = row.tradingPartner?.trim()
    const customer = row.customer?.trim()
    if (!partner || !customer) continue
    let counts = tallies.get(partner)
    if (!counts) {
      counts = new Map()
      tallies.set(partner, counts)
    }
    counts.set(customer, (counts.get(customer) ?? 0) + 1)
  }
  const aliases = new Map<string, string>()
  for (const [partner, counts] of tallies) {
    const ranked = [...counts.entries()].sort((a, b) => {
      const aIsAlias = a[0] !== partner ? 1 : 0
      const bIsAlias = b[0] !== partner ? 1 : 0
      if (bIsAlias !== aIsAlias) return bIsAlias - aIsAlias
      // Prefer short English brand labels (Vision, ADDL, CTM) over longer forms.
      const latin = (name: string) => (name.match(/[A-Za-z]/g) ?? []).length
      const aLatin = latin(a[0]) / Math.max(a[0].length, 1)
      const bLatin = latin(b[0]) / Math.max(b[0].length, 1)
      if (bLatin !== aLatin) return bLatin > aLatin ? 1 : -1
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].length - b[0].length
    })
    const chosen = ranked[0]?.[0]
    if (chosen && chosen !== partner) aliases.set(partner, chosen)
  }
  return aliases
}

/** Prefer the known alias when customer is empty or still the raw 往来单位 string. */
export function applyPartnerAlias(row: LineItem, aliases: Map<string, string>): LineItem {
  const partner = row.tradingPartner?.trim()
  if (!partner) return row
  const alias = aliases.get(partner)
  if (!alias) return row
  if (!row.customer || row.customer === partner) {
    if (row.customer === alias) return row
    return { ...row, customer: alias }
  }
  return row
}

export function mergeImportedItems(
  existing: LineItem[],
  incoming: LineItem[],
  mode: ImportMode,
): { lineItems: LineItem[]; added: number; replaced: number } {
  if (mode === 'replace') {
    return { lineItems: incoming, added: incoming.length, replaced: 0 }
  }
  // Rematch onto wGAL Trading Partner → Customer Name (165 pairs), then fill any
  // gaps from seed tallies so Monthly top customers stay on short brands (Vision).
  const aliases = new Map<string, string>([
    ...buildPartnerAliases(existing),
    ...Object.entries(WGAL_PARTNER_ALIASES),
  ])
  const normalizedExisting = existing.map((row) => applyPartnerAlias(row, aliases))
  const normalizedIncoming = incoming.map((row) => applyPartnerAlias(row, aliases))
  const map = new Map<string, LineItem>()
  for (const row of normalizedExisting) map.set(lineKey(row), row)
  let added = 0
  let replaced = 0
  for (const row of normalizedIncoming) {
    const key = lineKey(row)
    if (map.has(key)) replaced += 1
    else added += 1
    map.set(key, row)
  }
  return { lineItems: [...map.values()], added, replaced }
}
