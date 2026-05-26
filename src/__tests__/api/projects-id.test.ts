jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireWriteAccess: jest.fn(),
}))

import { PATCH, DELETE } from '@/app/api/projects/[id]/route'
import { prisma } from '@/lib/prisma'
import { requireWriteAccess } from '@/lib/auth'

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireWriteAccess as jest.Mock).mockResolvedValue(null)
})

describe('PATCH /api/projects/[id]', () => {
  it('returns 403 when project is catch_all', async () => {
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1', projectType: 'catch_all',
    })

    const req = new Request('http://localhost/api/projects/p1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Renamed' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('The default project cannot be modified or deleted.')
  })

  it('returns 404 when project does not exist', async () => {
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)

    const req = new Request('http://localhost/api/projects/missing', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('returns 403 when project is catch_all', async () => {
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1', projectType: 'catch_all',
    })

    const req = new Request('http://localhost/api/projects/p1', { method: 'DELETE' })

    const res = await DELETE(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('The default project cannot be modified or deleted.')
  })

  it('returns 404 when project does not exist', async () => {
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)

    const req = new Request('http://localhost/api/projects/missing', { method: 'DELETE' })

    const res = await DELETE(req, { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
