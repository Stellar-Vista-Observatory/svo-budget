import { prisma } from '@/lib/prisma'
import { lineItemSpent, lineItemRemaining, fundingSourceSpent, projectSpent, projectFundingGap } from '@/lib/computed'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      lineItems: {
        where: { isActive: true },
        include: {
          actuals: {
            select: {
              id: true,
              amount: true,
              date: true,
              vendor: true,
              qboTransactionType: true,
              fundingSourceId: true,
              fundingSource: { select: { name: true, color: true } },
            },
            orderBy: { date: 'desc' },
          },
          allocations: {
            include: {
              fundingSource: { select: { id: true, name: true, color: true, allocatedTotal: true, qboClassId: true, qboClassName: true } },
            },
          },
        },
        orderBy: { displayPath: 'asc' },
      },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allActuals = project.lineItems.flatMap((li) => li.actuals)
  const totalSpent = projectSpent(allActuals)
  const totalEstimated = project.lineItems.reduce((s, li) => s + li.estimatedAmount.toNumber(), 0)

  // Secured = sum of allocations for this project's line items
  const totalSecured = project.lineItems
    .flatMap((li) => li.allocations)
    .reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)

  // Deduplicate funding sources; compute per-project allocated + spent
  const fsMap = new Map<string, {
    id: string; name: string; color: string
    allocatedToProject: number
    qboClassId: string; qboClassName: string
  }>()
  for (const li of project.lineItems) {
    for (const alloc of li.allocations) {
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

  const lineItems = project.lineItems.map((li) => {
    const spent = lineItemSpent(li.actuals)
    const totalAllocated = li.allocations.reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)
    const allocationPct = li.estimatedAmount.toNumber() > 0
      ? (totalAllocated / li.estimatedAmount.toNumber()) * 100
      : 0

    return {
      id: li.id,
      name: li.name,
      displayPath: li.displayPath,
      category: li.category,
      estimatedAmount: li.estimatedAmount.toNumber(),
      qboAccountId: li.qboAccountId,
      isActive: li.isActive,
      spent,
      remaining: lineItemRemaining(li.estimatedAmount, spent),
      allocationPct: Math.round(allocationPct),
      allocations: li.allocations.map((a) => ({
        id: a.id,
        fundingSourceId: a.fundingSource.id,
        fundingSourceName: a.fundingSource.name,
        fundingSourceColor: a.fundingSource.color,
        allocatedAmount: a.allocatedAmount.toNumber(),
      })),
      actualsBySource: Object.values(
        li.actuals.reduce<Record<string, {
          fundingSourceId: string | null
          name: string
          color: string
          total: number
          transactions: { id: string; date: string; vendor: string | null; amount: number; type: string }[]
        }>>(
          (acc, actual) => {
            const key = actual.fundingSourceId ?? '__untagged__'
            if (!acc[key]) {
              acc[key] = {
                fundingSourceId: actual.fundingSourceId,
                name: actual.fundingSource?.name ?? 'Untagged',
                color: actual.fundingSource?.color ?? '#94a3b8',
                total: 0,
                transactions: [],
              }
            }
            acc[key].total += actual.amount.toNumber()
            acc[key].transactions.push({
              id: actual.id,
              date: actual.date.toISOString().slice(0, 10),
              vendor: actual.vendor,
              amount: actual.amount.toNumber(),
              type: actual.qboTransactionType,
            })
            return acc
          },
          {}
        )
      ),
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
    lineItems,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as { qboAccountId?: string | null }

  if (body.qboAccountId) {
    await prisma.project.updateMany({
      where: { qboAccountId: body.qboAccountId, NOT: { id } },
      data: { qboAccountId: null },
    })
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { qboAccountId: body.qboAccountId ?? null },
    select: { id: true, name: true, qboAccountId: true },
  })
  return NextResponse.json(updated)
}
