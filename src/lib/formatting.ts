export function applyActualSign(amount: number, showAsNegative: boolean): number {
  return showAsNegative ? (-Math.abs(amount) || 0) : Math.abs(amount)
}
