import { listWeekKeys, uniqueSorted } from './aggregates'
import type { Filters, LineItem } from './types'

export function initialFilters(items: LineItem[]): Filters {
  const weeks = listWeekKeys(items)
  return {
    weekKey: weeks[weeks.length - 1] ?? 'all',
    salesperson: 'all',
    department: 'all',
    query: '',
  }
}

export function reconcileFilters(filters: Filters, items: LineItem[]): Filters {
  const weeks = listWeekKeys(items)
  const salespeople = uniqueSorted(items.map((row) => row.salesperson))
  const departments = uniqueSorted(items.map((row) => row.department))
  let weekKey = filters.weekKey
  if (weekKey !== 'all' && !weeks.includes(weekKey)) {
    weekKey = weeks[weeks.length - 1] ?? 'all'
  }
  return {
    ...filters,
    weekKey,
    salesperson:
      filters.salesperson !== 'all' && !salespeople.includes(filters.salesperson)
        ? 'all'
        : filters.salesperson,
    department:
      filters.department !== 'all' && !departments.includes(filters.department)
        ? 'all'
        : filters.department,
  }
}
