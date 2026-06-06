import { nextBidStatus, bidStatusLabel } from '@/lib/bid-status'

describe('nextBidStatus', () => {
  it('cycles null -> bid', () => {
    expect(nextBidStatus(null)).toBe('bid')
  })

  it('cycles bid -> not_bid', () => {
    expect(nextBidStatus('bid')).toBe('not_bid')
  })

  it('cycles not_bid -> null', () => {
    expect(nextBidStatus('not_bid')).toBe(null)
  })

  it('treats undefined like the unset (null) state', () => {
    expect(nextBidStatus(undefined)).toBe('bid')
  })
})

describe('bidStatusLabel', () => {
  it('labels bid', () => {
    expect(bidStatusLabel('bid')).toBe('Bid')
  })

  it('labels not_bid', () => {
    expect(bidStatusLabel('not_bid')).toBe('Not bid')
  })

  it('labels the unset state with a dash', () => {
    expect(bidStatusLabel(null)).toBe('—')
    expect(bidStatusLabel(undefined)).toBe('—')
  })
})
