import {
  ingestRecords,
  recordsFromMatrix,
  type IngestResult,
} from './ingest'

export type LoadedImport = IngestResult & { label: string }

const HEADER_PROBES = [
  'date',
  'business date',
  '日期',
  '金额',
  '价税合计',
  'tax-inclusive',
  'salesperson',
  '销售员',
  'total amount',
  'quantity',
  '数量',
  'invoice',
  'document number',
  '单据编号',
]

function textHeaderScore(text: string): number {
  const sample = text.slice(0, 2500).toLowerCase()
  let score = 0
  for (const probe of HEADER_PROBES) {
    if (sample.includes(probe)) score += 1
  }
  return score
}

function decodeCsvBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  let gb = ''
  try {
    gb = new TextDecoder('gb18030').decode(bytes)
  } catch {
    gb = ''
  }
  if (!gb || gb === utf8) return utf8
  const utfScore = textHeaderScore(utf8)
  const gbScore = textHeaderScore(gb)
  if (utf8.includes('\uFFFD') && gbScore >= utfScore) return gb
  if (gbScore > utfScore) return gb
  return utf8
}

function detectDelimiter(text: string): ',' | '\t' | ';' {
  const line = text.split(/\r?\n/).find((row) => row.trim()) ?? ''
  const counts = { ',': 0, '\t': 0, ';': 0 }
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        i += 1
        continue
      }
      quoted = !quoted
      continue
    }
    if (!quoted && (char === ',' || char === '\t' || char === ';')) counts[char] += 1
  }
  if (counts['\t'] > counts[','] && counts['\t'] >= counts[';']) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(source)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 1
          continue
        }
        quoted = false
        continue
      }
      cell += char
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === delimiter) {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell)
      cell = ''
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    if (row.some((value) => value.trim() !== '')) rows.push(row)
  }
  return rows
}

function extractJsonRecords(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    if (data.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
      return data as Record<string, unknown>[]
    }
    return null
  }
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  for (const key of ['lineItems', 'records', 'rows', 'data', 'items']) {
    if (key in obj) return extractJsonRecords(obj[key])
  }
  return null
}

function finish(
  records: Record<string, unknown>[],
  warnings: string[],
  label: string,
): LoadedImport {
  const ingested = ingestRecords(records, { source: 'import' })
  return {
    ...ingested,
    label,
    warnings: [...warnings, ...ingested.warnings],
  }
}

async function readExcel(file: File, label: string): Promise<LoadedImport> {
  let sheets: { sheet: string; data: unknown[][] }[]
  try {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const parsed = await readXlsxFile(file)
    sheets = parsed.map((sheet) => ({
      sheet: sheet.sheet,
      data: sheet.data as unknown[][],
    }))
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unreadable workbook'
    throw new Error(`Could not read that Excel file (${detail}). Export it as .xlsx or CSV.`)
  }
  if (sheets.length === 0) throw new Error('The workbook has no sheets.')

  let winner: { table: ReturnType<typeof recordsFromMatrix>; rank: number } | null = null
  let firstError: Error | null = null
  for (const sheet of sheets) {
    try {
      const table = recordsFromMatrix(sheet.data)
      let rank = table.fields.length
      if (table.fields.includes('date')) rank += 5
      if (table.fields.includes('totalAmount')) rank += 5
      const name = sheet.sheet.trim().toLowerCase()
      if (name === 'data' || name === '明细' || name === '销售明细') rank += 3
      if (!winner || rank > winner.rank) winner = { table, rank }
    } catch (error) {
      if (!firstError && error instanceof Error) firstError = error
    }
  }
  if (!winner) throw firstError ?? new Error('No sheet had a date and an amount column.')
  return finish(winner.table.records, winner.table.warnings, label)
}

/**
 * Read a user-supplied export into line items.
 * CSV (UTF-8 or GB18030), Excel .xlsx, or dashboard JSON.
 */
export async function readImportFile(file: File): Promise<LoadedImport> {
  const label = file.name || 'import'
  const lower = label.toLowerCase()

  if (lower.endsWith('.json')) {
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      throw new Error('That JSON file could not be parsed.')
    }
    const records = extractJsonRecords(data)
    if (!records) {
      throw new Error('JSON should be a dashboard payload ({ lineItems }) or an array of rows.')
    }
    return finish(records, [], label)
  }

  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()))
    const table = recordsFromMatrix(parseCsv(text))
    return finish(table.records, table.warnings, label)
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return readExcel(file, label)

  if (lower.endsWith('.xls')) {
    throw new Error('Legacy .xls is not supported. In Kingdee, export as .xlsx or CSV.')
  }

  throw new Error('Use a .csv, .xlsx, or .json file.')
}
