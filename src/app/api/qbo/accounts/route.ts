import { getValidConnection, qboQuery } from '@/lib/qbo/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

interface QboAccount {
  Id: string
  Name: string
  FullyQualifiedName: string
  ParentRef?: { value: string }
  AccountType: string
  Active: boolean
}

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  try {
    const conn = await getValidConnection()
    const accounts = await qboQuery<QboAccount>(
      conn.realmId,
      conn.accessToken,
      'SELECT * FROM Account MAXRESULTS 1000'
    )
    const topLevel = accounts.filter(
      (a) => !a.ParentRef && a.Active && a.AccountType === 'Expense'
    )
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, qboAccountId: true },
    })
    const claimMap = new Map(projects.map((p) => [p.qboAccountId, p]))

    const annotated = topLevel.map((a) => ({
      id: a.Id,
      name: a.Name,
      claimedByProject: claimMap.get(a.Id) ?? null,
    }))

    return NextResponse.json({ accounts: annotated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch accounts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
