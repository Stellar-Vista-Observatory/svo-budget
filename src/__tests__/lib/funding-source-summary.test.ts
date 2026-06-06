import { computeFundingSourceTotals } from '@/lib/funding-source-summary'

const categories = [
  {
    budgetEntries: [
      { allocations: [
        { fundingSourceId: 'fs-1', allocatedAmount: 100 },
        { fundingSourceId: 'fs-2', allocatedAmount: 50 },
      ] },
      { allocations: [
        { fundingSourceId: 'fs-1', allocatedAmount: 25 },
      ] },
    ],
    actuals: [
      { fundingSourceId: 'fs-1', amount: 40 },
      { fundingSourceId: null, amount: 999 },
    ],
  },
  {
    budgetEntries: [
      { allocations: [
        { fundingSourceId: 'fs-2', allocatedAmount: 200 },
      ] },
    ],
    actuals: [
      { fundingSourceId: 'fs-2', amount: 30 },
      { fundingSourceId: 'fs-2', amount: 5 },
    ],
  },
]

describe('computeFundingSourceTotals', () => {
  it('sums allocated and withdrawn per funding source across all categories', () => {
    const { rows } = computeFundingSourceTotals(categories, ['fs-1', 'fs-2'])
    expect(rows).toEqual([
      { id: 'fs-1', allocated: 125, withdrawn: 40 },
      { id: 'fs-2', allocated: 250, withdrawn: 35 },
    ])
  })

  it('ignores actuals with a null funding source', () => {
    const { rows } = computeFundingSourceTotals(categories, ['fs-1'])
    expect(rows[0].withdrawn).toBe(40)
  })

  it('returns grand totals across all funding sources', () => {
    const { totals } = computeFundingSourceTotals(categories, ['fs-1', 'fs-2'])
    expect(totals).toEqual({ allocated: 375, withdrawn: 75 })
  })

  it('returns zeros for a source with no activity', () => {
    const { rows } = computeFundingSourceTotals(categories, ['fs-3'])
    expect(rows[0]).toEqual({ id: 'fs-3', allocated: 0, withdrawn: 0 })
  })

  it('handles no categories', () => {
    const { rows, totals } = computeFundingSourceTotals([], ['fs-1'])
    expect(rows).toEqual([{ id: 'fs-1', allocated: 0, withdrawn: 0 }])
    expect(totals).toEqual({ allocated: 0, withdrawn: 0 })
  })
})
