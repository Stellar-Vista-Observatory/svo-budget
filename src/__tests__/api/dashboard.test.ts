import { buildDashboardData } from '@/lib/dashboard'

const dec = (n: number) => ({ toNumber: () => n } as unknown as import('@prisma/client').Prisma.Decimal)

describe('buildDashboardData', () => {
  it('computes secured from allocations', () => {
    const projects = [
      {
        id: 'p1',
        name: 'Observatory',
        projectType: 'claimed',
        categories: [
          {
            budgetEntries: [
              {
                estimatedAmount: dec(800),
                allocations: [
                  {
                    allocatedAmount: dec(500),
                    fundingSource: { id: 'fs1', name: 'SVO Funds', color: '#3b82f6' },
                  },
                ],
              },
            ],
            actuals: [{ amount: dec(200), fundingSourceId: 'fs1' }],
          },
        ],
      },
    ]

    const result = buildDashboardData(projects as Parameters<typeof buildDashboardData>[0])

    expect(result.summary.estimatedCosts).toBe(800)
    expect(result.summary.securedFunding).toBe(500)
    expect(result.summary.spentToDate).toBe(200)
    expect(result.summary.remaining).toBe(600)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].spent).toBe(200)
    expect(result.projects[0].secured).toBe(500)
    expect(result.projects[0].fundingGap).toBe(300)
    expect(result.projects[0].fundingSources).toHaveLength(1)
    expect(result.projects[0].fundingSources[0].allocatedTotal).toBe(500)
  })

  it('deduplicates funding sources across budget entries', () => {
    const projects = [
      {
        id: 'p1',
        name: 'Observatory',
        projectType: 'claimed',
        categories: [
          {
            budgetEntries: [
              {
                estimatedAmount: dec(400),
                allocations: [
                  {
                    allocatedAmount: dec(200),
                    fundingSource: { id: 'fs1', name: 'Grant A', color: '#3b82f6' },
                  },
                ],
              },
              {
                estimatedAmount: dec(600),
                allocations: [
                  {
                    allocatedAmount: dec(300),
                    fundingSource: { id: 'fs1', name: 'Grant A', color: '#3b82f6' },
                  },
                ],
              },
            ],
            actuals: [],
          },
        ],
      },
    ]

    const result = buildDashboardData(projects as Parameters<typeof buildDashboardData>[0])
    expect(result.projects[0].fundingSources).toHaveLength(1)
    expect(result.projects[0].fundingSources[0].allocatedTotal).toBe(500)
  })
})
