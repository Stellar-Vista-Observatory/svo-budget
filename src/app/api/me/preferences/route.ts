import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const pref = await prisma.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, showActualsAsNegative: true },
    update: {},
    select: { showActualsAsNegative: true },
  })

  return NextResponse.json(pref)
}

export async function PATCH(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const { showActualsAsNegative } = (await req.json()) as {
    showActualsAsNegative: boolean
  }

  const pref = await prisma.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, showActualsAsNegative },
    update: { showActualsAsNegative },
    select: { showActualsAsNegative: true },
  })

  return NextResponse.json(pref)
}
