import { roundDollars } from '@/lib/money'

interface AllocationLike {
  allocatedAmount: number
}

interface EntryLike {
  id: string
  name: string
  estimatedAmount: number
  allocations: AllocationLike[]
}

interface CategoryLike {
  id: string
  name: string
  budgetEntries: EntryLike[]
}

export interface GapEntry {
  id: string
  name: string
  estimatedAmount: number
  allocated: number
  gap: number
}

export interface GapCategory {
  id: string
  name: string
  entries: GapEntry[]
  estimatedAmount: number
  allocated: number
  gap: number
}

export interface FundingGapReport {
  categories: GapCategory[]
  totalEstimated: number
  totalAllocated: number
  totalGap: number
  /** Count of line items allocated more than their estimate. */
  overAllocatedCount: number
  /** Total amount by which over-allocated items exceed their estimate (positive). */
  overAllocatedAmount: number
  /**
   * The project's net funding gap: gross gap minus over-allocations. Equals
   * `totalGap` when nothing is over-allocated; lower (or negative, a surplus)
   * when over-allocations offset the shortfall.
   */
  netGap: number
}

/**
 * The funding shortfall for a single budget entry: estimated cost minus the
 * total allocated from funding sources. Rounded to whole dollars (the display
 * unit) so sub-dollar residuals don't read as a spurious gap. A positive value
 * means the line item is under-funded and contributes to the project's gap.
 */
export function entryGap(entry: { estimatedAmount: number; allocations: AllocationLike[] }): number {
  const allocated = entry.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
  return roundDollars(entry.estimatedAmount - allocated)
}

/**
 * Identify the line items that contribute to the project's funding gap — those
 * whose estimated cost exceeds their allocations. Entries are grouped by
 * category; categories with no contributing entries are omitted. Totals reflect
 * only the contributing entries, so `totalGap` answers "what makes up the gap?".
 */
export function computeFundingGap(categories: CategoryLike[]): FundingGapReport {
  const gapCategories: GapCategory[] = []
  let overAllocatedCount = 0
  let overAllocatedAmount = 0

  for (const category of categories) {
    const entries: GapEntry[] = []
    for (const entry of category.budgetEntries) {
      const allocated = entry.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
      const gap = roundDollars(entry.estimatedAmount - allocated)
      if (gap > 0) {
        entries.push({ id: entry.id, name: entry.name, estimatedAmount: entry.estimatedAmount, allocated, gap })
      } else if (gap < 0) {
        overAllocatedCount += 1
        overAllocatedAmount += -gap
      }
    }
    if (entries.length > 0) {
      gapCategories.push({
        id: category.id,
        name: category.name,
        entries,
        estimatedAmount: entries.reduce((s, e) => s + e.estimatedAmount, 0),
        allocated: entries.reduce((s, e) => s + e.allocated, 0),
        gap: entries.reduce((s, e) => s + e.gap, 0),
      })
    }
  }

  const totalGap = gapCategories.reduce((s, c) => s + c.gap, 0)

  return {
    categories: gapCategories,
    totalEstimated: gapCategories.reduce((s, c) => s + c.estimatedAmount, 0),
    totalAllocated: gapCategories.reduce((s, c) => s + c.allocated, 0),
    totalGap,
    overAllocatedCount,
    overAllocatedAmount,
    netGap: roundDollars(totalGap - overAllocatedAmount),
  }
}
