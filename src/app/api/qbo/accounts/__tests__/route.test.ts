jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }))
jest.mock('@/lib/qbo/client', () => ({ getValidConnection: jest.fn(), qboQuery: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { project: { findMany: jest.fn() } } }))

import { GET } from '../route'
import { requireAuth } from '@/lib/auth'

const mockRequireAuth = requireAuth as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' }, role: 'viewer' })
})

describe('GET /api/qbo/accounts', () => {
  it('returns 401 when unauthenticated', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAuth.mockResolvedValue({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
