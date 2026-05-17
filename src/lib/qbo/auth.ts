const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QBO_SCOPE = 'com.intuit.quickbooks.accounting'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
  token_type: string
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID!,
    redirect_uri: process.env.QBO_REDIRECT_URI!,
    response_type: 'code',
    scope: QBO_SCOPE,
    state,
  })
  return `${QBO_AUTH_URL}?${params.toString()}`
}

function basicAuth(): string {
  return Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64')
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI!,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  return res.json()
}
