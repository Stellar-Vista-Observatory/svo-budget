jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fundingSource: { findMany: jest.fn() },
  },
}))

import { GET } from '../route'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireAuth = requireAuth as jest.Mock
const mockFindMany = prisma.fundingSource.findMany as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' }, role: 'viewer' })
})

describe('GET /api/funding-sources', () => {
  it('returns 401 when unauthenticated', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAuth.mockResolvedValue({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns funding sources with totalFunds coerced to a number (not a Decimal string)', async () => {
    // Prisma returns Decimal objects for totalFunds; they serialize to strings
    // unless converted, which breaks numeric summing on the client.
    const sources = [{ id: 'fs-1', name: 'Grant A', shortName: 'GA', color: '#3b82f6', totalFunds: { valueOf: () => '500' } }]
    mockFindMany.mockResolvedValue(sources)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([{ id: 'fs-1', name: 'Grant A', shortName: 'GA', color: '#3b82f6', totalFunds: 500 }])
    expect(typeof body[0].totalFunds).toBe('number')
  })
})
