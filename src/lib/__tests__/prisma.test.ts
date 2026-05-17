import { prisma } from '../prisma'

describe('prisma singleton', () => {
  it('returns the same instance on multiple imports', async () => {
    const { prisma: prisma2 } = await import('../prisma')
    expect(prisma).toBe(prisma2)
  })
})
