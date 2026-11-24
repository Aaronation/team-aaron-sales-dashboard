/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatCompactMoney, repMonthAchievements } from './aggregates'
import type { SalesPayload } from './types'

describe('compact money for Achieve by month', () => {
  it('rounds below $1.5m to the nearest thousand and $1.5m up to tenths of a million', () => {
    expect(formatCompactMoney(1_057_797)).toBe('$1,058k')
    expect(formatCompactMoney(1_023_000)).toBe('$1,023k')
    expect(formatCompactMoney(366_000)).toBe('$366k')
    expect(formatCompactMoney(440)).toBe('$0k')
    expect(formatCompactMoney(1_499_999)).toBe('$1,500k')
    expect(formatCompactMoney(1_500_000)).toBe('$1.5m')
    expect(formatCompactMoney(1_715_000)).toBe('$1.7m')
    expect(formatCompactMoney(1_617_000)).toBe('$1.6m')
    expect(formatCompactMoney(-320_400)).toBe('-$320k')
    expect(formatCompactMoney(Number.NaN)).toBe('—')
  })

  it('shows seed Aug–Oct achieve lines as actual / target for Aaron, Kelvin, and Kenny', () => {
    const payload = JSON.parse(readFileSync('public/data/sales-line-items.json', 'utf8')) as SalesPayload
    const rows = repMonthAchievements(payload.lineItems)
    const line = (name: string, monthKey: string) => {
      const month = rows.find((row) => row.name === name)?.months.find((item) => item.monthKey === monthKey)
      const rate = month?.achieve == null ? '—' : `${(month.achieve * 100).toFixed(1)}%`
      const actual = formatCompactMoney(month?.revenue ?? 0)
      const target = month?.target == null ? 'no target' : formatCompactMoney(month.target)
      return `${rate} ${actual} / ${target}`
    }

    expect(line('Aaron Chang', '2026-08')).toBe('61.7% $1,058k / $1.7m')
    expect(line('Aaron Chang', '2026-09')).toBe('80.0% $1,293k / $1.6m')
    expect(line('Aaron Chang', '2026-10')).toBe('22.6% $366k / $1.6m')
    expect(line('Kelvin Lai', '2026-08')).toBe('49.3% $535k / $1,085k')
    expect(line('Kelvin Lai', '2026-09')).toBe('92.0% $941k / $1,023k')
    expect(line('Kelvin Lai', '2026-10')).toBe('22.0% $225k / $1,023k')
    expect(line('Kenny Ma', '2026-08')).toBe('45.7% $320k / $700k')
    expect(line('Kenny Ma', '2026-09')).toBe('53.1% $350k / $660k')
    expect(line('Kenny Ma', '2026-10')).toBe('20.5% $135k / $660k')
    expect(line('Unassigned', '2026-10')).toMatch(/\$[\d,]+k \/ no target$/)
  })
})
