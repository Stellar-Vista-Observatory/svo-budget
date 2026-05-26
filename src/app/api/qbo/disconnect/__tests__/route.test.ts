jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { qboConnection: { deleteMany: jest.fn() } } }))

import { POST } from '../route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockDeleteMany = prisma.qboConnection.deleteMany as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAdmin.mockResolvedValue(null)
})

describe('POST /api/qbo/disconnect', () => {
  it('returns 401/403 when not admin', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })
    const res = await POST()
    expect(res.status).toBe(403)
  })

  it('deletes connection and returns ok when admin', async () => {
    mockDeleteMany.mockResolvedValue({})
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
