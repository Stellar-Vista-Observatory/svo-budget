/**
 * Derive a short label (acronym) for a funding source from its full name.
 * "SVO Funds" is special-cased; otherwise we take the capital letters.
 */
export function deriveFundingSourceLabel(name: string): string {
  if (/svo\s*funds?/i.test(name)) return 'SVO'
  return name.replace(/[^A-Z]/g, '')
}

/**
 * The short label shown for a funding source: a user-specified custom short
 * name when set, otherwise the derived acronym as a fallback.
 */
export function fundingSourceLabel(name: string, shortName?: string | null): string {
  const custom = shortName?.trim()
  if (custom) return custom
  return deriveFundingSourceLabel(name)
}
