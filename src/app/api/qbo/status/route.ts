import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const conn = await prisma.qboConnection.findFirst({
    select: { realmId: true, companyName: true, lastSyncedAt: true },
  })
  return NextResponse.json({ connected: !!conn, connection: conn ?? null })
}
