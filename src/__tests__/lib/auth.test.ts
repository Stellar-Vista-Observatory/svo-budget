jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userRole: { findUnique: jest.fn() },
  },
}))

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getRole, requireAuth, requireAdmin, requireWriteAccess } from '@/lib/auth'

const mockCreateClient = createClient as jest.Mock
const mockFindUnique = prisma.userRole.findUnique as jest.Mock

function mockSession(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getRole', () => {
  it('returns role from database', async () => {
    mockFindUnique.mockResolvedValue({ role: 'admin' })
    expect(await getRole('user-1')).toBe('admin')
  })

  it('defaults to viewer when no role record exists', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await getRole('user-1')).toBe('viewer')
  })
})

describe('requireAuth', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const result = await requireAuth()
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error.status).toBe(401)
  })

  it('returns user and role when authenticated', async () => {
    mockSession({ id: 'user-1' })
    mockFindUnique.mockResolvedValue({ role: 'editor' })
    const result = await requireAuth()
    expect('user' in result).toBe(true)
    if ('user' in result) {
      expect(result.user.id).toBe('user-1')
      expect(result.role).toBe('editor')
    }
  })
})

describe('requireAdmin', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const result = await requireAdmin()
    expect(result).not.toBeNull()
    expect(result!.error.status).toBe(401)
  })

  it('returns 403 when authenticated but not admin', async () => {
    mockSession({ id: 'user-1' })
    mockFindUnique.mockResolvedValue({ role: 'editor' })
    const result = await requireAdmin()
    expect(result).not.toBeNull()
    expect(result!.error.status).toBe(403)
  })

  it('returns null when admin', async () => {
    mockSession({ id: 'user-1' })
    mockFindUnique.mockResolvedValue({ role: 'admin' })
    expect(await requireAdmin()).toBeNull()
  })
})

describe('requireWriteAccess', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const result = await requireWriteAccess()
    expect(result).not.toBeNull()
    expect(result!.error.status).toBe(401)
  })

  it('returns 403 for viewer', async () => {
    mockSession({ id: 'user-1' })
    mockFindUnique.mockResolvedValue(null) // no record → defaults to viewer
    const result = await requireWriteAccess()
    expect(result).not.toBeNull()
    expect(result!.error.status).toBe(403)
  })

  it('returns null for editor', async () => {
    mockSession({ id: 'user-1' })
    mockFindUnique.mockResolvedValue({ role: 'editor' })
    expect(await requireWriteAccess()).toBeNull()
  })

  it('returns null for admin', async () => {
    mockSession({ id: 'user-1' })
    mockFindUnique.mockResolvedValue({ role: 'admin' })
    expect(await requireWriteAccess()).toBeNull()
  })
})
