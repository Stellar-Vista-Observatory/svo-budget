jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn() },
  },
}))

import { GET } from '../route'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireAuth = requireAuth as jest.Mock
const mockFindMany = prisma.project.findMany as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/dashboard', () => {
  it('returns 401 when unauthenticated', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAuth.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns dashboard data when authenticated', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' }, role: 'viewer' })
    mockFindMany.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('projects')
  })

  it('passes project data through buildDashboardData', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' }, role: 'viewer' })
    const dec = (n: number) => ({ toNumber: () => n })
    mockFindMany.mockResolvedValue([
      {
        id: 'p1', name: 'Observatory', projectType: 'claimed',
        categories: [{
          budgetEntries: [{ estimatedAmount: dec(1000), allocations: [] }],
          actuals: [{ amount: dec(400), fundingSourceId: null }],
        }],
      },
    ])
    const res = await GET()
    const body = await res.json()
    expect(body.summary.estimatedCosts).toBe(1000)
    expect(body.summary.spentToDate).toBe(400)
    expect(body.projects).toHaveLength(1)
  })
})
