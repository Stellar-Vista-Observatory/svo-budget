import { prisma } from '@/lib/prisma'
import { buildDashboardData } from '@/lib/dashboard'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const projects = await prisma.project.findMany({
    include: {
      categories: {
        include: {
          budgetEntries: {
            include: {
              allocations: {
                include: {
                  fundingSource: { select: { id: true, name: true, color: true } },
                },
              },
            },
          },
          actuals: { select: { amount: true, fundingSourceId: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(buildDashboardData(projects))
}
