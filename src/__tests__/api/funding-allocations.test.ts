import { validateAllocationAmount } from '@/lib/allocations'

describe('validateAllocationAmount', () => {
  it('accepts valid positive amount', () => {
    expect(validateAllocationAmount(500)).toBe(500)
  })

  it('accepts zero', () => {
    expect(validateAllocationAmount(0)).toBe(0)
  })

  it('rejects negative', () => {
    expect(() => validateAllocationAmount(-1)).toThrow('allocatedAmount must be >= 0')
  })

  it('rejects non-finite', () => {
    expect(() => validateAllocationAmount(NaN)).toThrow('allocatedAmount must be >= 0')
  })
})
