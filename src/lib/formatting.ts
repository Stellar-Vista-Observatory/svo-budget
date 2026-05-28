export function applyActualSign(amount: number, showAsNegative: boolean): number {
  const absoluteAmount = Math.abs(amount)
  return showAsNegative ? -absoluteAmount || 0 : absoluteAmount
}
