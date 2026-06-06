import { prisma } from '@/lib/prisma'
import { isValidBidStatus } from '@/lib/line-items'
import { requireWriteAccess } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error

  const { id } = await params
  try {
    const body = await request.json() as { bidStatus?: unknown }
    if (!isValidBidStatus(body.bidStatus)) {
      throw new Error('bidStatus must be "bid", "not_bid", or null')
    }
    const updated = await prisma.actual.update({
      where: { id },
      data: { bidStatus: body.bidStatus },
      select: { id: true, bidStatus: true },
    })
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
