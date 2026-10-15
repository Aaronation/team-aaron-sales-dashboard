import type { Filters } from '../lib/types'
import { weekLabel } from '../lib/aggregates'

type Props = {
  filters: Filters
  weeks: string[]
  salespeople: string[]
  departments: string[]
  onChange: (next: Filters) => void
  rowCount: number
}

export function FilterBar({
  filters,
  weeks,
  salespeople,
  departments,
  onChange,
  rowCount,
}: Props) {
  return (
    <div className="filters">
      <label>
        <span>Review week</span>
        <select
          value={filters.weekKey}
          onChange={(e) => onChange({ ...filters, weekKey: e.target.value })}
        >
          {weeks.map((w) => (
            <option key={w} value={w}>
              {weekLabel(w)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Salesperson</span>
        <select
          value={filters.salesperson}
          onChange={(e) => onChange({ ...filters, salesperson: e.target.value })}
        >
          <option value="all">All reps</option>
          {salespeople.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Department</span>
        <select
          value={filters.department}
          onChange={(e) => onChange({ ...filters, department: e.target.value })}
        >
          <option value="all">All</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="filters__search">
        <span>Search</span>
        <input
          type="search"
          placeholder="Invoice, customer, SKU…"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
        />
      </label>
      <p className="filters__meta">{rowCount.toLocaleString()} lines this week</p>
    </div>
  )
}
