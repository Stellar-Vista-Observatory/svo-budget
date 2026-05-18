import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, projectType: true, qboAccountId: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ projects })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name?: string }
  if (!body.name || body.name.trim() === '') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const project = await prisma.project.create({
    data: {
      name: body.name.trim(),
      projectType: 'claimed',
    },
    select: { id: true, name: true, projectType: true, qboAccountId: true },
  })
  return NextResponse.json(project, { status: 201 })
}
