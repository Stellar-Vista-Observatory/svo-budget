import { validateBudgetEntryPatch } from '@/lib/line-items'

describe('validateBudgetEntryPatch', () => {
  it('accepts valid estimatedAmount', () => {
    expect(validateBudgetEntryPatch({ estimatedAmount: 1500 })).toEqual({ estimatedAmount: 1500 })
  })

  it('accepts zero estimatedAmount', () => {
    expect(validateBudgetEntryPatch({ estimatedAmount: 0 })).toEqual({ estimatedAmount: 0 })
  })

  it('rejects negative estimatedAmount', () => {
    expect(() => validateBudgetEntryPatch({ estimatedAmount: -1 })).toThrow('estimatedAmount must be >= 0')
  })

  it('rejects non-numeric estimatedAmount', () => {
    expect(() => validateBudgetEntryPatch({ estimatedAmount: NaN })).toThrow('estimatedAmount must be >= 0')
  })

  it('accepts valid name', () => {
    expect(validateBudgetEntryPatch({ name: 'Personnel' })).toEqual({ name: 'Personnel' })
  })

  it('rejects empty name', () => {
    expect(() => validateBudgetEntryPatch({ name: '  ' })).toThrow('name must be a non-empty string')
  })

  it('accepts bidStatus "bid"', () => {
    expect(validateBudgetEntryPatch({ bidStatus: 'bid' })).toEqual({ bidStatus: 'bid' })
  })

  it('accepts bidStatus "not_bid"', () => {
    expect(validateBudgetEntryPatch({ bidStatus: 'not_bid' })).toEqual({ bidStatus: 'not_bid' })
  })

  it('accepts null bidStatus to clear it', () => {
    expect(validateBudgetEntryPatch({ bidStatus: null })).toEqual({ bidStatus: null })
  })

  it('rejects an invalid bidStatus value', () => {
    expect(() => validateBudgetEntryPatch({ bidStatus: 'maybe' as never })).toThrow('bidStatus')
  })
})
