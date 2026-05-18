import { validateLineItemPatch } from '@/lib/line-items'

describe('validateLineItemPatch', () => {
  it('accepts valid estimatedAmount', () => {
    expect(validateLineItemPatch({ estimatedAmount: 1500 })).toEqual({ estimatedAmount: 1500 })
  })

  it('accepts zero estimatedAmount', () => {
    expect(validateLineItemPatch({ estimatedAmount: 0 })).toEqual({ estimatedAmount: 0 })
  })

  it('rejects negative estimatedAmount', () => {
    expect(() => validateLineItemPatch({ estimatedAmount: -1 })).toThrow('estimatedAmount must be >= 0')
  })

  it('rejects non-numeric estimatedAmount', () => {
    expect(() => validateLineItemPatch({ estimatedAmount: NaN })).toThrow('estimatedAmount must be >= 0')
  })
})
