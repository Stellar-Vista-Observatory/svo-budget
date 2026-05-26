import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const conn = await prisma.qboConnection.findFirst({
    select: { realmId: true, companyName: true, lastSyncedAt: true },
  })
  return NextResponse.json({ connected: !!conn, connection: conn ?? null })
}
