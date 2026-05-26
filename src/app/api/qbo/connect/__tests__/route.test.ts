jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }))
jest.mock('@/lib/qbo/auth', () => ({ buildAuthUrl: jest.fn().mockReturnValue('https://oauth.intuit.com/auth?state=test') }))

import { GET } from '../route'
import { requireAuth } from '@/lib/auth'

const mockRequireAuth = requireAuth as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' }, role: 'viewer' })
})

describe('GET /api/qbo/connect', () => {
  it('returns 401 when unauthenticated', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAuth.mockResolvedValue({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('redirects to QBO OAuth URL when authenticated', async () => {
    const res = await GET()
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('oauth.intuit.com')
  })
})
