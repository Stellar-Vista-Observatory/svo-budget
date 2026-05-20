import { prisma } from '@/lib/prisma'
import { validateBudgetEntryPatch } from '@/lib/line-items'
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
    const body = await request.json()
    const patch = validateBudgetEntryPatch(body)
    const updated = await prisma.budgetEntry.update({
      where: { id },
      data: {
        ...(patch.estimatedAmount !== undefined && { estimatedAmount: patch.estimatedAmount }),
        ...(patch.name !== undefined && { name: patch.name.trim() }),
      },
      select: { id: true, name: true, estimatedAmount: true },
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
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error

  const { id } = await params
  try {
    await prisma.budgetEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
