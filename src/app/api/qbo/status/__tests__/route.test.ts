jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { qboConnection: { findFirst: jest.fn() } } }))

import { GET } from '../route'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireAuth = requireAuth as jest.Mock
const mockFindFirst = prisma.qboConnection.findFirst as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' }, role: 'viewer' })
})

describe('GET /api/qbo/status', () => {
  it('returns 401 when unauthenticated', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAuth.mockResolvedValue({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns connected=false when no connection', async () => {
    mockFindFirst.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.connected).toBe(false)
    expect(body.connection).toBeNull()
  })

  it('returns connected=true with connection data', async () => {
    const conn = { realmId: 'realm-1', companyName: 'Test Co', lastSyncedAt: null }
    mockFindFirst.mockResolvedValue(conn)
    const res = await GET()
    const body = await res.json()
    expect(body.connected).toBe(true)
    expect(body.connection).toEqual(conn)
  })
})
