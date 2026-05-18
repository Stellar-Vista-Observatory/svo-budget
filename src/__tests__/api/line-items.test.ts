import { validateLineItemPatch } from '@/lib/line-items'

describe('validateLineItemPatch', () => {
  it('accepts valid patch with name', () => {
    expect(validateLineItemPatch({ name: 'Foundation' })).toEqual({ name: 'Foundation' })
  })

  it('accepts valid patch with estimatedAmount', () => {
    expect(validateLineItemPatch({ estimatedAmount: 1500 })).toEqual({ estimatedAmount: 1500 })
  })

  it('accepts null category to clear it', () => {
    expect(validateLineItemPatch({ category: null })).toEqual({ category: null })
  })

  it('rejects negative estimatedAmount', () => {
    expect(() => validateLineItemPatch({ estimatedAmount: -1 })).toThrow('estimatedAmount must be >= 0')
  })

  it('rejects empty name', () => {
    expect(() => validateLineItemPatch({ name: '' })).toThrow('name cannot be empty')
  })

  it('rejects non-numeric estimatedAmount', () => {
    expect(() => validateLineItemPatch({ estimatedAmount: NaN })).toThrow('estimatedAmount must be >= 0')
  })
})
