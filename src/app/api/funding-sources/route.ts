import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const sources = await prisma.fundingSource.findMany({
    select: { id: true, name: true, color: true, allocatedTotal: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(sources)
}
