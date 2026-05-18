import { prisma } from '@/lib/prisma'
import { getValidConnection, qboQuery } from './client'
import type { QboConnection } from '@prisma/client'

interface QboAccount {
  Id: string
  Name: string
  FullyQualifiedName: string
  ParentRef?: { value: string; name: string }
  AccountType: string
  Active: boolean
}

interface QboClass {
  Id: string
  Name: string
  Active: boolean
}

interface QboTransactionLine {
  LineNum: number
  Amount: number
  DetailType: string
  AccountBasedExpenseLineDetail?: {
    AccountRef: { value: string; name: string }
    ClassRef?: { value: string; name: string }
  }
}

interface QboPurchase {
  Id: string
  TxnDate: string
  EntityRef?: { value: string; name: string }
  Line: QboTransactionLine[]
}

interface QboBill {
  Id: string
  TxnDate: string
  VendorRef?: { value: string; name: string }
  Line: QboTransactionLine[]
}

function collectSubtree(accounts: QboAccount[], rootId: string): Set<string> {
  const result = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const acct of accounts) {
      if (acct.ParentRef?.value === current && !result.has(acct.Id)) {
        result.add(acct.Id)
        queue.push(acct.Id)
      }
    }
  }
  return result
}

export async function syncAll(): Promise<{ lineItemsUpserted: number; actualsUpserted: number }> {
  const conn = await getValidConnection()

  const [accounts, classes] = await Promise.all([
    qboQuery<QboAccount>(conn.realmId, conn.accessToken, 'SELECT * FROM Account MAXRESULTS 1000'),
    qboQuery<QboClass>(conn.realmId, conn.accessToken, 'SELECT * FROM Class MAXRESULTS 1000'),
  ])

  const lineItemsUpserted = await syncLineItems(accounts)
  await syncFundingSources(classes)
  const actualsUpserted = await syncTransactions(conn, accounts, classes)

  await prisma.qboConnection.update({
    where: { id: conn.id },
    data: { lastSyncedAt: new Date() },
  })

  return { lineItemsUpserted, actualsUpserted }
}

async function syncLineItems(accounts: QboAccount[]): Promise<number> {
  const projects = await prisma.project.findMany()
  const claimedProjects = projects.filter(
    (p) => p.projectType === 'claimed' && p.qboAccountId
  )
  const catchAllProject = projects.find((p) => p.projectType === 'catch_all')

  const claimedAccountIds = new Set<string>()
  let upsertCount = 0

  for (const project of claimedProjects) {
    const subtree = collectSubtree(accounts, project.qboAccountId!)
    subtree.forEach((id) => claimedAccountIds.add(id))

    for (const accountId of subtree) {
      const account = accounts.find((a) => a.Id === accountId)
      if (!account) continue

      await prisma.lineItem.upsert({
        where: { qboAccountId: accountId },
        update: {
          projectId: project.id,
          name: account.Name,
          displayPath: account.FullyQualifiedName,
          qboAccountName: account.Name,
          isActive: account.Active,
        },
        create: {
          projectId: project.id,
          name: account.Name,
          displayPath: account.FullyQualifiedName,
          qboAccountId: accountId,
          qboAccountName: account.Name,
          isActive: account.Active,
        },
      })
      upsertCount++
    }
  }

  if (catchAllProject) {
    const unclaimed = accounts.filter((a) => !claimedAccountIds.has(a.Id) && a.Active)
    for (const account of unclaimed) {
      await prisma.lineItem.upsert({
        where: { qboAccountId: account.Id },
        update: {
          projectId: catchAllProject.id,
          name: account.Name,
          displayPath: account.FullyQualifiedName,
          qboAccountName: account.Name,
          isActive: account.Active,
        },
        create: {
          projectId: catchAllProject.id,
          name: account.Name,
          displayPath: account.FullyQualifiedName,
          qboAccountId: account.Id,
          qboAccountName: account.Name,
          isActive: account.Active,
        },
      })
      upsertCount++
    }
  }

  return upsertCount
}

const COLOR_PALETTE = ['#3b82f6','#16a34a','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

async function syncFundingSources(classes: QboClass[]): Promise<void> {
  const existing = await prisma.fundingSource.findMany({
    select: { id: true, qboClassId: true, qboClassName: true },
  })
  const existingByClassId = new Map(existing.map((fs) => [fs.qboClassId, fs]))
  let colorIdx = existing.length

  for (const cls of classes) {
    if (!cls.Active) continue
    const found = existingByClassId.get(cls.Id)
    if (found) {
      if (found.qboClassName !== cls.Name) {
        await prisma.fundingSource.update({
          where: { id: found.id },
          data: { qboClassName: cls.Name, name: cls.Name },
        })
      }
    } else {
      await prisma.fundingSource.create({
        data: {
          name: cls.Name,
          color: COLOR_PALETTE[colorIdx % COLOR_PALETTE.length],
          allocatedTotal: 0,
          qboClassId: cls.Id,
          qboClassName: cls.Name,
        },
      })
      colorIdx++
    }
  }
}

async function syncTransactions(
  conn: Pick<QboConnection, 'realmId' | 'accessToken' | 'lastSyncedAt'>,
  _accounts: QboAccount[],
  _classes: QboClass[]
): Promise<number> {
  const since = conn.lastSyncedAt
    ? conn.lastSyncedAt.toISOString().split('T')[0]
    : '2020-01-01'

  const [purchases, bills] = await Promise.all([
    qboQuery<QboPurchase>(
      conn.realmId,
      conn.accessToken,
      `SELECT * FROM Purchase WHERE TxnDate >= '${since}' MAXRESULTS 1000`
    ),
    qboQuery<QboBill>(
      conn.realmId,
      conn.accessToken,
      `SELECT * FROM Bill WHERE TxnDate >= '${since}' MAXRESULTS 1000`
    ),
  ])

  const lineItems = await prisma.lineItem.findMany({
    select: { id: true, qboAccountId: true },
  })
  const fundingSources = await prisma.fundingSource.findMany({
    select: { id: true, qboClassId: true },
  })

  const lineItemByAccount = new Map(lineItems.map((li) => [li.qboAccountId, li]))
  const fundingSourceByClass = new Map(fundingSources.map((fs) => [fs.qboClassId, fs]))

  let upsertCount = 0

  async function processLines(
    txnId: string,
    txnType: string,
    txnDate: string,
    vendor: string | undefined,
    lines: QboTransactionLine[]
  ) {
    for (const line of lines) {
      const detail = line.AccountBasedExpenseLineDetail
      if (!detail?.AccountRef?.value) continue

      const lineItem = lineItemByAccount.get(detail.AccountRef.value)
      if (!lineItem) continue

      const classId = detail.ClassRef?.value
      const fundingSource = classId ? fundingSourceByClass.get(classId) : undefined
      const matchedFsId = fundingSource ? fundingSource.id : null

      const qboTransactionId = `${txnType}-${txnId}-${line.LineNum}`

      await prisma.actual.upsert({
        where: {
          qboTransactionId_lineItemId: { qboTransactionId, lineItemId: lineItem.id },
        },
        update: {
          amount: line.Amount,
          date: new Date(txnDate),
          vendor: vendor ?? null,
          fundingSourceId: matchedFsId,
          qboTransactionType: txnType,
        },
        create: {
          lineItemId: lineItem.id,
          fundingSourceId: matchedFsId,
          amount: line.Amount,
          date: new Date(txnDate),
          vendor: vendor ?? null,
          qboTransactionId,
          qboTransactionType: txnType,
        },
      })
      upsertCount++
    }
  }

  for (const txn of purchases) {
    await processLines(txn.Id, 'Purchase', txn.TxnDate, txn.EntityRef?.name, txn.Line)
  }
  for (const txn of bills) {
    await processLines(txn.Id, 'Bill', txn.TxnDate, txn.VendorRef?.name, txn.Line)
  }

  return upsertCount
}
