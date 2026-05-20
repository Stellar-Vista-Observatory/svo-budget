import { qboQuery } from '@/lib/qbo/client'

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('qboQuery', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, QBO_ENVIRONMENT: 'sandbox' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('calls QBO query endpoint and returns entity array', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        QueryResponse: {
          Account: [
            { Id: '1', Name: 'Construction', FullyQualifiedName: 'Construction' },
          ],
        },
      }),
    })

    const accounts = await qboQuery('realm123', 'acc-token', 'SELECT * FROM Account')

    expect(accounts).toHaveLength(1)
    expect((accounts[0] as { Name: string }).Name).toBe('Construction')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sandbox-quickbooks.api.intuit.com'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer acc-token' }) })
    )
  })

  it('returns empty array when entity is not in response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ QueryResponse: {} }),
    })

    const result = await qboQuery('realm123', 'token', 'SELECT * FROM Account')
    expect(result).toEqual([])
  })

  it('throws on non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(qboQuery('realm123', 'bad-token', 'SELECT * FROM Account')).rejects.toThrow('QBO query failed: 401')
  })

  it('paginates when page returns exactly PAGE_SIZE results', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ Id: String(i) }))
    const page2 = [{ Id: '1000' }, { Id: '1001' }]

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ QueryResponse: { Account: page1 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ QueryResponse: { Account: page2 } }) })

    const result = await qboQuery('realm123', 'token', 'SELECT * FROM Account')
    expect(result).toHaveLength(1002)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
