import type { Prisma } from '@prisma/client'
import { projectSpent, projectFundingGap, fundingSourceSpent } from './computed'

type Actual = { amount: Prisma.Decimal; fundingSourceId: string | null }
type FundingSource = { id: string; name: string; color: string; allocatedTotal: Prisma.Decimal; actuals: Actual[] }
type LineItem = { id: string; estimatedAmount: Prisma.Decimal; actuals: Actual[] }
type Project = {
  id: string
  name: string
  projectType: string
  fundingSources: FundingSource[]
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
    const secured = p.fundingSources.reduce((s, fs) => s + fs.allocatedTotal.toNumber(), 0)
    const fundingGap = projectFundingGap(estimated, secured)

    totalEstimated += estimated
    totalSecured += secured
    totalSpent += spent

    const fundingSourceSummaries = p.fundingSources.map((fs) => ({
      id: fs.id,
      name: fs.name,
      color: fs.color,
      allocatedTotal: fs.allocatedTotal.toNumber(),
      spent: fundingSourceSpent(fs.id, allActuals),
    }))

    return {
      id: p.id,
      name: p.name,
      projectType: p.projectType,
      estimated,
      secured,
      spent,
      fundingGap,
      lineItemCount: p.lineItems.length,
      fundingSourceCount: p.fundingSources.length,
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
