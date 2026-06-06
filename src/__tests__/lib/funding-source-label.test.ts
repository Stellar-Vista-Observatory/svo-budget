import { deriveFundingSourceLabel, fundingSourceLabel } from '@/lib/funding-source-label'

describe('deriveFundingSourceLabel', () => {
  it('returns SVO for any "SVO Funds" variant', () => {
    expect(deriveFundingSourceLabel('SVO Funds')).toBe('SVO')
    expect(deriveFundingSourceLabel('svo fund')).toBe('SVO')
  })

  it('builds an acronym from the capital letters of the name', () => {
    expect(deriveFundingSourceLabel('Big Bang Foundation')).toBe('BBF')
    expect(deriveFundingSourceLabel('National Science Foundation')).toBe('NSF')
  })
})

describe('fundingSourceLabel', () => {
  it('uses the custom short name when provided', () => {
    expect(fundingSourceLabel('Big Bang Foundation', 'BigBang')).toBe('BigBang')
  })

  it('trims surrounding whitespace from the custom short name', () => {
    expect(fundingSourceLabel('Big Bang Foundation', '  BBF1  ')).toBe('BBF1')
  })

  it('falls back to the derived acronym when the custom short name is null', () => {
    expect(fundingSourceLabel('Big Bang Foundation', null)).toBe('BBF')
  })

  it('falls back to the derived acronym when the custom short name is undefined', () => {
    expect(fundingSourceLabel('National Science Foundation', undefined)).toBe('NSF')
  })

  it('falls back to the derived acronym when the custom short name is blank', () => {
    expect(fundingSourceLabel('Big Bang Foundation', '   ')).toBe('BBF')
  })
})
