import { repMonthTarget, shortName, teamTargetForMonth, formatMoney } from './aggregates'
import { mtdWorkingDays } from './hkHolidays'
import type { Filters, Targets } from './types'

export type Pace = 'on-track' | 'behind'

export type WorkingDayForecast = {
  target: number
  mtdRevenue: number
  elapsedWorkingDays: number
  totalWorkingDays: number
  holidaysLoaded: boolean
  /** Latest entry in the month, not past the review-week ceiling. Null when that month has no entries. */
  elapsedThrough: string | null
  /** Target × elapsed / total working days. Null when pace cannot be judged. */
  expectedMtd: number | null
  pace: Pace | null
  /** MTD ÷ elapsed working days × working days in the month. */
  forecast: number | null
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

/**
 * Straight-line pace and a working-day run-rate forecast.
 * On track means month-to-date, in cents, is at or above the straight line to target.
 * Elapsed and total days must already exclude weekends and Hong Kong public holidays.
 */
export function workingDayForecast(input: {
  target: number
  mtdRevenue: number
  elapsedWorkingDays: number
  totalWorkingDays: number
}): Pick<WorkingDayForecast, 'expectedMtd' | 'pace' | 'forecast'> {
  const { target, mtdRevenue, elapsedWorkingDays, totalWorkingDays } = input
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(mtdRevenue) ||
    !finiteNonNegative(elapsedWorkingDays) ||
    !finiteNonNegative(totalWorkingDays)
  ) {
    return { expectedMtd: null, pace: null, forecast: null }
  }

  const canProject = elapsedWorkingDays > 0 && totalWorkingDays > 0
  const forecast = canProject ? (mtdRevenue / elapsedWorkingDays) * totalWorkingDays : null
  if (!canProject || target <= 0) return { expectedMtd: null, pace: null, forecast }

  const expectedMtd = (target * elapsedWorkingDays) / totalWorkingDays
  const pace =
    Math.round(mtdRevenue * 100) >= Math.round(expectedMtd * 100) ? 'on-track' : 'behind'
  return { expectedMtd, pace, forecast }
}

/** Pace and forecast for the review week’s month, using the same elapsed-day cap as the scorecard. */
export function forecastForReview(input: {
  monthKey: string
  throughDate: string
  entryDates: readonly (string | null | undefined)[]
  mtdRevenue: number
  target: number
}): WorkingDayForecast {
  const days = mtdWorkingDays(input.monthKey, input.throughDate, input.entryDates)
  const projected = workingDayForecast({
    target: input.target,
    mtdRevenue: input.mtdRevenue,
    elapsedWorkingDays: days.elapsed,
    totalWorkingDays: days.total,
  })
  return {
    target: input.target,
    mtdRevenue: input.mtdRevenue,
    elapsedWorkingDays: days.elapsed,
    totalWorkingDays: days.total,
    holidaysLoaded: days.holidaysLoaded,
    elapsedThrough: days.through,
    ...projected,
  }
}

/** Team target, or that rep’s split. Amount 0 means this rep has no split. */
export function reviewTarget(
  salesperson: string,
  monthKey: string,
  targets?: Targets,
): { label: string; amount: number } {
  if (salesperson === 'all') {
    return { label: 'Team target', amount: teamTargetForMonth(monthKey, targets) }
  }
  const split = repMonthTarget(salesperson, monthKey)
  if (split == null) return { label: 'Target', amount: 0 }
  return { label: `${shortName(salesperson)} target`, amount: split }
}

export function paceLabel(pace: Pace | null): string {
  if (pace === 'on-track') return 'On track'
  if (pace === 'behind') return 'Behind'
  return '—'
}

export function describePace(result: WorkingDayForecast): string {
  if (result.pace == null || result.expectedMtd == null) {
    return 'Pace needs a month target and at least one elapsed working day.'
  }
  const relation = result.pace === 'behind' ? 'below' : 'at or above'
  return `${formatMoney(result.mtdRevenue)} is ${relation} the straight-line ${formatMoney(result.expectedMtd)}.`
}

export function describeRunRate(result: WorkingDayForecast, throughLabel: string): string {
  if (result.forecast == null || result.totalWorkingDays <= 0) {
    return 'Forecast needs at least one elapsed working day.'
  }
  return `Working-day run-rate through ${throughLabel} × ${result.totalWorkingDays} working days.`
}

export function shareOfTargetLabel(mtdRevenue: number, target: number): string | null {
  if (!(target > 0) || !Number.isFinite(mtdRevenue)) return null
  return `${((mtdRevenue / target) * 100).toFixed(1)}% of target`
}

export function forecastScopeNote(filters: Pick<Filters, 'salesperson' | 'department' | 'query'>): string {
  const who =
    filters.salesperson === 'all'
      ? 'Pace uses the team month target.'
      : 'Pace uses this salesperson’s split of the team month target when they have one.'
  if (filters.department === 'all' && filters.query.trim().length === 0) return who
  return `${who} Department and search narrow month-to-date and leave that target as it is.`
}
