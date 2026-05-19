import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: categoryId } = await params
  try {
    const body = await request.json() as { name: string; estimatedAmount?: number }
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const entry = await prisma.budgetEntry.create({
      data: {
        categoryId,
        name: body.name.trim(),
        estimatedAmount: body.estimatedAmount ?? 0,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
