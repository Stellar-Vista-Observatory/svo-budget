import { buildDashboardData } from '@/lib/dashboard'

const dec = (n: number) => ({ toNumber: () => n } as unknown as import('@prisma/client').Prisma.Decimal)

describe('buildDashboardData', () => {
  it('computes summary totals across projects', () => {
    const projects = [
      {
        id: 'p1',
        name: 'Observatory',
        projectType: 'claimed',
        fundingSources: [{ id: 'fs1', allocatedTotal: dec(1000), color: '#3b82f6', name: 'SVO Funds', actuals: [] }],
        lineItems: [
          { id: 'li1', estimatedAmount: dec(800), actuals: [{ amount: dec(200), fundingSourceId: 'fs1' }] },
        ],
      },
    ]

    const result = buildDashboardData(projects as Parameters<typeof buildDashboardData>[0])

    expect(result.summary.estimatedCosts).toBe(800)
    expect(result.summary.securedFunding).toBe(1000)
    expect(result.summary.spentToDate).toBe(200)
    expect(result.summary.remaining).toBe(800)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].spent).toBe(200)
    expect(result.projects[0].fundingGap).toBe(-200) // surplus
  })
})
