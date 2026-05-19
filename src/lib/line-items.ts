interface BudgetEntryPatch {
  name?: string
  estimatedAmount?: number
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
  return body
}
