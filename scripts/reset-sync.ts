import { prisma } from '../src/lib/prisma'

async function main() {
  const result = await prisma.qboConnection.updateMany({ data: { lastSyncedAt: null } })
  console.log(`Reset lastSyncedAt on ${result.count} connection(s)`)
  await prisma.$disconnect()
}

main().catch(console.error)
