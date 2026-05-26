jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userRole: { upsert: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockUpsert = prisma.userRole.upsert as jest.Mock

const params = Promise.resolve({ id: 'user-1' })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue(null)
})

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/users/user-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PATCH /api/users/[id]', () => {
  it('returns 401/403 when not admin', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const res = await PATCH(makeRequest({ role: 'admin' }), { params })
    expect(res.status).toBe(403)
  })

  it('upserts and returns user role', async () => {
    const upserted = { userId: 'user-1', role: 'admin' }
    mockUpsert.mockResolvedValue(upserted)
    const res = await PATCH(makeRequest({ role: 'admin' }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(upserted)
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: { role: 'admin' },
      create: { userId: 'user-1', role: 'admin' },
    })
  })

  it('accepts viewer role', async () => {
    mockUpsert.mockResolvedValue({ userId: 'user-1', role: 'viewer' })
    const res = await PATCH(makeRequest({ role: 'viewer' }), { params })
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid role', async () => {
    const res = await PATCH(makeRequest({ role: 'superuser' }), { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/role/i)
  })
})
