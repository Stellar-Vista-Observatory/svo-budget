import { prisma } from '@/lib/prisma'
import { requireWriteAccess } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const COLOR_PALETTE = ['#3b82f6','#06b6d4','#f59e0b','#6366f1','#8b5cf6','#ec4899','#14b8a6','#f97316']

export async function POST(
  request: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error

  try {
    const body = await request.json() as {
      name: string
      qboClassId: string
      qboClassName: string
      allocatedTotal: number
      color?: string
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (typeof body.allocatedTotal !== 'number' || !isFinite(body.allocatedTotal) || body.allocatedTotal < 0) {
      return NextResponse.json({ error: 'allocatedTotal must be a non-negative number' }, { status: 400 })
    }

    const existing = await prisma.fundingSource.count()
    const color = body.color ?? COLOR_PALETTE[existing % COLOR_PALETTE.length]

    const source = await prisma.fundingSource.create({
      data: {
        name: body.name,
        color,
        allocatedTotal: body.allocatedTotal,
        qboClassId: body.qboClassId,
        qboClassName: body.qboClassName,
      },
    })
    return NextResponse.json(source, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
