import type { Prisma } from '@prisma/client'

function sumActuals(actuals: { amount: Prisma.Decimal }[]): number {
  return actuals.reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

export function categorySpent(actuals: { amount: Prisma.Decimal }[]): number {
  return sumActuals(actuals)
}

export function categoryBudget(budgetEntries: { estimatedAmount: Prisma.Decimal }[]): number {
  return budgetEntries.reduce((sum, e) => sum + e.estimatedAmount.toNumber(), 0)
}

export function fundingSourceSpent(
  fundingSourceId: string,
  actuals: { fundingSourceId: string | null; amount: Prisma.Decimal }[]
): number {
  return actuals
    .filter((a) => a.fundingSourceId === fundingSourceId)
    .reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

export function projectSpent(actuals: { amount: Prisma.Decimal }[]): number {
  return sumActuals(actuals)
}

export function projectFundingGap(estimatedCosts: number, securedFunding: number): number {
  return estimatedCosts - securedFunding
}
