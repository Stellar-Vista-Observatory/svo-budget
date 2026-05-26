jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fundingAllocation: { create: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockCreate = prisma.fundingAllocation.create as jest.Mock

const params = Promise.resolve({ id: 'entry-1' })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
})

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/line-items/entry-1/allocations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/line-items/[id]/allocations', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const res = await POST(makeRequest({ fundingSourceId: 'fs-1', allocatedAmount: 100 }), { params })
    expect(res.status).toBe(403)
  })

  it('creates and returns allocation with 201', async () => {
    const created = { id: 'alloc-new', budgetEntryId: 'entry-1', fundingSourceId: 'fs-1', allocatedAmount: 300 }
    mockCreate.mockResolvedValue(created)
    const res = await POST(makeRequest({ fundingSourceId: 'fs-1', allocatedAmount: 300 }), { params })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(created)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { budgetEntryId: 'entry-1', fundingSourceId: 'fs-1', allocatedAmount: 300 },
    })
  })

  it('returns 400 when amount is negative', async () => {
    const res = await POST(makeRequest({ fundingSourceId: 'fs-1', allocatedAmount: -10 }), { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/allocatedAmount/)
  })
})
