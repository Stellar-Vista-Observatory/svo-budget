import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const PREFERENCE_SELECT = {
  showActualsAsNegative: true,
  reportBvaProjectId: true,
  reportBvaShowDetail: true,
  reportFsProjectId: true,
  reportFsFundingSourceId: true,
} as const

interface PreferencePatch {
  showActualsAsNegative?: boolean
  reportBvaProjectId?: string | null
  reportBvaShowDetail?: boolean
  reportFsProjectId?: string | null
  reportFsFundingSourceId?: string | null
}

function buildPatch(body: Record<string, unknown>): PreferencePatch {
  const patch: PreferencePatch = {}

  if (typeof body.showActualsAsNegative === 'boolean') {
    patch.showActualsAsNegative = body.showActualsAsNegative
  }
  if (typeof body.reportBvaShowDetail === 'boolean') {
    patch.reportBvaShowDetail = body.reportBvaShowDetail
  }
  if (typeof body.reportBvaProjectId === 'string' || body.reportBvaProjectId === null) {
    patch.reportBvaProjectId = body.reportBvaProjectId
  }
  if (typeof body.reportFsProjectId === 'string' || body.reportFsProjectId === null) {
    patch.reportFsProjectId = body.reportFsProjectId
  }
  if (typeof body.reportFsFundingSourceId === 'string' || body.reportFsFundingSourceId === null) {
    patch.reportFsFundingSourceId = body.reportFsFundingSourceId
  }

  return patch
}

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const pref = await prisma.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, showActualsAsNegative: true },
    update: {},
    select: PREFERENCE_SELECT,
  })

  return NextResponse.json(pref)
}

export async function PATCH(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const patch = buildPatch(body as Record<string, unknown>)

  const pref = await prisma.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, ...patch },
    update: patch,
    select: PREFERENCE_SELECT,
  })

  return NextResponse.json(pref)
}
