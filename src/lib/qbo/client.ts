import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './auth'
import type { QboConnection } from '@prisma/client'

function getApiBase(): string {
  return process.env.QBO_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    : 'https://quickbooks.api.intuit.com/v3/company'
}

export async function getValidConnection(): Promise<QboConnection> {
  const conn = await prisma.qboConnection.findFirst()
  if (!conn) throw new Error('No QBO connection found')

  // Refresh if expiring within 5 minutes
  if (conn.tokenExpiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
    const tokens = await refreshAccessToken(conn.refreshToken)
    return prisma.qboConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })
  }
  return conn
}

export async function qboQuery<T>(
  realmId: string,
  accessToken: string,
  sql: string
): Promise<T[]> {
  const url = `${getApiBase()}/${realmId}/query?query=${encodeURIComponent(sql)}&minorversion=70`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`QBO query failed: ${res.status}`)
  const data = await res.json()
  const entityName = sql.match(/FROM\s+(\w+)/i)?.[1] ?? ''
  return (data.QueryResponse?.[entityName] ?? []) as T[]
}
