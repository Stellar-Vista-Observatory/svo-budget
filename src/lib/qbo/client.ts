import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './auth'
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'
import type { QboConnection } from '@prisma/client'

function getApiBase(): string {
  return process.env.QBO_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    : 'https://quickbooks.api.intuit.com/v3/company'
}

// Tokens are stored encrypted at rest. Values written before encryption was
// introduced are plain text; pass those through until the next write
// re-stores them encrypted.
function readToken(stored: string): string {
  return isEncrypted(stored) ? decrypt(stored) : stored
}

export async function getValidConnection(): Promise<QboConnection> {
  const conn = await prisma.qboConnection.findFirst()
  if (!conn) throw new Error('No QBO connection found')

  // Refresh if expiring within 5 minutes
  if (conn.tokenExpiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
    const tokens = await refreshAccessToken(readToken(conn.refreshToken))
    const updated = await prisma.qboConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })
    return { ...updated, accessToken: tokens.access_token, refreshToken: tokens.refresh_token }
  }

  return { ...conn, accessToken: readToken(conn.accessToken), refreshToken: readToken(conn.refreshToken) }
}

const PAGE_SIZE = 1000

export async function qboQuery<T>(
  realmId: string,
  accessToken: string,
  sql: string
): Promise<T[]> {
  const entityName = sql.match(/FROM\s+(\w+)/i)?.[1] ?? ''
  const results: T[] = []
  let startPosition = 1

  while (true) {
    const paginatedSql = `${sql} STARTPOSITION ${startPosition} MAXRESULTS ${PAGE_SIZE}`
    const url = `${getApiBase()}/${realmId}/query?query=${encodeURIComponent(paginatedSql)}&minorversion=70`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`QBO query failed: ${res.status}`)
    const data = await res.json()
    const page = (data.QueryResponse?.[entityName] ?? []) as T[]
    results.push(...page)

    if (page.length < PAGE_SIZE) break
    startPosition += PAGE_SIZE
  }

  return results
}
