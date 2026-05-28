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

  let showActualsAsNegative: boolean
  try {
    ;({ showActualsAsNegative } = (await req.json()) as { showActualsAsNegative: boolean })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const pref = await prisma.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, showActualsAsNegative },
    update: { showActualsAsNegative },
    select: { showActualsAsNegative: true },
  })

  return NextResponse.json(pref)
}
