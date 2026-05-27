interface ActualItem {
  id: string
  amount: number
  date: string
  vendor: string | null
  memo: string | null
}

function mapActuals(raw: { id: string; amount: number; date: string; vendor: string | null; memo: string | null }[]): ActualItem[] {
  return raw.map((a) => ({
    id: a.id,
    amount: a.amount,
    date: a.date,
    vendor: a.vendor,
    memo: a.memo,
  }))
}

describe('mapActuals', () => {
  it('maps raw API actuals to display shape', () => {
    const raw = [
      { id: 'a1', amount: 50, date: '2026-04-08', vendor: 'State Bank', memo: null,
        qboTransactionType: 'Purchase', fundingSourceId: null, fundingSourceName: null, fundingSourceColor: null },
    ]
    const result = mapActuals(raw)
    expect(result).toEqual([{ id: 'a1', amount: 50, date: '2026-04-08', vendor: 'State Bank', memo: null }])
  })
})
