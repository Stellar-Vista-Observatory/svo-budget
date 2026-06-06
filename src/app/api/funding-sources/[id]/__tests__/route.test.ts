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
    const updated = { id: 'fs-1', name: 'Updated', color: '#3b82f6', totalFunds: 500 }
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

  it('updates totalFunds when provided', async () => {
    mockUpdate.mockResolvedValue({ id: 'fs-1', name: 'Grant A', color: '#3b82f6', totalFunds: 25000 })
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', {
      method: 'PATCH',
      body: JSON.stringify({ totalFunds: 25000 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fs-1' }, data: { totalFunds: 25000 } })
    )
  })

  it('rejects a negative totalFunds', async () => {
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', {
      method: 'PATCH',
      body: JSON.stringify({ totalFunds: -5 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/totalFunds/)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('updates a trimmed shortName when provided', async () => {
    mockUpdate.mockResolvedValue({ id: 'fs-1', name: 'Grant A', shortName: 'BBF', color: '#3b82f6', totalFunds: 0 })
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', {
      method: 'PATCH',
      body: JSON.stringify({ shortName: '  BBF  ' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fs-1' }, data: { shortName: 'BBF' } })
    )
  })

  it('clears the shortName (stores null) when given a blank string', async () => {
    mockUpdate.mockResolvedValue({ id: 'fs-1', name: 'Grant A', shortName: null, color: '#3b82f6', totalFunds: 0 })
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', {
      method: 'PATCH',
      body: JSON.stringify({ shortName: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fs-1' }, data: { shortName: null } })
    )
  })

  it('rejects a non-string, non-null shortName', async () => {
    const req = new NextRequest('http://localhost/api/funding-sources/fs-1', {
      method: 'PATCH',
      body: JSON.stringify({ shortName: 123 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/shortName/)
    expect(mockUpdate).not.toHaveBeenCalled()
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
