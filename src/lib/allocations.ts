export function validateAllocationAmount(amount: number): number {
  if (!isFinite(amount) || amount < 0) throw new Error('allocatedAmount must be >= 0')
  return amount
}
