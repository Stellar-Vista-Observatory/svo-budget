import { pctSpent } from '../page'

describe('pctSpent', () => {
  it('returns percentage of spent vs budgeted', () => {
    expect(pctSpent(39932, 66000)).toBe('61%')
  })

  it('returns — when budgeted is zero', () => {
    expect(pctSpent(0, 0)).toBe('—')
  })

  it('returns > 100% when overspent', () => {
    expect(pctSpent(16700, 12700)).toBe('131%')
  })
})
