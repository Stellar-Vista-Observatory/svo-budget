import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, projectType: true, qboAccountId: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ projects })
}
