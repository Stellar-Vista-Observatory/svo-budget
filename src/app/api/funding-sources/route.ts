import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const sources = await prisma.fundingSource.findMany({
    select: { id: true, name: true, shortName: true, color: true, totalFunds: true },
    orderBy: { name: 'asc' },
  })
  // totalFunds is a Prisma Decimal; coerce to a number so it sums correctly
  // on the client instead of serializing to a string and concatenating.
  return NextResponse.json(sources.map((s) => ({ ...s, totalFunds: Number(s.totalFunds) })))
}
