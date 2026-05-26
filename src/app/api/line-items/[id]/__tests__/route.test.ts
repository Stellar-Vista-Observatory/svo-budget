jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    budgetEntry: { update: jest.fn(), delete: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { PATCH, DELETE } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockUpdate = prisma.budgetEntry.update as jest.Mock
const mockDelete = prisma.budgetEntry.delete as jest.Mock

const params = Promise.resolve({ id: 'entry-1' })

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/line-items/entry-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
})

describe('PATCH /api/line-items/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const res = await PATCH(makeRequest({ estimatedAmount: 100 }), { params })
    expect(res.status).toBe(401)
  })

  it('updates and returns the entry', async () => {
    const updated = { id: 'entry-1', name: 'Concrete', estimatedAmount: 500 }
    mockUpdate.mockResolvedValue(updated)
    const res = await PATCH(makeRequest({ estimatedAmount: 500 }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'entry-1' } })
    )
  })

  it('returns 400 when validation fails', async () => {
    const res = await PATCH(makeRequest({ estimatedAmount: -1 }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/estimatedAmount/)
  })

  it('returns 400 when name is empty', async () => {
    const res = await PATCH(makeRequest({ name: '  ' }), { params })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/line-items/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    })
    const req = new NextRequest('http://localhost/api/line-items/entry-1', { method: 'DELETE' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(403)
  })

  it('deletes and returns ok', async () => {
    mockDelete.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/line-items/entry-1', { method: 'DELETE' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'entry-1' } })
  })
})
