jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    budgetEntry: { aggregate: jest.fn(), create: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockAggregate = prisma.budgetEntry.aggregate as jest.Mock
const mockCreate = prisma.budgetEntry.create as jest.Mock

const params = Promise.resolve({ id: 'cat-1' })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
  mockAggregate.mockResolvedValue({ _max: { sortOrder: null } })
})

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/categories/cat-1/budget-entries', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/categories/[id]/budget-entries', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const res = await POST(makeRequest({ name: 'Concrete' }), { params })
    expect(res.status).toBe(403)
  })

  it('creates entry with 201 and sortOrder 0 when category is empty', async () => {
    mockAggregate.mockResolvedValue({ _max: { sortOrder: null } })
    const created = { id: 'entry-new', categoryId: 'cat-1', name: 'Concrete', estimatedAmount: 0, sortOrder: 0 }
    mockCreate.mockResolvedValue(created)
    const res = await POST(makeRequest({ name: 'Concrete' }), { params })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(created)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Concrete', sortOrder: 0, estimatedAmount: 0 }),
    }))
  })

  it('assigns next sortOrder after existing entries', async () => {
    mockAggregate.mockResolvedValue({ _max: { sortOrder: 4 } })
    mockCreate.mockResolvedValue({ id: 'entry-new', sortOrder: 5 })
    await POST(makeRequest({ name: 'Steel' }), { params })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sortOrder: 5 }),
    }))
  })

  it('uses provided estimatedAmount', async () => {
    mockCreate.mockResolvedValue({ id: 'entry-new', estimatedAmount: 1500 })
    await POST(makeRequest({ name: 'Lumber', estimatedAmount: 1500 }), { params })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ estimatedAmount: 1500 }),
    }))
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({}), { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name/)
  })

  it('returns 400 when name is blank', async () => {
    const res = await POST(makeRequest({ name: '   ' }), { params })
    expect(res.status).toBe(400)
  })
})
