import { prisma } from '@/lib/prisma'
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
    const body = await request.json() as { name?: string; color?: string; totalFunds?: number; shortName?: unknown }

    if (body.totalFunds !== undefined) {
      if (typeof body.totalFunds !== 'number' || !isFinite(body.totalFunds) || body.totalFunds < 0) {
        return NextResponse.json({ error: 'totalFunds must be a non-negative number' }, { status: 400 })
      }
    }

    // A blank custom short name clears the override, falling back to the derived acronym.
    let shortNameUpdate: string | null | undefined
    if (body.shortName !== undefined) {
      if (body.shortName !== null && typeof body.shortName !== 'string') {
        return NextResponse.json({ error: 'shortName must be a string or null' }, { status: 400 })
      }
      const trimmed = typeof body.shortName === 'string' ? body.shortName.trim() : ''
      shortNameUpdate = trimmed === '' ? null : trimmed
    }

    const updated = await prisma.fundingSource.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.totalFunds !== undefined && { totalFunds: body.totalFunds }),
        ...(shortNameUpdate !== undefined && { shortName: shortNameUpdate }),
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
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error

  const { id } = await params
  try {
    await prisma.fundingSource.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
