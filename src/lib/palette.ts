/** Same order as the sell-out pie slices and the share list. */
export const SLICE_COLORS = [
  '#9AAB78',
  '#866C5A',
  '#E0B44A',
  '#D8853F',
  '#DFCF99',
  '#b7c49a',
  '#c4a36a',
  '#F3EAD8',
]

/** Clay bar used for customer charts when every salesperson is in view. */
export const ALL_REPS_CUSTOMER_BAR = '#D8853F'

/** Amber bar used for the SKU chart when every salesperson is in view. */
export const ALL_REPS_SKU_BAR = '#E0B44A'

export function sliceColorAt(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length]
}

/**
 * Bar color for a selected salesperson. Index matches the pie: revenue above zero,
 * highest sell-out first.
 */
export function customerBarColor(
  shares: { name: string; revenue: number }[],
  salesperson: string,
  fallback = ALL_REPS_CUSTOMER_BAR,
): string {
  if (salesperson === 'all') return fallback
  const index = shares.filter((share) => share.revenue > 0).findIndex((share) => share.name === salesperson)
  if (index < 0) return fallback
  return sliceColorAt(index)
}
