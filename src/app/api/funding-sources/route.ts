import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const sources = await prisma.fundingSource.findMany({
    select: { id: true, name: true, color: true, allocatedTotal: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(sources)
}
