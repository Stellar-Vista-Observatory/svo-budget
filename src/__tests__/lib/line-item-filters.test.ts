import { applyLineItemFilter } from '@/lib/line-item-filters'

const categories = [
  {
    id: 'cat-a',
    name: 'Category A',
    totalBudget: 180,
    totalSpent: 30,
    totalAllocated: 110,
    budgetEntries: [
      { estimatedAmount: 100, bidStatus: 'bid' as const, allocations: [{ allocatedAmount: 60 }] },
      { estimatedAmount: 50, bidStatus: 'not_bid' as const, allocations: [{ allocatedAmount: 50 }] },
      { estimatedAmount: 30, bidStatus: null, allocations: [] },
    ],
    actuals: [
      { amount: 20, bidStatus: 'bid' as const },
      { amount: 10, bidStatus: 'not_bid' as const },
    ],
  },
  {
    id: 'cat-b',
    name: 'Category B',
    totalBudget: 200,
    totalSpent: 5,
    totalAllocated: 200,
    budgetEntries: [
      { estimatedAmount: 200, bidStatus: 'bid' as const, allocations: [{ allocatedAmount: 200 }] },
    ],
    actuals: [
      { amount: 5, bidStatus: 'not_bid' as const },
    ],
  },
  {
    id: 'cat-c',
    name: 'Category C',
    totalBudget: 10,
    totalSpent: 5,
    totalAllocated: 10,
    budgetEntries: [
      { estimatedAmount: 10, bidStatus: 'bid' as const, allocations: [{ allocatedAmount: 10 }] },
    ],
    actuals: [
      { amount: 5, bidStatus: 'bid' as const },
    ],
  },
]

describe('applyLineItemFilter', () => {
  it('returns categories unchanged for mode "none"', () => {
    expect(applyLineItemFilter(categories, 'none')).toBe(categories)
  })

  describe('mode "gap"', () => {
    const result = applyLineItemFilter(categories, 'gap')

    it('keeps only entries whose estimate exceeds allocations', () => {
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cat-a')
      expect(result[0].budgetEntries.map((e) => e.estimatedAmount)).toEqual([100, 30])
    })

    it('clears actuals and zeroes totalSpent', () => {
      expect(result[0].actuals).toEqual([])
      expect(result[0].totalSpent).toBe(0)
    })

    it('recomputes totals from the remaining entries', () => {
      expect(result[0].totalBudget).toBe(130)
      expect(result[0].totalAllocated).toBe(60)
    })

    it('drops categories with no gap entries', () => {
      expect(result.map((c) => c.id)).not.toContain('cat-b')
      expect(result.map((c) => c.id)).not.toContain('cat-c')
    })
  })

  describe('mode "bid"', () => {
    const result = applyLineItemFilter(categories, 'bid')

    it('keeps budget entries and actuals with bidStatus "bid"', () => {
      const a = result.find((c) => c.id === 'cat-a')!
      expect(a.budgetEntries.map((e) => e.estimatedAmount)).toEqual([100])
      expect(a.actuals.map((x) => x.amount)).toEqual([20])
    })

    it('recomputes totals from the filtered rows', () => {
      const a = result.find((c) => c.id === 'cat-a')!
      expect(a.totalBudget).toBe(100)
      expect(a.totalAllocated).toBe(60)
      expect(a.totalSpent).toBe(20)
    })

    it('keeps categories with matching entries even if no actuals match', () => {
      const b = result.find((c) => c.id === 'cat-b')!
      expect(b.budgetEntries).toHaveLength(1)
      expect(b.actuals).toEqual([])
      expect(b.totalSpent).toBe(0)
    })
  })

  describe('mode "not_bid"', () => {
    const result = applyLineItemFilter(categories, 'not_bid')

    it('keeps budget entries and actuals with bidStatus "not_bid"', () => {
      const a = result.find((c) => c.id === 'cat-a')!
      expect(a.budgetEntries.map((e) => e.estimatedAmount)).toEqual([50])
      expect(a.actuals.map((x) => x.amount)).toEqual([10])
      expect(a.totalBudget).toBe(50)
      expect(a.totalAllocated).toBe(50)
      expect(a.totalSpent).toBe(10)
    })

    it('keeps a category that has only matching actuals (no entries)', () => {
      const b = result.find((c) => c.id === 'cat-b')!
      expect(b.budgetEntries).toEqual([])
      expect(b.actuals).toHaveLength(1)
      expect(b.totalBudget).toBe(0)
      expect(b.totalSpent).toBe(5)
    })

    it('drops categories with neither matching entries nor actuals', () => {
      expect(result.map((c) => c.id)).not.toContain('cat-c')
    })
  })
})
