import { prisma } from '@/lib/prisma'
import { lineItemSpent, lineItemRemaining, fundingSourceSpent, fundingSourceRemaining, projectSpent, projectFundingGap } from '@/lib/computed'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      fundingSources: {
        orderBy: { createdAt: 'asc' },
      },
      lineItems: {
        where: { isActive: true },
        include: {
          actuals: { select: { amount: true, fundingSourceId: true } },
          allocations: {
            include: {
              fundingSource: { select: { id: true, name: true, color: true } },
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
  const totalSecured = project.fundingSources.reduce((s, fs) => s + fs.allocatedTotal.toNumber(), 0)

  const fundingSources = project.fundingSources.map((fs) => {
    const spent = fundingSourceSpent(fs.id, allActuals)
    return {
      id: fs.id,
      name: fs.name,
      color: fs.color,
      allocatedTotal: fs.allocatedTotal.toNumber(),
      qboClassId: fs.qboClassId,
      qboClassName: fs.qboClassName,
      spent,
      remaining: fundingSourceRemaining(fs.allocatedTotal, spent),
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
