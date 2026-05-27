describe('overspent calculation', () => {
  it('returns negative remaining when actuals exceed budget', () => {
    const totalBudget = 12700
    const totalSpent = 16700
    expect(totalBudget - totalSpent).toBe(-4000)
  })

  it('returns positive remaining when under budget', () => {
    const totalBudget = 66000
    const totalSpent = 39932
    expect(totalBudget - totalSpent).toBe(26068)
  })

  it('returns zero when exactly on budget', () => {
    const totalBudget = 10000
    const totalSpent = 10000
    expect(totalBudget - totalSpent).toBe(0)
  })
})

function fsActuals(actuals: { fundingSourceId: string | null; amount: number }[], fsId: string): number {
  return actuals.filter((a) => a.fundingSourceId === fsId).reduce((s, a) => s + a.amount, 0)
}

function fsAllocated(entries: { allocations: { fundingSourceId: string; allocatedAmount: number }[] }[], fsId: string): number {
  return entries.reduce(
    (s, e) => s + (e.allocations.find((a) => a.fundingSourceId === fsId)?.allocatedAmount ?? 0), 0
  )
}

describe('per-source remaining calculation', () => {
  const entries = [
    { allocations: [{ fundingSourceId: 'fs-1', allocatedAmount: 25000 }] },
    { allocations: [{ fundingSourceId: 'fs-2', allocatedAmount: 5000 }] },
  ]
  const actuals = [
    { fundingSourceId: 'fs-1', amount: 29000 },
    { fundingSourceId: 'fs-2', amount: 1000 },
    { fundingSourceId: null, amount: 500 },
  ]

  it('sums actuals for a given funding source', () => {
    expect(fsActuals(actuals, 'fs-1')).toBe(29000)
    expect(fsActuals(actuals, 'fs-2')).toBe(1000)
  })

  it('ignores actuals with no funding source when computing per-source total', () => {
    expect(fsActuals(actuals, 'fs-1')).toBe(29000)
  })

  it('sums allocations for a given funding source across all entries', () => {
    expect(fsAllocated(entries, 'fs-1')).toBe(25000)
    expect(fsAllocated(entries, 'fs-2')).toBe(5000)
  })

  it('detects overspent when actuals exceed allocated', () => {
    const remaining = fsAllocated(entries, 'fs-1') - fsActuals(actuals, 'fs-1')
    expect(remaining).toBe(-4000)
    expect(remaining < 0).toBe(true)
  })

  it('detects under budget when actuals are below allocated', () => {
    const remaining = fsAllocated(entries, 'fs-2') - fsActuals(actuals, 'fs-2')
    expect(remaining).toBe(4000)
    expect(remaining < 0).toBe(false)
  })

  it('returns zero for a source with no allocations and no actuals', () => {
    const remaining = fsAllocated(entries, 'fs-unknown') - fsActuals(actuals, 'fs-unknown')
    expect(remaining).toBe(0)
  })
})
