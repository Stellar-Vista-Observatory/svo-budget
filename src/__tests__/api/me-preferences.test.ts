jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userRole: {
      findUnique: jest.fn(),
    },
    userPreference: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { GET, PATCH } from '@/app/api/me/preferences/route'

const mockCreateClient = createClient as jest.Mock

function mockSession(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default role mock to avoid auth failures
  ;(prisma.userRole.findUnique as jest.Mock).mockResolvedValue({ role: 'editor' })
})

describe('GET /api/me/preferences', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('upserts default row and returns showActualsAsNegative: true on first call', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      showActualsAsNegative: true,
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ showActualsAsNegative: true })
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', showActualsAsNegative: true },
      update: {},
      select: { showActualsAsNegative: true },
    })
  })

  it('returns existing preference when row already exists', async () => {
    mockSession({ id: 'user-2' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      showActualsAsNegative: false,
    })
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ showActualsAsNegative: false })
  })
})

describe('PATCH /api/me/preferences', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: false }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('persists showActualsAsNegative: false', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      showActualsAsNegative: false,
    })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: false }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ showActualsAsNegative: false })
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', showActualsAsNegative: false },
      update: { showActualsAsNegative: false },
      select: { showActualsAsNegative: true },
    })
  })

  it('persists showActualsAsNegative: true', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      showActualsAsNegative: true,
    })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: true }),
    })
    const res = await PATCH(req)
    const body = await res.json()
    expect(body).toEqual({ showActualsAsNegative: true })
  })
})
