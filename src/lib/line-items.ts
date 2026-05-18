interface LineItemPatch {
  name?: string
  category?: string | null
  estimatedAmount?: number
}

export function validateLineItemPatch(body: LineItemPatch): LineItemPatch {
  if (body.name !== undefined && body.name.trim() === '') throw new Error('name cannot be empty')
  if (body.estimatedAmount !== undefined) {
    if (typeof body.estimatedAmount !== 'number' || !isFinite(body.estimatedAmount) || body.estimatedAmount < 0) {
      throw new Error('estimatedAmount must be >= 0')
    }
  }
  return body
}
