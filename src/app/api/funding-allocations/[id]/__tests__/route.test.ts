jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fundingAllocation: { update: jest.fn(), delete: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { PATCH, DELETE } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockUpdate = prisma.fundingAllocation.update as jest.Mock
const mockDelete = prisma.fundingAllocation.delete as jest.Mock

const params = Promise.resolve({ id: 'alloc-1' })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
})

describe('PATCH /api/funding-allocations/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const req = new NextRequest('http://localhost/api/funding-allocations/alloc-1', {
      method: 'PATCH',
      body: JSON.stringify({ allocatedAmount: 100 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('updates and returns the allocation', async () => {
    const updated = { id: 'alloc-1', allocatedAmount: 250 }
    mockUpdate.mockResolvedValue(updated)
    const req = new NextRequest('http://localhost/api/funding-allocations/alloc-1', {
      method: 'PATCH',
      body: JSON.stringify({ allocatedAmount: 250 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'alloc-1' }, data: { allocatedAmount: 250 } })
    )
  })

  it('returns 400 when amount is negative', async () => {
    const req = new NextRequest('http://localhost/api/funding-allocations/alloc-1', {
      method: 'PATCH',
      body: JSON.stringify({ allocatedAmount: -5 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/allocatedAmount/)
  })
})

describe('DELETE /api/funding-allocations/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const req = new NextRequest('http://localhost/api/funding-allocations/alloc-1', { method: 'DELETE' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(403)
  })

  it('deletes and returns ok', async () => {
    mockDelete.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/funding-allocations/alloc-1', { method: 'DELETE' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'alloc-1' } })
  })
})
