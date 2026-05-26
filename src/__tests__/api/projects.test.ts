jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn() },
  },
}))

import { GET } from '@/app/api/projects/route'
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.project.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/projects', () => {
  it('orders claimed projects before catch_all', async () => {
    await GET()

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, projectType: true, qboAccountId: true },
      orderBy: [{ projectType: 'desc' }, { createdAt: 'asc' }],
    })
  })
})
