import { GET } from '../route'
import { NextResponse } from 'next/server'

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}))

import { requireAuth } from '@/lib/auth'
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>

describe('GET /api/me', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns role when authenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      user: { id: 'user-1' } as never,
      role: 'admin',
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ role: 'admin' })
  })

  it('returns error response when not authenticated', async () => {
    const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    mockRequireAuth.mockResolvedValueOnce({ error: errorResponse })

    const response = await GET()

    expect(response.status).toBe(401)
  })
})
