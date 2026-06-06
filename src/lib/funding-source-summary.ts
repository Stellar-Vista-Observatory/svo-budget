export interface FundingSourceTotalRow {
  id: string
  allocated: number
  withdrawn: number
}

interface AllocationLike {
  fundingSourceId: string
  allocatedAmount: number
}

interface ActualLike {
  fundingSourceId: string | null
  amount: number
}

interface CategoryLike {
  budgetEntries: { allocations: AllocationLike[] }[]
  actuals: ActualLike[]
}

/**
 * Total allocated (from budget allocations) and withdrawn (from actuals) per
 * funding source, summed across the supplied categories. Scoped to whatever
 * categories are passed in (i.e. a single project's data).
 */
export function computeFundingSourceTotals(
  categories: CategoryLike[],
  fundingSourceIds: string[]
): { rows: FundingSourceTotalRow[]; totals: { allocated: number; withdrawn: number } } {
  const rows = fundingSourceIds.map((id) => {
    let allocated = 0
    let withdrawn = 0
    for (const category of categories) {
      for (const entry of category.budgetEntries) {
        for (const allocation of entry.allocations) {
          if (allocation.fundingSourceId === id) allocated += allocation.allocatedAmount
        }
      }
      for (const actual of category.actuals) {
        if (actual.fundingSourceId === id) withdrawn += actual.amount
      }
    }
    return { id, allocated, withdrawn }
  })

  const totals = rows.reduce(
    (acc, row) => ({ allocated: acc.allocated + row.allocated, withdrawn: acc.withdrawn + row.withdrawn }),
    { allocated: 0, withdrawn: 0 }
  )

  return { rows, totals }
}
