jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fundingSource: { update: jest.fn(), delete: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { PATCH, DELETE } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockUpdate = prisma.fundingSource.update as jest.Mock
const mockDelete = prisma.fundingSource.delete as jest.Mock

const params = Promise.resolve({ id: 'fs-1' })

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
})

describe('PATCH /api/funding-sources/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(403)
  })

  it('updates and returns funding source', async () => {
    const updated = { id: 'fs-1', name: 'Updated', color: '#3b82f6', allocatedTotal: 500 }
    mockUpdate.mockResolvedValue(updated)
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
  })
})

describe('DELETE /api/funding-sources/[id]', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', { method: 'DELETE' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(403)
  })

  it('deletes and returns ok', async () => {
    mockDelete.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', { method: 'DELETE' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
