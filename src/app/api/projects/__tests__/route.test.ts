jest.mock('@/lib/auth', () => ({ requireWriteAccess: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn(), create: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { requireWriteAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockRequireWriteAccess = requireWriteAccess as jest.Mock
const mockFindMany = prisma.project.findMany as jest.Mock
const mockCreate = prisma.project.create as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireWriteAccess.mockResolvedValue(null)
})

describe('GET /api/projects', () => {
  it('returns project list without auth', async () => {
    const projects = [{ id: 'p1', name: 'Observatory', projectType: 'claimed', qboAccountId: null }]
    mockFindMany.mockResolvedValue(projects)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ projects })
  })
})

describe('POST /api/projects', () => {
  it('returns 401/403 when write access denied', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireWriteAccess.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Project' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates and returns project with 201', async () => {
    const created = { id: 'p-new', name: 'New Project', projectType: 'claimed', qboAccountId: null }
    mockCreate.mockResolvedValue(created)
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Project' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(created)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'New Project', projectType: 'claimed' }),
    }))
  })

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name/)
  })

  it('returns 400 when name is empty string', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
