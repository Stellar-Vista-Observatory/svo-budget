import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const COLOR_PALETTE = ['#3b82f6','#16a34a','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const body = await request.json() as {
    name: string
    qboClassId: string
    qboClassName: string
    allocatedTotal: number
    color?: string
  }

  const existing = await prisma.fundingSource.count({ where: { projectId } })
  const color = body.color ?? COLOR_PALETTE[existing % COLOR_PALETTE.length]

  const source = await prisma.fundingSource.create({
    data: {
      projectId,
      name: body.name,
      color,
      allocatedTotal: body.allocatedTotal,
      qboClassId: body.qboClassId,
      qboClassName: body.qboClassName,
    },
  })
  return NextResponse.json(source, { status: 201 })
}
