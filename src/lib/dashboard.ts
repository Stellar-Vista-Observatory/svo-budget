import type { Prisma, ProjectType } from '@prisma/client'
import { projectSpent, projectFundingGap, fundingSourceSpent } from './computed'

type Actual = { amount: Prisma.Decimal; fundingSourceId: string | null }
type Allocation = {
  allocatedAmount: Prisma.Decimal
  fundingSource: { id: string; name: string; color: string }
}
type BudgetEntry = {
  estimatedAmount: Prisma.Decimal
  allocations: Allocation[]
}
type Category = {
  budgetEntries: BudgetEntry[]
  actuals: Actual[]
}
type Project = {
  id: string
  name: string
  projectType: ProjectType
  categories: Category[]
}

export function buildDashboardData(projects: Project[]) {
  let totalEstimated = 0
  let totalSecured = 0
  let totalSpent = 0

  const projectCards = projects.map((p) => {
    const allActuals = p.categories.flatMap((c) => c.actuals)
    const allEntries = p.categories.flatMap((c) => c.budgetEntries)
    const allAllocations = allEntries.flatMap((e) => e.allocations)

    const spent = projectSpent(allActuals)
    const estimated = allEntries.reduce((s, e) => s + e.estimatedAmount.toNumber(), 0)
    const secured = allAllocations.reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)
    const fundingGap = projectFundingGap(estimated, secured)

    totalEstimated += estimated
    totalSecured += secured
    totalSpent += spent

    const fsMap = new Map<string, { id: string; name: string; color: string; allocated: number }>()
    for (const alloc of allAllocations) {
      const fs = alloc.fundingSource
      const entry = fsMap.get(fs.id)
      if (entry) {
        entry.allocated += alloc.allocatedAmount.toNumber()
      } else {
        fsMap.set(fs.id, { id: fs.id, name: fs.name, color: fs.color, allocated: alloc.allocatedAmount.toNumber() })
      }
    }

    const fundingSourceSummaries = Array.from(fsMap.values()).map((fs) => ({
      id: fs.id,
      name: fs.name,
      color: fs.color,
      allocatedTotal: fs.allocated,
      spent: fundingSourceSpent(fs.id, allActuals),
    }))

    return {
      id: p.id,
      name: p.name,
      estimated,
      secured,
      spent,
      fundingGap,
      lineItemCount: allEntries.length,
      fundingSources: fundingSourceSummaries,
    }
  })

  return {
    summary: {
      estimatedCosts: totalEstimated,
      securedFunding: totalSecured,
      spentToDate: totalSpent,
      remaining: totalEstimated - totalSpent,
    },
    projects: projectCards,
  }
}
