export const INK = '#3D342C'
export const TAUPE = '#866C5A'
/** Soft olive for fills, borders, and bars. Not for text on cream. */
export const OLIVE = '#9AAB78'
export const AMBER = '#E0B44A'
/** Clay for bars and rules. Down text uses a darker clay in CSS. */
export const CLAY = '#D8853F'
export const SAGE = '#DFCF99'
export const CREAM = '#F3EAD8'
export const GRID = 'rgba(61, 52, 44, 0.08)'

/** Same order as the sell-out pie slices and the share list. */
export const SLICE_COLORS = [
  OLIVE,
  TAUPE,
  AMBER,
  CLAY,
  SAGE,
  '#B7C49A',
  '#C4A36A',
  CREAM,
]

/** Slice fills light enough that the percent label is ink, not white. */
export const LIGHT_SLICE_FILLS = new Set(
  [OLIVE, AMBER, CLAY, SAGE, CREAM].map((color) => color.toLowerCase()),
)

/** Clay bar used for customer charts when every salesperson is in view. */
export const ALL_REPS_CUSTOMER_BAR = CLAY

/** Amber bar used for the SKU chart when every salesperson is in view. */
export const ALL_REPS_SKU_BAR = AMBER

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
