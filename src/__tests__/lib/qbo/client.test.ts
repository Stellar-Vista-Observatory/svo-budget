jest.mock('@/lib/prisma', () => ({
  prisma: {
    qboConnection: { findFirst: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('@/lib/qbo/auth', () => ({
  refreshAccessToken: jest.fn(),
}))

import { qboQuery, getValidConnection } from '@/lib/qbo/client'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from '@/lib/qbo/auth'
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'

const mockFindFirst = prisma.qboConnection.findFirst as jest.Mock
const mockUpdate = prisma.qboConnection.update as jest.Mock
const mockRefresh = refreshAccessToken as jest.Mock

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

describe('getValidConnection', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64') }
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function storedConn(overrides: Record<string, unknown> = {}) {
    return {
      id: 'conn-1',
      realmId: 'realm123',
      companyName: 'Test Co',
      accessToken: encrypt('access-plain'),
      refreshToken: encrypt('refresh-plain'),
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      lastSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  it('returns decrypted tokens when the access token is still valid', async () => {
    mockFindFirst.mockResolvedValue(storedConn())

    const conn = await getValidConnection()

    expect(conn.accessToken).toBe('access-plain')
    expect(conn.refreshToken).toBe('refresh-plain')
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('refreshes with the decrypted refresh token and stores re-encrypted tokens', async () => {
    mockFindFirst.mockResolvedValue(storedConn({ tokenExpiresAt: new Date(Date.now() + 60 * 1000) }))
    mockRefresh.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    })
    mockUpdate.mockImplementation(({ data }) => ({ ...storedConn(), ...data }))

    const conn = await getValidConnection()

    // refresh is called with the *decrypted* refresh token
    expect(mockRefresh).toHaveBeenCalledWith('refresh-plain')

    // tokens are persisted encrypted, not in plaintext
    const stored = mockUpdate.mock.calls[0][0].data
    expect(isEncrypted(stored.accessToken)).toBe(true)
    expect(isEncrypted(stored.refreshToken)).toBe(true)
    expect(decrypt(stored.accessToken)).toBe('new-access')
    expect(decrypt(stored.refreshToken)).toBe('new-refresh')

    // caller receives decrypted tokens
    expect(conn.accessToken).toBe('new-access')
    expect(conn.refreshToken).toBe('new-refresh')
  })

  it('passes through legacy plaintext tokens during migration', async () => {
    mockFindFirst.mockResolvedValue(
      storedConn({ accessToken: 'legacy-access', refreshToken: 'legacy-refresh' })
    )

    const conn = await getValidConnection()

    expect(conn.accessToken).toBe('legacy-access')
    expect(conn.refreshToken).toBe('legacy-refresh')
  })

  it('throws when there is no connection', async () => {
    mockFindFirst.mockResolvedValue(null)
    await expect(getValidConnection()).rejects.toThrow('No QBO connection found')
  })
})
