import { entryGap, computeFundingGap } from '@/lib/funding-gap'

const categories = [
  {
    id: 'cat-1',
    name: 'Framing',
    budgetEntries: [
      // gap: 1000 - 600 = 400
      { id: 'e-1', name: 'Lumber', estimatedAmount: 1000, allocations: [{ allocatedAmount: 400 }, { allocatedAmount: 200 }] },
      // fully funded: no gap
      { id: 'e-2', name: 'Nails', estimatedAmount: 50, allocations: [{ allocatedAmount: 50 }] },
    ],
  },
  {
    id: 'cat-2',
    name: 'Roofing',
    budgetEntries: [
      // gap: 800 - 0 = 800 (no allocations)
      { id: 'e-3', name: 'Shingles', estimatedAmount: 800, allocations: [] },
    ],
  },
  {
    id: 'cat-3',
    name: 'Overfunded',
    budgetEntries: [
      // over-allocated: estimated < allocated → not a gap contributor
      { id: 'e-4', name: 'Extra', estimatedAmount: 100, allocations: [{ allocatedAmount: 150 }] },
    ],
  },
]

describe('entryGap', () => {
  it('returns estimated minus total allocated', () => {
    expect(entryGap(categories[0].budgetEntries[0])).toBe(400)
    expect(entryGap(categories[1].budgetEntries[0])).toBe(800)
  })

  it('returns zero when fully funded', () => {
    expect(entryGap(categories[0].budgetEntries[1])).toBe(0)
  })

  it('returns a negative value when over-allocated', () => {
    expect(entryGap(categories[2].budgetEntries[0])).toBe(-50)
  })

  it('collapses sub-dollar residuals to zero', () => {
    expect(entryGap({ estimatedAmount: 1000, allocations: [{ allocatedAmount: 999.7 }] })).toBe(0)
  })
})

describe('computeFundingGap', () => {
  it('includes only entries that contribute to the gap (gap > 0)', () => {
    const report = computeFundingGap(categories)
    const ids = report.categories.flatMap((c) => c.entries.map((e) => e.id))
    expect(ids).toEqual(['e-1', 'e-3'])
  })

  it('drops categories with no contributing entries', () => {
    const report = computeFundingGap(categories)
    expect(report.categories.map((c) => c.id)).toEqual(['cat-1', 'cat-2'])
  })

  it('reports per-entry estimated, allocated and gap', () => {
    const report = computeFundingGap(categories)
    expect(report.categories[0].entries[0]).toEqual({
      id: 'e-1',
      name: 'Lumber',
      estimatedAmount: 1000,
      allocated: 600,
      gap: 400,
    })
  })

  it('subtotals the gap per category', () => {
    const report = computeFundingGap(categories)
    expect(report.categories[0].gap).toBe(400)
    expect(report.categories[1].gap).toBe(800)
  })

  it('totals the overall funding gap from contributing entries', () => {
    const report = computeFundingGap(categories)
    expect(report.totalGap).toBe(1200)
    expect(report.totalEstimated).toBe(1800)
    expect(report.totalAllocated).toBe(600)
  })

  it('summarises over-allocated line items separately', () => {
    const report = computeFundingGap(categories)
    // e-4 is allocated 150 against a 100 estimate → over-allocated by 50.
    expect(report.overAllocatedCount).toBe(1)
    expect(report.overAllocatedAmount).toBe(50)
  })

  it('nets over-allocations against the gross gap for the project net gap', () => {
    const report = computeFundingGap(categories)
    expect(report.netGap).toBe(1200 - 50)
  })

  it('reports no over-allocation when every item is fully or under funded', () => {
    const report = computeFundingGap([categories[0], categories[1]])
    expect(report.overAllocatedCount).toBe(0)
    expect(report.overAllocatedAmount).toBe(0)
    expect(report.netGap).toBe(report.totalGap)
  })

  it('returns an empty gap list when nothing contributes but still reports over-allocation', () => {
    const report = computeFundingGap([categories[2]])
    expect(report.categories).toEqual([])
    expect(report.totalGap).toBe(0)
    expect(report.overAllocatedCount).toBe(1)
    expect(report.overAllocatedAmount).toBe(50)
    expect(report.netGap).toBe(-50)
  })

  it('handles no categories', () => {
    const report = computeFundingGap([])
    expect(report).toEqual({
      categories: [],
      totalEstimated: 0,
      totalAllocated: 0,
      totalGap: 0,
      overAllocatedCount: 0,
      overAllocatedAmount: 0,
      netGap: 0,
    })
  })
})
