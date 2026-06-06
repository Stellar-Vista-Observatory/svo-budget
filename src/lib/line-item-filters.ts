import { entryGap } from '@/lib/funding-gap'
import { type BidStatusValue } from '@/lib/bid-status'

export type LineItemFilterMode = 'none' | 'gap' | 'bid' | 'not_bid'

interface AllocationLike {
  allocatedAmount: number
}

interface EntryLike {
  estimatedAmount: number
  bidStatus: BidStatusValue
  allocations: AllocationLike[]
}

interface ActualLike {
  amount: number
  bidStatus: BidStatusValue
}

interface CategoryLike {
  id: string
  name: string
  totalBudget: number
  totalSpent: number
  totalAllocated: number
  budgetEntries: EntryLike[]
  actuals: ActualLike[]
}

function sumAllocations(entries: EntryLike[]): number {
  return entries.reduce((s, e) => s + e.allocations.reduce((a, alloc) => a + alloc.allocatedAmount, 0), 0)
}

function sumEstimates(entries: EntryLike[]): number {
  return entries.reduce((s, e) => s + e.estimatedAmount, 0)
}

/**
 * Filter the line-items table to a single view mode and recompute each
 * category's roll-up totals from the surviving rows. Returns the categories
 * unchanged for `'none'`; otherwise produces shallow copies so the caller's
 * data is never mutated. Categories left with nothing to show are dropped.
 *
 * - `'gap'`    — budget entries whose estimate exceeds their allocations
 *                (`entryGap > 0`); actuals are hidden since a funding gap is a
 *                budget-vs-allocation concern, so `totalSpent` is zeroed.
 * - `'bid'`    — entries and actuals with `bidStatus === 'bid'`.
 * - `'not_bid'`— entries and actuals with `bidStatus === 'not_bid'`.
 *
 * Generic over the concrete category type so callers keep their full row shape
 * (e.g. the table's `CategoryData`) on the returned objects.
 */
export function applyLineItemFilter<C extends CategoryLike>(categories: C[], mode: LineItemFilterMode): C[] {
  if (mode === 'none') return categories

  if (mode === 'gap') {
    return categories
      .map((cat) => {
        const budgetEntries = cat.budgetEntries.filter((e) => entryGap(e) > 0)
        return {
          ...cat,
          budgetEntries,
          actuals: [],
          totalBudget: sumEstimates(budgetEntries),
          totalAllocated: sumAllocations(budgetEntries),
          totalSpent: 0,
        }
      })
      .filter((cat) => cat.budgetEntries.length > 0)
  }

  const target: BidStatusValue = mode === 'bid' ? 'bid' : 'not_bid'
  return categories
    .map((cat) => {
      const budgetEntries = cat.budgetEntries.filter((e) => e.bidStatus === target)
      const actuals = cat.actuals.filter((a) => a.bidStatus === target)
      return {
        ...cat,
        budgetEntries,
        actuals,
        totalBudget: sumEstimates(budgetEntries),
        totalAllocated: sumAllocations(budgetEntries),
        totalSpent: actuals.reduce((s, a) => s + a.amount, 0),
      }
    })
    .filter((cat) => cat.budgetEntries.length > 0 || cat.actuals.length > 0)
}
