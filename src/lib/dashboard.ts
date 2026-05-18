import type { Prisma, ProjectType } from '@prisma/client'
import { projectSpent, projectFundingGap, fundingSourceSpent } from './computed'

type Actual = { amount: Prisma.Decimal; fundingSourceId: string | null }
type Allocation = {
  allocatedAmount: Prisma.Decimal
  fundingSource: { id: string; name: string; color: string }
}
type LineItem = {
  id: string
  estimatedAmount: Prisma.Decimal
  actuals: Actual[]
  allocations: Allocation[]
}
type Project = {
  id: string
  name: string
  projectType: ProjectType
  lineItems: LineItem[]
}

export function buildDashboardData(projects: Project[]) {
  let totalEstimated = 0
  let totalSecured = 0
  let totalSpent = 0

  const projectCards = projects.map((p) => {
    const allActuals = p.lineItems.flatMap((li) => li.actuals)
    const spent = projectSpent(allActuals)
    const estimated = p.lineItems.reduce((s, li) => s + li.estimatedAmount.toNumber(), 0)

    // Secured = sum of all allocations on this project's line items
    const secured = p.lineItems
      .flatMap((li) => li.allocations)
      .reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)

    const fundingGap = projectFundingGap(estimated, secured)

    totalEstimated += estimated
    totalSecured += secured
    totalSpent += spent

    // Deduplicate funding sources; sum per-project allocated amounts
    const fsMap = new Map<string, { id: string; name: string; color: string; allocated: number }>()
    for (const li of p.lineItems) {
      for (const alloc of li.allocations) {
        const fs = alloc.fundingSource
        const entry = fsMap.get(fs.id)
        if (entry) {
          entry.allocated += alloc.allocatedAmount.toNumber()
        } else {
          fsMap.set(fs.id, { id: fs.id, name: fs.name, color: fs.color, allocated: alloc.allocatedAmount.toNumber() })
        }
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
      lineItemCount: p.lineItems.length,
      fundingSources: fundingSourceSummaries,
    }
  })

  return {
    summary: {
      estimatedCosts: totalEstimated,
      securedFunding: totalSecured,
      spentToDate: totalSpent,
      remaining: totalSecured - totalSpent,
    },
    projects: projectCards,
  }
}
