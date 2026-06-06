jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    actual: { update: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockUpdate = prisma.actual.update as jest.Mock

const params = Promise.resolve({ id: 'actual-1' })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/actuals/actual-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
})

describe('PATCH /api/actuals/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const res = await PATCH(makeRequest({ bidStatus: 'bid' }), { params })
    expect(res.status).toBe(401)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('updates only the bidStatus field', async () => {
    const updated = { id: 'actual-1', bidStatus: 'bid' }
    mockUpdate.mockResolvedValue(updated)
    const res = await PATCH(makeRequest({ bidStatus: 'bid' }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'actual-1' },
      data: { bidStatus: 'bid' },
      select: { id: true, bidStatus: true },
    })
  })

  it('accepts null bidStatus to clear it', async () => {
    mockUpdate.mockResolvedValue({ id: 'actual-1', bidStatus: null })
    const res = await PATCH(makeRequest({ bidStatus: null }), { params })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { bidStatus: null } })
    )
  })

  it('returns 400 for an invalid bidStatus value', async () => {
    const res = await PATCH(makeRequest({ bidStatus: 'maybe' }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/bidStatus/)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('does not allow editing QBO-owned fields like amount', async () => {
    mockUpdate.mockResolvedValue({ id: 'actual-1', bidStatus: null })
    await PATCH(makeRequest({ bidStatus: 'not_bid', amount: 999 }), { params })
    const dataArg = mockUpdate.mock.calls[0][0].data
    expect(dataArg).not.toHaveProperty('amount')
  })
})
