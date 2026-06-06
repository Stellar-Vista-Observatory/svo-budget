/**
 * Round a monetary amount to whole dollars — the unit every figure in the
 * line-items table is displayed in. Conditional sign formatting (e.g. the red
 * "overspent" chip) must use the same precision as the display, otherwise a
 * sub-dollar residual (allocated − withdrawn = -0.30) reads as a spurious
 * negative "−$0".
 *
 * Adding 0 normalizes -0 back to 0 so callers can compare with `< 0` safely.
 */
export function roundDollars(n: number): number {
  return Math.round(n) + 0
}
