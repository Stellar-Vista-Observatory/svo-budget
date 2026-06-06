export type BidStatusValue = 'bid' | 'not_bid' | null

interface BudgetEntryPatch {
  name?: string
  estimatedAmount?: number
  bidStatus?: BidStatusValue
}

export function isValidBidStatus(value: unknown): value is BidStatusValue {
  return value === null || value === 'bid' || value === 'not_bid'
}

export function validateBudgetEntryPatch(body: BudgetEntryPatch): BudgetEntryPatch {
  if (body.estimatedAmount !== undefined) {
    if (typeof body.estimatedAmount !== 'number' || !isFinite(body.estimatedAmount) || body.estimatedAmount < 0) {
      throw new Error('estimatedAmount must be >= 0')
    }
  }
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new Error('name must be a non-empty string')
    }
  }
  if (body.bidStatus !== undefined && !isValidBidStatus(body.bidStatus)) {
    throw new Error('bidStatus must be "bid", "not_bid", or null')
  }
  return body
}
