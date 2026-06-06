jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { GET, PATCH, DELETE } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockFindUnique = prisma.project.findUnique as jest.Mock
const mockUpdate = prisma.project.update as jest.Mock
const mockUpdateMany = prisma.project.updateMany as jest.Mock
const mockDelete = prisma.project.delete as jest.Mock

const params = Promise.resolve({ id: 'p1' })

const dec = (n: number) => ({ toNumber: () => n })

const makeProject = () => ({
  id: 'p1',
  name: 'Observatory',
  description: null,
  projectType: 'claimed',
  categories: [
    {
      id: 'cat-1',
      name: 'Construction',
      qboAccountId: 'acc-1',
      sortOrder: 0,
      budgetEntries: [
        {
          id: 'entry-1',
          name: 'Concrete',
          estimatedAmount: dec(1000),
          bidStatus: 'bid',
          sortOrder: 0,
          allocations: [
            {
              id: 'alloc-1',
              allocatedAmount: dec(600),
              fundingSource: { id: 'fs-1', name: 'Grant A', shortName: null, color: '#3b82f6', totalFunds: dec(5000), qboClassId: 'cls-1', qboClassName: 'Grant A' },
            },
          ],
        },
      ],
      actuals: [
        {
          id: 'act-1',
          amount: dec(400),
          date: new Date('2024-03-01'),
          vendor: 'Home Depot',
          memo: null,
          qboTransactionType: 'Purchase',
          bidStatus: 'not_bid',
          fundingSourceId: 'fs-1',
          fundingSource: { id: 'fs-1', name: 'Grant A', color: '#3b82f6' },
        },
      ],
    },
  ],
})

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
})

describe('GET /api/projects/[id]', () => {
  it('returns 404 when project not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/projects/p1')
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it('returns computed project summary', async () => {
    mockFindUnique.mockResolvedValue(makeProject())
    const req = new NextRequest('http://localhost/api/projects/p1')
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalEstimated).toBe(1000)
    expect(body.totalSecured).toBe(600)
    expect(body.totalSpent).toBe(400)
    expect(body.fundingGap).toBe(400)
  })

  it('deduplicates funding sources across entries', async () => {
    const project = makeProject()
    project.categories[0].budgetEntries.push({
      id: 'entry-2',
      name: 'Steel',
      estimatedAmount: dec(500),
      bidStatus: 'bid',
      sortOrder: 1,
      allocations: [
        {
          id: 'alloc-2',
          allocatedAmount: dec(200),
          fundingSource: { id: 'fs-1', name: 'Grant A', shortName: null, color: '#3b82f6', totalFunds: dec(5000), qboClassId: 'cls-1', qboClassName: 'Grant A' },
        },
      ],
    })
    mockFindUnique.mockResolvedValue(project)
    const req = new NextRequest('http://localhost/api/projects/p1')
    const res = await GET(req, { params })
    const body = await res.json()
    expect(body.fundingSources).toHaveLength(1)
    expect(body.fundingSources[0].allocatedTotal).toBe(800)
    expect(body.fundingSources[0].totalFunds).toBe(5000)
  })

  it('shapes category and actuals data correctly', async () => {
    mockFindUnique.mockResolvedValue(makeProject())
    const req = new NextRequest('http://localhost/api/projects/p1')
    const res = await GET(req, { params })
    const body = await res.json()
    const cat = body.categories[0]
    expect(cat.totalBudget).toBe(1000)
    expect(cat.totalSpent).toBe(400)
    expect(cat.totalAllocated).toBe(600)
    expect(cat.actuals[0].date).toBe('2024-03-01')
  })

  it('includes bidStatus on budget entries and actuals', async () => {
    mockFindUnique.mockResolvedValue(makeProject())
    const req = new NextRequest('http://localhost/api/projects/p1')
    const res = await GET(req, { params })
    const body = await res.json()
    const cat = body.categories[0]
    expect(cat.budgetEntries[0].bidStatus).toBe('bid')
    expect(cat.actuals[0].bidStatus).toBe('not_bid')
  })
})

describe('PATCH /api/projects/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const req = new NextRequest('http://localhost/api/projects/p1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('clears qboAccountId from other projects when assigning one', async () => {
    const updated = { id: 'p1', name: 'Observatory', description: null, qboAccountId: 'acc-99' }
    mockUpdateMany.mockResolvedValue({})
    mockUpdate.mockResolvedValue(updated)
    const req = new NextRequest('http://localhost/api/projects/p1', {
      method: 'PATCH',
      body: JSON.stringify({ qboAccountId: 'acc-99' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { qboAccountId: 'acc-99', NOT: { id: 'p1' } },
      data: { qboAccountId: null },
    })
  })

  it('updates name with trimming', async () => {
    const updated = { id: 'p1', name: 'Trimmed', description: null, qboAccountId: null }
    mockUpdate.mockResolvedValue(updated)
    const req = new NextRequest('http://localhost/api/projects/p1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '  Trimmed  ' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Trimmed' }),
    }))
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const req = new NextRequest('http://localhost/api/projects/p1', { method: 'DELETE' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(401)
  })

  it('deletes and returns ok', async () => {
    mockDelete.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/projects/p1', { method: 'DELETE' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })
})
