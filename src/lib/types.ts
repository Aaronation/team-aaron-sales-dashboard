export type LineItem = {
  source: string
  invoice: string
  tradingPartner: string | null
  customer: string | null
  date: string | null
  year: string | null
  month: string | null
  week: number | null
  day: string | null
  department: string | null
  salesperson: string | null
  sku: string | null
  productModel: string | null
  category: string | null
  quantity: number
  unitPrice: number
  totalAmount: number
  productName: string | null
  customerCode: string | null
}

export type Targets = {
  annualTeamTarget: number
  year: number
  splits: Record<string, number>
  monthlyTeam?: Record<string, number>
}

export type SalesPayload = {
  meta: {
    generatedFrom: string[]
    primaryPeriod: string
    mergedRows: number
    targets: Targets
    oct?: Record<string, unknown>
    aug?: Record<string, unknown>
  }
  lineItems: LineItem[]
}

/** Week-first filters for manager weekly review (deltas are MoM same-period). */
export type Filters = {
  weekKey: string // e.g. 2026-W41 or "all"
  salesperson: string
  department: string
  query: string
}
