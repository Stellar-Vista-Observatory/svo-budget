import { prisma } from '@/lib/prisma'
import { fundingSourceSpent, projectFundingGap } from '@/lib/computed'
import { requireWriteAccess } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      categories: {
        orderBy: { sortOrder: 'asc' },
        include: {
          budgetEntries: {
            orderBy: { sortOrder: 'asc' },
            include: {
              allocations: {
                include: {
                  fundingSource: { select: { id: true, name: true, color: true, allocatedTotal: true, qboClassId: true, qboClassName: true } },
                },
              },
            },
          },
          actuals: {
            include: {
              fundingSource: { select: { id: true, name: true, color: true } },
            },
            orderBy: { date: 'desc' },
          },
        },
      },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allActuals = project.categories.flatMap((c) => c.actuals)
  const allEntries = project.categories.flatMap((c) => c.budgetEntries)
  const allAllocations = allEntries.flatMap((e) => e.allocations)

  const totalSpent = allActuals.reduce((s, a) => s + a.amount.toNumber(), 0)
  const totalEstimated = allEntries.reduce((s, e) => s + e.estimatedAmount.toNumber(), 0)
  const totalSecured = allAllocations.reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)

  // Deduplicate funding sources across all allocations
  const fsMap = new Map<string, {
    id: string; name: string; color: string
    allocatedToProject: number
    qboClassId: string; qboClassName: string
  }>()
  for (const alloc of allAllocations) {
    const fs = alloc.fundingSource
    const entry = fsMap.get(fs.id)
    if (entry) {
      entry.allocatedToProject += alloc.allocatedAmount.toNumber()
    } else {
      fsMap.set(fs.id, {
        id: fs.id,
        name: fs.name,
        color: fs.color,
        allocatedToProject: alloc.allocatedAmount.toNumber(),
        qboClassId: fs.qboClassId,
        qboClassName: fs.qboClassName,
      })
    }
  }

  const fundingSources = Array.from(fsMap.values()).map((fs) => {
    const spent = fundingSourceSpent(fs.id, allActuals)
    return {
      id: fs.id,
      name: fs.name,
      color: fs.color,
      allocatedTotal: fs.allocatedToProject,
      qboClassId: fs.qboClassId,
      qboClassName: fs.qboClassName,
      spent,
      remaining: fs.allocatedToProject - spent,
    }
  })

  const categories = project.categories.map((cat) => {
    const catSpent = cat.actuals.reduce((s, a) => s + a.amount.toNumber(), 0)
    const catBudget = cat.budgetEntries.reduce((s, e) => s + e.estimatedAmount.toNumber(), 0)
    const catAllocated = cat.budgetEntries
      .flatMap((e) => e.allocations)
      .reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)

    return {
      id: cat.id,
      name: cat.name,
      qboAccountId: cat.qboAccountId,
      sortOrder: cat.sortOrder,
      totalBudget: catBudget,
      totalSpent: catSpent,
      totalAllocated: catAllocated,
      budgetEntries: cat.budgetEntries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        estimatedAmount: entry.estimatedAmount.toNumber(),
        allocations: entry.allocations.map((a) => ({
          id: a.id,
          fundingSourceId: a.fundingSource.id,
          fundingSourceName: a.fundingSource.name,
          fundingSourceColor: a.fundingSource.color,
          allocatedAmount: a.allocatedAmount.toNumber(),
        })),
      })),
      actuals: cat.actuals.map((a) => ({
        id: a.id,
        amount: a.amount.toNumber(),
        date: a.date.toISOString().slice(0, 10),
        vendor: a.vendor,
        memo: a.memo,
        qboTransactionType: a.qboTransactionType,
        fundingSourceId: a.fundingSourceId,
        fundingSourceName: a.fundingSource?.name ?? null,
        fundingSourceColor: a.fundingSource?.color ?? null,
      })),
    }
  })

  return NextResponse.json({
    id: project.id,
    name: project.name,
    description: project.description,
    projectType: project.projectType,
    totalEstimated,
    totalSecured,
    totalSpent,
    fundingGap: projectFundingGap(totalEstimated, totalSecured),
    fundingSources,
    categories,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error

  const { id } = await params
  const body = await request.json() as { name?: string; description?: string; qboAccountId?: string | null }

  if (body.qboAccountId) {
    await prisma.project.updateMany({
      where: { qboAccountId: body.qboAccountId, NOT: { id } },
      data: { qboAccountId: null },
    })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.description !== undefined) data.description = body.description?.trim() || null
  if ('qboAccountId' in body) data.qboAccountId = body.qboAccountId ?? null

  const updated = await prisma.project.update({
    where: { id },
    data,
    select: { id: true, name: true, description: true, qboAccountId: true },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error

  const { id } = await params
  try {
    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
