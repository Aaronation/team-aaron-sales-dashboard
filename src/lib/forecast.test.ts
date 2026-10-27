/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SPLITS, teamTargetForMonth } from './aggregates'
import { isWorkingDay } from './hkHolidays'
import {
  describePace,
  describeRunRate,
  forecastForReview,
  forecastScopeNote,
  paceLabel,
  reviewTarget,
  shareOfTargetLabel,
  workingDayForecast,
} from './forecast'
import type { Targets } from './types'

const targets: Targets = {
  annualTeamTarget: 3_500_000,
  year: 2026,
  splits: { 'Aaron Chang': 0.49, 'Kelvin Lai': 0.31, 'Kenny Ma': 0.2 },
}

describe('working-day pace and forecast', () => {
  it('treats month-to-date at the straight line as on track, and just under as behind', () => {
    const onTrack = workingDayForecast({
      target: 100,
      mtdRevenue: 50,
      elapsedWorkingDays: 10,
      totalWorkingDays: 20,
    })
    expect(onTrack.expectedMtd).toBe(50)
    expect(onTrack.forecast).toBe(100)
    expect(onTrack.pace).toBe('on-track')
    expect(paceLabel(onTrack.pace)).toBe('On track')

    const behind = workingDayForecast({
      target: 100,
      mtdRevenue: 49.99,
      elapsedWorkingDays: 10,
      totalWorkingDays: 20,
    })
    expect(behind.pace).toBe('behind')
    expect(paceLabel(behind.pace)).toBe('Behind')

    // Half a cent rounds onto the straight line.
    const rounded = workingDayForecast({
      target: 100,
      mtdRevenue: 49.995,
      elapsedWorkingDays: 10,
      totalWorkingDays: 20,
    })
    expect(rounded.pace).toBe('on-track')
  })

  it('withholds pace and forecast when the run-rate is not defined', () => {
    expect(
      workingDayForecast({
        target: 100,
        mtdRevenue: 0,
        elapsedWorkingDays: 0,
        totalWorkingDays: 20,
      }),
    ).toEqual({ expectedMtd: null, pace: null, forecast: null })

    const noTarget = workingDayForecast({
      target: 0,
      mtdRevenue: 10,
      elapsedWorkingDays: 2,
      totalWorkingDays: 4,
    })
    expect(noTarget.pace).toBeNull()
    expect(noTarget.expectedMtd).toBeNull()
    expect(noTarget.forecast).toBe(20)

    expect(
      workingDayForecast({
        target: Number.NaN,
        mtdRevenue: 1,
        elapsedWorkingDays: 1,
        totalWorkingDays: 2,
      }).forecast,
    ).toBeNull()
  })

  it('excludes the 2026 National Day and Chung Yeung holidays from October pace', () => {
    expect(isWorkingDay('2026-10-01')).toBe(false)
    expect(isWorkingDay('2026-10-02')).toBe(true)
    expect(isWorkingDay('2026-10-18')).toBe(false)
    expect(isWorkingDay('2026-10-19')).toBe(false)

    const payload = JSON.parse(readFileSync('public/data/sales-line-items.json', 'utf8')) as {
      lineItems: { date: string | null; totalAmount: number }[]
    }
    const through = '2026-10-18'
    const mtd = payload.lineItems
      .filter((row) => row.date != null && row.date >= '2026-10-01' && row.date <= through)
      .reduce((sum, row) => sum + row.totalAmount, 0)
    expect(mtd).toBeCloseTo(725_441.52, 2)

    const result = forecastForReview({
      monthKey: '2026-10',
      throughDate: through,
      mtdRevenue: mtd,
      target: 3_300_000,
    })
    expect(result.elapsedWorkingDays).toBe(11)
    expect(result.totalWorkingDays).toBe(20)
    expect(result.holidaysLoaded).toBe(true)
    expect(result.pace).toBe('behind')
    expect(result.expectedMtd).toBe(1_815_000)
    expect(result.forecast).toBeCloseTo((mtd / 11) * 20, 6)
    expect(describePace(result)).toBe('HK$725,442 is below the straight-line HK$1,815,000.')
    expect(describeRunRate(result, '10-18')).toBe('Working-day run-rate through 10-18 × 20 working days.')
    expect(shareOfTargetLabel(result.mtdRevenue, result.target)).toBe('22.0% of target')
  })

  it('projects the sample November rows through the review week', () => {
    const throughWeek = forecastForReview({
      monthKey: '2026-11',
      throughDate: '2026-11-08',
      mtdRevenue: 24_000,
      target: 3_200_000,
    })
    expect(throughWeek.elapsedWorkingDays).toBe(5)
    expect(throughWeek.totalWorkingDays).toBe(21)
    expect(throughWeek.pace).toBe('behind')
    expect(throughWeek.forecast).toBe(100_800)
    expect(describePace(throughWeek)).toBe('HK$24,000 is below the straight-line HK$761,905.')
    expect(shareOfTargetLabel(throughWeek.mtdRevenue, throughWeek.target)).toBe('0.8% of target')

    const throughReplace = forecastForReview({
      monthKey: '2026-11',
      throughDate: '2026-11-15',
      mtdRevenue: 30_000,
      target: 3_200_000,
    })
    expect(throughReplace.elapsedWorkingDays).toBe(10)
    expect(throughReplace.forecast).toBe(63_000)
    expect(describePace(throughReplace)).toBe('HK$30,000 is below the straight-line HK$1,523,810.')
    expect(shareOfTargetLabel(30_000, 3_200_000)).toBe('0.9% of target')
  })

  it('counts a year without a holiday list as Monday–Friday only', () => {
    const result = forecastForReview({
      monthKey: '2027-10',
      throughDate: '2027-10-04',
      mtdRevenue: 100,
      target: 1_000,
    })
    expect(result.holidaysLoaded).toBe(false)
    expect(result.elapsedWorkingDays).toBe(2)
  })
})

describe('review target', () => {
  it('uses Aaron’s 2026 monthly team targets and leaves the rep splits', () => {
    const sheet: Record<string, number> = {
      '2026-01': 2_800_000,
      '2026-02': 2_200_000,
      '2026-03': 2_700_000,
      '2026-04': 2_900_000,
      '2026-05': 2_800_000,
      '2026-06': 3_000_000,
      '2026-07': 3_500_000,
      '2026-08': 3_500_000,
      '2026-09': 3_300_000,
      '2026-10': 3_300_000,
      '2026-11': 3_200_000,
      '2026-12': 3_400_000,
    }
    for (const [month, amount] of Object.entries(sheet)) {
      expect(teamTargetForMonth(month, targets)).toBe(amount)
      expect(reviewTarget('all', month, targets)).toEqual({ label: 'Team target', amount })
    }
    expect(DEFAULT_SPLITS).toEqual({ 'Aaron Chang': 0.49, 'Kelvin Lai': 0.31, 'Kenny Ma': 0.2 })
    expect(reviewTarget('Aaron Chang', '2026-01', targets).amount).toBe(2_800_000 * 0.49)
    expect(reviewTarget('Aaron Chang', '2026-10', targets).amount).toBe(3_300_000 * 0.49)
  })

  it('uses the team month target, a rep split, or no target', () => {
    expect(reviewTarget('all', '2026-10', targets)).toEqual({ label: 'Team target', amount: 3_300_000 })
    expect(reviewTarget('Aaron Chang', '2026-10', targets)).toEqual({
      label: 'Aaron target',
      amount: 1_617_000,
    })
    expect(reviewTarget('Riley Cho', '2026-10', targets)).toEqual({ label: 'Target', amount: 0 })
    expect(reviewTarget('all', '2027-01', targets)).toEqual({ label: 'Team target', amount: 3_500_000 })
  })

  it('describes filter scope without resizing the target for department or search', () => {
    expect(forecastScopeNote({ salesperson: 'all', department: 'all', query: '' })).toBe(
      'Pace uses the team month target.',
    )
    expect(forecastScopeNote({ salesperson: 'Aaron Chang', department: 'KA', query: 'PX20' })).toBe(
      'Pace uses this salesperson’s split of the team month target when they have one. Department and search narrow month-to-date and leave that target as it is.',
    )
  })
})
