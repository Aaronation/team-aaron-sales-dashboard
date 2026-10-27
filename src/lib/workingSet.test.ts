/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { isoWeekKey } from './aggregates'
import type { Filters, LineItem, SalesPayload } from './types'
import {
  loadDashboard,
  parseStoredPayload,
  resetDashboard,
  saveFilters,
  saveImport,
  type WorkingSetStore,
} from './workingSet'

function line(date: string, invoice: string): LineItem {
  return {
    source: 'seed',
    invoice,
    tradingPartner: null,
    customer: 'ADDL',
    date,
    year: '2026',
    month: null,
    week: null,
    day: null,
    department: 'Galaxy',
    salesperson: 'Aaron Chang',
    sku: 'SKU',
    productModel: null,
    category: null,
    quantity: 1,
    unitPrice: 100,
    totalAmount: 100,
    productName: null,
    customerCode: null,
  }
}

function payload(items: LineItem[], generatedFrom = ['seed.json']): SalesPayload {
  return {
    meta: {
      generatedFrom,
      primaryPeriod: '2026-10',
      mergedRows: items.length,
      targets: {
        annualTeamTarget: 3_500_000,
        year: 2026,
        splits: { 'Aaron Chang': 0.49 },
      },
    },
    lineItems: items,
  }
}

function memoryStore(): WorkingSetStore & { snapshot: () => { payload: unknown; filters: unknown } } {
  let storedPayload: unknown = null
  let storedFilters: unknown = null
  return {
    async readPayload() {
      return storedPayload
    },
    async writePayload(value) {
      storedPayload = value
    },
    readFilters() {
      return storedFilters
    },
    writeFilters(value) {
      storedFilters = value
    },
    async clear() {
      storedPayload = null
      storedFilters = null
    },
    snapshot: () => ({ payload: storedPayload, filters: storedFilters }),
  }
}

const october = isoWeekKey('2026-10-12')
const november = isoWeekKey('2026-11-12')

function filters(weekKey: string): Filters {
  return { weekKey, salesperson: 'all', department: 'all', query: '' }
}

describe('working set persistence', () => {
  it('loads the seed and does not write it when nothing is saved', async () => {
    const store = memoryStore()
    const seed = payload([line('2026-10-12', 'SEED')])
    const loadSeed = vi.fn(async () => seed)
    const loaded = await loadDashboard(store, loadSeed)
    expect(loaded.source).toBe('seed')
    expect(loaded.note).toBeNull()
    expect(loaded.filters.weekKey).toBe(october)
    expect(loadSeed).toHaveBeenCalledOnce()
    expect(store.snapshot()).toEqual({ payload: null, filters: null })
  })

  it('restores a saved import and its filters without reading the seed', async () => {
    const store = memoryStore()
    const seed = payload([line('2026-10-12', 'SEED')])
    const imported = payload(
      [line('2026-10-12', 'SEED'), line('2026-11-12', 'NOV')],
      ['seed.json', 'import:sample-kingdee-import.csv'],
    )
    const note = 'Merged sample-kingdee-import.csv: 1 added, 0 updated. 2 rows now.'
    await saveImport(store, imported, filters(october), note)

    const loadSeed = vi.fn(async () => seed)
    const loaded = await loadDashboard(store, loadSeed)
    expect(loadSeed).not.toHaveBeenCalled()
    expect(loaded.source).toBe('saved')
    expect(loaded.payload.lineItems.map((row) => row.invoice)).toEqual(['SEED', 'NOV'])
    expect(loaded.filters.weekKey).toBe(october)
    expect(loaded.note).toBe(note)
  })

  it('keeps a later filter change without rewriting the payload', async () => {
    const store = memoryStore()
    const imported = payload([line('2026-10-12', 'SEED'), line('2026-11-12', 'NOV')])
    await saveImport(store, imported, filters(october), 'merged')
    const payloadRecord = store.snapshot().payload
    saveFilters(store, filters(november))
    expect(store.snapshot().payload).toBe(payloadRecord)

    const loaded = await loadDashboard(store, async () => {
      throw new Error('seed should stay unread')
    })
    expect(loaded.filters.weekKey).toBe(november)
  })

  it('drops a saved week that the working set no longer contains', async () => {
    const store = memoryStore()
    const imported = payload([line('2026-11-12', 'NOV')])
    await saveImport(store, imported, filters(october), 'replaced')
    const loaded = await loadDashboard(store, async () => {
      throw new Error('seed should stay unread')
    })
    expect(loaded.filters.weekKey).toBe(november)
  })

  it('ignores filters when no payload is saved', async () => {
    const store = memoryStore()
    saveFilters(store, filters('1999-W01'))
    const seed = payload([line('2026-10-12', 'SEED')])
    const loaded = await loadDashboard(store, async () => seed)
    expect(loaded.source).toBe('seed')
    expect(loaded.filters.weekKey).toBe(october)
  })

  it('clears a corrupt save and falls back to the seed', async () => {
    const store = memoryStore()
    await store.writePayload({ version: 1, payload: { lineItems: 'nope' }, note: null } as never)
    const seed = payload([line('2026-10-12', 'SEED')])
    const loaded = await loadDashboard(store, async () => seed)
    expect(loaded.source).toBe('seed')
    expect(loaded.payload).toBe(seed)
    expect(store.snapshot()).toEqual({ payload: null, filters: null })
  })

  it('reset clears the save and the next load reads the seed', async () => {
    const store = memoryStore()
    const seed = payload([line('2026-10-12', 'SEED')])
    const imported = payload([line('2026-11-12', 'NOV')], ['import:sample.csv'])
    await saveImport(store, imported, filters(november), 'Replaced dashboard data.')
    const restored = await resetDashboard(store, async () => seed)
    expect(restored.source).toBe('seed')
    expect(restored.note).toBe('Restored the bundled seed data.')
    expect(restored.filters.weekKey).toBe(october)
    expect(store.snapshot()).toEqual({ payload: null, filters: null })

    const loadSeed = vi.fn(async () => seed)
    const again = await loadDashboard(store, loadSeed)
    expect(again.source).toBe('seed')
    expect(again.note).toBeNull()
    expect(loadSeed).toHaveBeenCalledOnce()
  })

  it('accepts the bundled seed file as a stored payload', () => {
    const bundled = JSON.parse(readFileSync('public/data/sales-line-items.json', 'utf8')) as SalesPayload
    const parsed = parseStoredPayload({ version: 1, payload: bundled, note: 'kept' })
    expect(parsed?.note).toBe('kept')
    expect(parsed?.payload.lineItems).toHaveLength(bundled.lineItems.length)
    expect(parseStoredPayload({ version: 2, payload: bundled, note: null })).toBeNull()
  })
})
