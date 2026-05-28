import { applyActualSign } from '@/lib/formatting'

describe('applyActualSign', () => {
  describe('showAsNegative = true', () => {
    it('negates a positive amount', () => {
      expect(applyActualSign(29000, true)).toBe(-29000)
    })
    it('negates an already-negative amount (normalizes first)', () => {
      expect(applyActualSign(-29000, true)).toBe(-29000)
    })
    it('returns 0 for zero', () => {
      expect(applyActualSign(0, true)).toBe(0)
    })
  })

  describe('showAsNegative = false', () => {
    it('returns a positive amount unchanged', () => {
      expect(applyActualSign(29000, false)).toBe(29000)
    })
    it('returns absolute value for a negative input', () => {
      expect(applyActualSign(-29000, false)).toBe(29000)
    })
    it('returns 0 for zero', () => {
      expect(applyActualSign(0, false)).toBe(0)
    })
  })
})
