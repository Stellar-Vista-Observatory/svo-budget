export type BidStatusValue = 'bid' | 'not_bid' | null

export function nextBidStatus(current: BidStatusValue | undefined): BidStatusValue {
  if (current === 'bid') return 'not_bid'
  if (current === 'not_bid') return null
  return 'bid'
}

export function bidStatusLabel(status: BidStatusValue | undefined): string {
  if (status === 'bid') return 'Bid'
  if (status === 'not_bid') return 'Not bid'
  return '—'
}
