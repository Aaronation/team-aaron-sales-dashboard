/**
 * Hong Kong general holidays other than Sundays.
 * Sundays are already excluded because a working day is Monday–Friday.
 *
 * Source: GovHK “General holidays for 2026”, gazetted 16 May 2025
 * (Government Information Services notice, https://www.info.gov.hk/gia/general/202505/16/P2025051300354.htm
 * and https://www.gov.hk/en/about/abouthk/holiday/2026.htm).
 *
 * The seeded and sample sales data are 2026. To cover another year, add that
 * year’s ISO dates from the matching GovHK page under HK_PUBLIC_HOLIDAYS.
 * Years without an entry are Monday–Friday only — no holidays are guessed.
 */
export const HK_PUBLIC_HOLIDAYS: Record<string, readonly string[]> = {
  '2026': [
    '2026-01-01', // New Year’s Day
    '2026-02-17', // Lunar New Year’s Day
    '2026-02-18', // Second day of Lunar New Year
    '2026-02-19', // Third day of Lunar New Year
    '2026-04-03', // Good Friday
    '2026-04-04', // Day following Good Friday
    '2026-04-06', // Day following Ching Ming Festival
    '2026-04-07', // Day following Easter Monday
    '2026-05-01', // Labour Day
    '2026-05-25', // Day following the Birthday of the Buddha
    '2026-06-19', // Tuen Ng Festival
    '2026-07-01', // HKSAR Establishment Day
    '2026-09-26', // Day following the Chinese Mid-Autumn Festival
    '2026-10-01', // National Day
    '2026-10-19', // Day following Chung Yeung Festival
    '2026-12-25', // Christmas Day
    '2026-12-26', // First weekday after Christmas Day
  ],
}

const HOLIDAYS = new Set(Object.values(HK_PUBLIC_HOLIDAYS).flat())

export function hkHolidaysLoaded(year: string): boolean {
  return HK_PUBLIC_HOLIDAYS[year] != null
}

export function isHkPublicHoliday(isoDate: string): boolean {
  return HOLIDAYS.has(isoDate)
}

/** Monday–Friday, and not a gazetted Hong Kong general holiday. */
export function isWorkingDay(isoDate: string): boolean {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay()
  if (day === 0 || day === 6) return false
  return !isHkPublicHoliday(isoDate)
}

function monthEnd(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${monthKey}-${String(last).padStart(2, '0')}`
}

function eachDate(start: string, end: string): string[] {
  if (end < start) return []
  const dates: string[] = []
  const cursor = new Date(`${start}T12:00:00Z`)
  const last = new Date(`${end}T12:00:00Z`)
  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

export function countWorkingDays(start: string, end: string): number {
  return eachDate(start, end).filter(isWorkingDay).length
}

export type MtdWorkingDays = {
  elapsed: number
  total: number
  holidaysLoaded: boolean
  /**
   * Calendar date elapsed days are counted through.
   * Null when the review month has no entries.
   */
  through: string | null
}

/**
 * MTD working days for a review month.
 *
 * `throughDate` is the existing MTD ceiling: the end of the selected review week,
 * clamped to the month. Elapsed days stop at the latest entry date in that month
 * when that date is earlier, so a week that runs past the imported book does not
 * count days with no entries. The total stays every working day in the month.
 * No entries in the month means nothing has elapsed.
 */
export function mtdWorkingDays(
  monthKey: string,
  throughDate: string,
  entryDates: readonly (string | null | undefined)[],
): MtdWorkingDays {
  const start = `${monthKey}-01`
  const end = monthEnd(monthKey)
  const weekThrough = throughDate < start ? start : throughDate > end ? end : throughDate
  let latest: string | null = null
  for (const date of entryDates) {
    if (!date || date < start || date > end) continue
    if (latest == null || date > latest) latest = date
  }
  const through = latest == null ? null : latest < weekThrough ? latest : weekThrough
  return {
    elapsed: through == null ? 0 : countWorkingDays(start, through),
    total: countWorkingDays(start, end),
    holidaysLoaded: hkHolidaysLoaded(monthKey.slice(0, 4)),
    through,
  }
}
