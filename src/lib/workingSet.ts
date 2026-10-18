import { initialFilters, reconcileFilters } from './filters'
import type { Filters, LineItem, SalesPayload } from './types'

export const WORKING_SET_VERSION = 1

const DB_NAME = 'team-aaron-review'
const DB_VERSION = 1
const STORE = 'working-set'
const PAYLOAD_KEY = 'payload'
const FILTERS_KEY = 'team-aaron-review:filters'

export type StoredPayload = {
  version: typeof WORKING_SET_VERSION
  payload: SalesPayload
  note: string | null
}

export type StoredSession = {
  version: typeof WORKING_SET_VERSION
  filters: Filters
}

/**
 * Payload lives in IndexedDB because a merged seed is several megabytes.
 * Filters live in localStorage so a week or search change is durable before the
 * next paint, without rewriting that payload on every keystroke.
 */
export type WorkingSetStore = {
  readPayload(): Promise<unknown>
  writePayload(value: StoredPayload): Promise<void>
  readFilters(): unknown
  writeFilters(value: StoredSession | null): void
  clear(): Promise<void>
}

export type LoadedDashboard = {
  payload: SalesPayload
  filters: Filters
  note: string | null
  source: 'saved' | 'seed'
}

function isLineItem(value: unknown): value is LineItem {
  if (!value || typeof value !== 'object') return false
  const row = value as LineItem
  return (
    typeof row.invoice === 'string' &&
    typeof row.quantity === 'number' &&
    Number.isFinite(row.quantity) &&
    typeof row.totalAmount === 'number' &&
    Number.isFinite(row.totalAmount) &&
    (row.date == null || typeof row.date === 'string')
  )
}

function isPayload(value: unknown): value is SalesPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as SalesPayload
  if (!payload.meta || typeof payload.meta !== 'object') return false
  if (!Array.isArray(payload.meta.generatedFrom)) return false
  if (!payload.meta.generatedFrom.every((item) => typeof item === 'string')) return false
  const targets = payload.meta.targets
  if (!targets || typeof targets !== 'object' || typeof targets.annualTeamTarget !== 'number') return false
  if (!Array.isArray(payload.lineItems)) return false
  return payload.lineItems.every(isLineItem)
}

function isFilters(value: unknown): value is Filters {
  if (!value || typeof value !== 'object') return false
  const filters = value as Filters
  return (
    typeof filters.weekKey === 'string' &&
    typeof filters.salesperson === 'string' &&
    typeof filters.department === 'string' &&
    typeof filters.query === 'string'
  )
}

export function parseStoredPayload(value: unknown): StoredPayload | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<StoredPayload>
  if (record.version !== WORKING_SET_VERSION) return null
  if (record.note != null && typeof record.note !== 'string') return null
  if (!isPayload(record.payload)) return null
  return {
    version: WORKING_SET_VERSION,
    payload: record.payload,
    note: record.note ?? null,
  }
}

export function parseStoredSession(value: unknown): StoredSession | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<StoredSession>
  if (record.version !== WORKING_SET_VERSION) return null
  if (!isFilters(record.filters)) return null
  return { version: WORKING_SET_VERSION, filters: record.filters }
}

export async function loadDashboard(
  store: WorkingSetStore,
  loadSeed: () => Promise<SalesPayload>,
): Promise<LoadedDashboard> {
  const raw = await store.readPayload()
  if (raw != null) {
    const parsed = parseStoredPayload(raw)
    if (!parsed) {
      await store.clear()
    } else {
      const session = parseStoredSession(store.readFilters())
      const filters = session
        ? reconcileFilters(session.filters, parsed.payload.lineItems)
        : initialFilters(parsed.payload.lineItems)
      return {
        payload: parsed.payload,
        filters,
        note: parsed.note,
        source: 'saved',
      }
    }
  }
  const payload = await loadSeed()
  return {
    payload,
    filters: initialFilters(payload.lineItems),
    note: null,
    source: 'seed',
  }
}

export async function saveImport(
  store: WorkingSetStore,
  payload: SalesPayload,
  filters: Filters,
  note: string | null,
): Promise<void> {
  // Payload first. A failed write leaves the previous filters beside the previous lines.
  await store.writePayload({ version: WORKING_SET_VERSION, payload, note })
  store.writeFilters({ version: WORKING_SET_VERSION, filters })
}

export function saveFilters(store: WorkingSetStore, filters: Filters): void {
  store.writeFilters({ version: WORKING_SET_VERSION, filters })
}

export async function resetDashboard(
  store: WorkingSetStore,
  loadSeed: () => Promise<SalesPayload>,
): Promise<LoadedDashboard> {
  const payload = await loadSeed()
  await store.clear()
  return {
    payload,
    filters: initialFilters(payload.lineItems),
    note: 'Restored the bundled seed data.',
    source: 'seed',
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed to open'))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, mode)
    const result = await run(tx.objectStore(STORE))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    })
    return result
  } finally {
    db.close()
  }
}

export function browserWorkingSetStore(): WorkingSetStore {
  return {
    async readPayload() {
      const value = await withStore('readonly', (store) => requestToPromise(store.get(PAYLOAD_KEY)))
      return value ?? null
    },
    async writePayload(value) {
      await withStore('readwrite', (store) => requestToPromise(store.put(value, PAYLOAD_KEY)))
    },
    readFilters() {
      if (typeof localStorage === 'undefined') return null
      try {
        const raw = localStorage.getItem(FILTERS_KEY)
        if (!raw) return null
        return JSON.parse(raw) as unknown
      } catch {
        return null
      }
    },
    writeFilters(value) {
      if (typeof localStorage === 'undefined') {
        throw new Error('localStorage is not available')
      }
      if (value == null) localStorage.removeItem(FILTERS_KEY)
      else localStorage.setItem(FILTERS_KEY, JSON.stringify(value))
    },
    async clear() {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(FILTERS_KEY)
      } catch {
        // The payload clear still drops the working set. Leftover filters are ignored without it.
      }
      await withStore('readwrite', (store) => requestToPromise(store.delete(PAYLOAD_KEY)))
    },
  }
}
