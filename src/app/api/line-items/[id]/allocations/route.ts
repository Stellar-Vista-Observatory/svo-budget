import { prisma } from '@/lib/prisma'
import { validateAllocationAmount } from '@/lib/allocations'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lineItemId } = await params
  try {
    const body = await request.json() as { fundingSourceId: string; allocatedAmount: number }
    const amount = validateAllocationAmount(body.allocatedAmount)
    const allocation = await prisma.fundingAllocation.create({
      data: { lineItemId, fundingSourceId: body.fundingSourceId, allocatedAmount: amount },
    })
    return NextResponse.json(allocation, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
