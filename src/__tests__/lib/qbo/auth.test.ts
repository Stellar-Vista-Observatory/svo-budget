import { buildAuthUrl, exchangeCodeForTokens, refreshAccessToken } from '@/lib/qbo/auth'

const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    QBO_CLIENT_ID: 'test-client-id',
    QBO_CLIENT_SECRET: 'test-client-secret',
    QBO_REDIRECT_URI: 'http://localhost:3000/api/qbo/callback',
  }
  global.fetch = jest.fn()
})

afterEach(() => {
  process.env = originalEnv
  jest.restoreAllMocks()
})

describe('buildAuthUrl', () => {
  it('includes required OAuth params', () => {
    const url = buildAuthUrl('my-state-token')
    expect(url).toContain('client_id=test-client-id')
    expect(url).toContain('redirect_uri=')
    expect(url).toContain('response_type=code')
    expect(url).toContain('scope=com.intuit.quickbooks.accounting')
    expect(url).toContain('state=my-state-token')
  })
})

describe('exchangeCodeForTokens', () => {
  it('returns token response on success', async () => {
    const mockTokens = {
      access_token: 'acc123',
      refresh_token: 'ref456',
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
      token_type: 'bearer',
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokens,
    })

    const result = await exchangeCodeForTokens('auth-code')
    expect(result.access_token).toBe('acc123')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws when response is not ok', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400 })
    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow('Token exchange failed: 400')
  })
})

describe('refreshAccessToken', () => {
  it('sends refresh_token grant type', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-acc',
        refresh_token: 'new-ref',
        expires_in: 3600,
        x_refresh_token_expires_in: 8726400,
        token_type: 'bearer',
      }),
    })

    await refreshAccessToken('old-refresh-token')
    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(options.body.toString()).toContain('grant_type=refresh_token')
    expect(options.body.toString()).toContain('refresh_token=old-refresh-token')
  })
})
