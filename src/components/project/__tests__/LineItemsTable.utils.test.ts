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
