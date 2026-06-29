import {
  categorySpent,
  categoryBudget,
  projectSpent,
  projectFundingGap,
  fundingSourceSpent,
  totalFundsAvailable,
} from '@/lib/computed'

const dec = (n: number) => ({ toNumber: () => n } as unknown as import('@prisma/client').Prisma.Decimal)

describe('categorySpent', () => {
  it('sums actuals amounts', () => {
    const actuals = [{ amount: dec(100) }, { amount: dec(50) }]
    expect(categorySpent(actuals)).toBe(150)
  })

  it('returns 0 with no actuals', () => {
    expect(categorySpent([])).toBe(0)
  })
})

describe('categoryBudget', () => {
  it('sums budget entry estimated amounts', () => {
    const entries = [{ estimatedAmount: dec(300) }, { estimatedAmount: dec(200) }]
    expect(categoryBudget(entries)).toBe(500)
  })

  it('returns 0 with no entries', () => {
    expect(categoryBudget([])).toBe(0)
  })
})

describe('fundingSourceSpent', () => {
  it('sums actuals for matching funding source', () => {
    const actuals = [
      { fundingSourceId: 'fs-1', amount: dec(200) },
      { fundingSourceId: 'fs-2', amount: dec(100) },
      { fundingSourceId: 'fs-1', amount: dec(75) },
    ]
    expect(fundingSourceSpent('fs-1', actuals)).toBe(275)
  })
})

describe('projectSpent', () => {
  it('sums all actuals for the project', () => {
    const actuals = [{ amount: dec(100) }, { amount: dec(200) }, { amount: dec(50) }]
    expect(projectSpent(actuals)).toBe(350)
  })
})

describe('projectFundingGap', () => {
  it('returns positive when funding short', () => {
    expect(projectFundingGap(1000, 600)).toBe(400)
  })

  it('returns negative (surplus) when over-funded', () => {
    expect(projectFundingGap(600, 1000)).toBe(-400)
  })
})

describe('totalFundsAvailable', () => {
  it('sums totalFunds across all funding sources', () => {
    const sources = [
      { totalFunds: 25000 },
      { totalFunds: 83000 },
      { totalFunds: 199500 },
    ]
    expect(totalFundsAvailable(sources)).toBe(307500)
  })

  it('returns 0 with no funding sources', () => {
    expect(totalFundsAvailable([])).toBe(0)
  })
})
