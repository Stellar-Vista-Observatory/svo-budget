import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json() as { name?: string; color?: string; allocatedTotal?: number }

    if (body.allocatedTotal !== undefined) {
      if (typeof body.allocatedTotal !== 'number' || !isFinite(body.allocatedTotal) || body.allocatedTotal < 0) {
        return NextResponse.json({ error: 'allocatedTotal must be a non-negative number' }, { status: 400 })
      }
    }

    const updated = await prisma.fundingSource.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.allocatedTotal !== undefined && { allocatedTotal: body.allocatedTotal }),
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.fundingSource.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
