import {
  lineItemSpent,
  lineItemRemaining,
  projectSpent,
  projectFundingGap,
  fundingSourceSpent,
  fundingSourceRemaining,
} from '@/lib/computed'

const dec = (n: number) => ({ toNumber: () => n } as unknown as import('@prisma/client').Prisma.Decimal)

describe('lineItemSpent', () => {
  it('sums actuals amounts', () => {
    const actuals = [{ amount: dec(100) }, { amount: dec(50) }]
    expect(lineItemSpent(actuals)).toBe(150)
  })

  it('returns 0 with no actuals', () => {
    expect(lineItemSpent([])).toBe(0)
  })
})

describe('lineItemRemaining', () => {
  it('subtracts spent from estimated', () => {
    expect(lineItemRemaining(dec(500), 200)).toBe(300)
  })

  it('returns negative when overspent', () => {
    expect(lineItemRemaining(dec(100), 150)).toBe(-50)
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

describe('fundingSourceRemaining', () => {
  it('subtracts spent from allocated total', () => {
    expect(fundingSourceRemaining(dec(1000), 400)).toBe(600)
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
