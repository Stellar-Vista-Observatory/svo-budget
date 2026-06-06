jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fundingSource: { count: jest.fn(), create: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockCount = prisma.fundingSource.count as jest.Mock
const mockCreate = prisma.fundingSource.create as jest.Mock

const params = Promise.resolve({ id: 'p1' })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
  mockCount.mockResolvedValue(0)
})

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/projects/p1/funding-sources', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/projects/[id]/funding-sources', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })
    const res = await POST(makeRequest({ name: 'Grant A', qboClassId: 'c1', qboClassName: 'Grant A', totalFunds: 1000 }), { params })
    expect(res.status).toBe(403)
  })

  it('creates funding source with 201', async () => {
    const created = { id: 'fs-new', name: 'Grant A', color: '#3b82f6', totalFunds: 1000 }
    mockCreate.mockResolvedValue(created)
    const res = await POST(makeRequest({ name: 'Grant A', qboClassId: 'c1', qboClassName: 'Grant A', totalFunds: 1000 }), { params })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(created)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({ qboClassId: 'c1', qboClassName: 'Grant A', totalFunds: 1000 }), { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name/)
  })

  it('returns 400 when totalFunds is negative', async () => {
    const res = await POST(makeRequest({ name: 'Grant A', qboClassId: 'c1', qboClassName: 'Grant A', totalFunds: -1 }), { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/totalFunds/)
  })

  it('assigns cyan (#06b6d4) as the color for the second funding source', async () => {
    mockCount.mockResolvedValue(1) // 1 existing → index 1 in palette
    const created = { id: 'fs-2', name: 'Grant B', color: '#06b6d4', totalFunds: 500 }
    mockCreate.mockResolvedValue(created)
    const res = await POST(
      makeRequest({ name: 'Grant B', qboClassId: 'c2', qboClassName: 'Grant B', totalFunds: 500 }),
      { params }
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.color).toBe('#06b6d4')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ color: '#06b6d4' }) })
    )
  })
})
