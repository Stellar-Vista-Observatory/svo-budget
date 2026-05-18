import { prisma } from '@/lib/prisma'
import { validateLineItemPatch } from '@/lib/line-items'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const patch = validateLineItemPatch(body)
    const updated = await prisma.lineItem.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.category !== undefined && { category: patch.category }),
        ...(patch.estimatedAmount !== undefined && { estimatedAmount: patch.estimatedAmount }),
      },
      select: { id: true, name: true, category: true, estimatedAmount: true },
    })
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
