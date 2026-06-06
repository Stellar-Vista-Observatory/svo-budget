import { roundDollars } from '@/lib/money'

describe('roundDollars', () => {
  it('rounds to whole dollars', () => {
    expect(roundDollars(12.4)).toBe(12)
    expect(roundDollars(12.6)).toBe(13)
  })

  it('collapses a sub-dollar negative residual to zero (no spurious "−$0")', () => {
    // The bug: allocated $14,932 vs withdrawn $14,932.30 → -0.30, which is < 0
    // (red overspent chip) but formats to "$0" in whole dollars.
    const residual = 14932 - 14932.3
    expect(residual < 0).toBe(true)
    expect(roundDollars(residual)).toBe(0)
    expect(roundDollars(residual) < 0).toBe(false)
  })

  it('collapses tiny floating-point residuals to zero', () => {
    expect(roundDollars(-1e-9)).toBe(0)
    expect(roundDollars(0.0000001)).toBe(0)
  })

  it('preserves genuinely negative amounts of a dollar or more', () => {
    expect(roundDollars(-25)).toBe(-25)
    expect(roundDollars(-1.2) < 0).toBe(true)
  })
})
