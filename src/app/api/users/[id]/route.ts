import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied.error

  const { id: userId } = await params
  const body = await request.json() as { role: 'admin' | 'viewer' }

  if (body.role !== 'admin' && body.role !== 'viewer') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const userRole = await prisma.userRole.upsert({
    where: { userId },
    update: { role: body.role },
    create: { userId, role: body.role },
  })
  return NextResponse.json(userRole)
}
