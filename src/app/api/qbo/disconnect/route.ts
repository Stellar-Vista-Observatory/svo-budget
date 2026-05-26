import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied.error

  await prisma.qboConnection.deleteMany()
  return NextResponse.json({ ok: true })
}
