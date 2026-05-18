import { prisma } from '@/lib/prisma'
import { buildDashboardData } from '@/lib/dashboard'
import { NextResponse } from 'next/server'

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      fundingSources: {
        include: { actuals: { select: { amount: true, fundingSourceId: true } } },
      },
      lineItems: {
        where: { isActive: true },
        include: { actuals: { select: { amount: true, fundingSourceId: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(buildDashboardData(projects))
}
