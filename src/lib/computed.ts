import type { Prisma } from '@prisma/client'

export function lineItemSpent(actuals: { amount: Prisma.Decimal }[]): number {
  return actuals.reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

export function lineItemRemaining(estimatedAmount: Prisma.Decimal, spent: number): number {
  return estimatedAmount.toNumber() - spent
}

export function fundingSourceSpent(
  fundingSourceId: string,
  actuals: { fundingSourceId: string | null; amount: Prisma.Decimal }[]
): number {
  return actuals
    .filter((a) => a.fundingSourceId === fundingSourceId)
    .reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

export function fundingSourceRemaining(allocatedTotal: Prisma.Decimal, spent: number): number {
  return allocatedTotal.toNumber() - spent
}

export function projectSpent(actuals: { amount: Prisma.Decimal }[]): number {
  return actuals.reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

export function projectFundingGap(estimatedCosts: number, securedFunding: number): number {
  return estimatedCosts - securedFunding
}
