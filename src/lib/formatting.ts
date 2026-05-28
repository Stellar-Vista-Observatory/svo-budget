export function applyActualSign(amount: number, showAsNegative: boolean): number {
  return showAsNegative ? -Math.abs(amount) : Math.abs(amount)
}
