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
  Description?: string
  DetailType: string
  AccountBasedExpenseLineDetail?: {
    AccountRef: { value: string; name: string }
    ClassRef?: { value: string; name: string }
  }
  ItemBasedExpenseLineDetail?: {
    AccountRef?: { value: string; name: string }
    ClassRef?: { value: string; name: string }
  }
}

interface QboPurchase {
  Id: string
  TxnDate: string
  PrivateNote?: string
  EntityRef?: { value: string; name: string }
  Line: QboTransactionLine[]
}

interface QboBill {
  Id: string
  TxnDate: string
  PrivateNote?: string
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

function buildAccountToCategoryMap(
  accounts: QboAccount[],
  categories: { id: string; qboAccountId: string }[]
): Map<string, string> {
  const categoryByQboId = new Map(categories.map((c) => [c.qboAccountId, c.id]))
  const accountParentMap = new Map(accounts.map((a) => [a.Id, a.ParentRef?.value]))
  const result = new Map<string, string>()

  for (const account of accounts) {
    let current: string | undefined = account.Id
    while (current) {
      if (categoryByQboId.has(current)) {
        result.set(account.Id, categoryByQboId.get(current)!)
        break
      }
      current = accountParentMap.get(current)
    }
  }

  return result
}

export async function syncAll(): Promise<{ categoriesSynced: number; actualsUpserted: number }> {
  const conn = await getValidConnection()

  const [accounts, classes] = await Promise.all([
    qboQuery<QboAccount>(conn.realmId, conn.accessToken, 'SELECT * FROM Account '),
    qboQuery<QboClass>(conn.realmId, conn.accessToken, 'SELECT * FROM Class '),
  ])

  const { upsertCount: categoriesSynced, catchAllCreated, catchAllProjectId } = await syncCategories(accounts)
  await syncFundingSources(classes)
  // Force a full history re-fetch if the catch-all project is new OR exists but
  // has never had any actuals synced into it (e.g. it was created before this fix).
  const catchAllNeedsBackfill = catchAllCreated || (conn.lastSyncedAt !== null && await prisma.actual.count({
    where: { category: { projectId: catchAllProjectId } },
  }) === 0)
  const txnConn = catchAllNeedsBackfill ? { ...conn, lastSyncedAt: null } : conn
  const actualsUpserted = await syncTransactions(txnConn, accounts)

  await prisma.qboConnection.update({
    where: { id: conn.id },
    data: { lastSyncedAt: new Date() },
  })

  return { categoriesSynced, actualsUpserted }
}

export async function getOrCreateCatchAllProject() {
  const existing = await prisma.project.findFirst({ where: { projectType: 'catch_all' } })
  if (existing) return { project: existing, created: false }
  const project = await prisma.project.create({
    data: { name: 'All Other Expenses', projectType: 'catch_all' },
  })
  return { project, created: true }
}

async function syncCategories(accounts: QboAccount[]): Promise<{ upsertCount: number; catchAllCreated: boolean; catchAllProjectId: string }> {
  const [projects, { project: catchAllProject, created: catchAllCreated }] = await Promise.all([
    prisma.project.findMany(),
    getOrCreateCatchAllProject(),
  ])
  const claimedProjects = projects.filter(
    (p) => p.projectType === 'claimed' && p.qboAccountId
  )

  const claimedAccountIds = new Set<string>()
  let upsertCount = 0

  for (const project of claimedProjects) {
    const subtree = collectSubtree(accounts, project.qboAccountId!)
    subtree.forEach((id) => claimedAccountIds.add(id))

    // Create an "Uncategorized" category for the project root account itself
    // so transactions posted directly to the root aren't dropped
    await prisma.category.upsert({
      where: { qboAccountId: project.qboAccountId! },
      update: { name: 'Uncategorized', qboAccountName: project.qboAccountName ?? 'Uncategorized', projectId: project.id, sortOrder: 0 },
      create: {
        projectId: project.id,
        name: 'Uncategorized',
        qboAccountId: project.qboAccountId!,
        qboAccountName: project.qboAccountName ?? 'Uncategorized',
        sortOrder: 0,
      },
    })
    upsertCount++

    // Direct children of the project root become categories
    const directChildren = accounts.filter(
      (a) => a.ParentRef?.value === project.qboAccountId && a.Active
    )

    for (let i = 0; i < directChildren.length; i++) {
      const acct = directChildren[i]
      await prisma.category.upsert({
        where: { qboAccountId: acct.Id },
        update: { name: acct.Name, qboAccountName: acct.Name, projectId: project.id, sortOrder: i + 1 },
        create: {
          projectId: project.id,
          name: acct.Name,
          qboAccountId: acct.Id,
          qboAccountName: acct.Name,
          sortOrder: i + 1,
        },
      })
      upsertCount++
    }
  }

  // Catch-all: every unclaimed active account becomes its own category (flattened)
  const unclaimed = accounts.filter((a) => !claimedAccountIds.has(a.Id) && a.Active)
  for (let i = 0; i < unclaimed.length; i++) {
    const acct = unclaimed[i]
    await prisma.category.upsert({
      where: { qboAccountId: acct.Id },
      update: { name: acct.Name, qboAccountName: acct.Name, projectId: catchAllProject.id },
      create: {
        projectId: catchAllProject.id,
        name: acct.Name,
        qboAccountId: acct.Id,
        qboAccountName: acct.Name,
        sortOrder: i,
      },
    })
    upsertCount++
  }

  return { upsertCount, catchAllCreated, catchAllProjectId: catchAllProject!.id }
}

const COLOR_PALETTE = ['#3b82f6', '#06b6d4', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

async function syncFundingSources(classes: QboClass[]): Promise<void> {
  const existing = await prisma.fundingSource.findMany({
    select: { qboClassId: true },
  })
  const existingClassIds = new Set(existing.map((fs) => fs.qboClassId))
  let newColorIdx = existing.length

  for (const cls of classes) {
    if (!cls.Active) continue
    const isNew = !existingClassIds.has(cls.Id)
    await prisma.fundingSource.upsert({
      where: { qboClassId: cls.Id },
      update: { qboClassName: cls.Name, name: cls.Name },
      create: {
        name: cls.Name,
        color: COLOR_PALETTE[newColorIdx % COLOR_PALETTE.length],
        allocatedTotal: 0,
        qboClassId: cls.Id,
        qboClassName: cls.Name,
      },
    })
    if (isNew) newColorIdx++
  }
}

async function syncTransactions(
  conn: Pick<QboConnection, 'realmId' | 'accessToken' | 'lastSyncedAt'>,
  accounts: QboAccount[]
): Promise<number> {
  const since = conn.lastSyncedAt
    ? conn.lastSyncedAt.toISOString().split('T')[0]
    : '2020-01-01'

  const [purchases, bills] = await Promise.all([
    qboQuery<QboPurchase>(
      conn.realmId,
      conn.accessToken,
      `SELECT * FROM Purchase WHERE MetaData.LastUpdatedTime >= '${since}'`
    ),
    qboQuery<QboBill>(
      conn.realmId,
      conn.accessToken,
      `SELECT * FROM Bill WHERE MetaData.LastUpdatedTime >= '${since}'`
    ),
  ])

  // Build mapping: any QBO account ID → categoryId (walks up parent chain)
  const categories = await prisma.category.findMany({
    where: { qboAccountId: { not: null } },
    select: { id: true, qboAccountId: true },
  })
  const validCategories = categories.filter(
    (c): c is { id: string; qboAccountId: string } => c.qboAccountId !== null
  )
  const accountToCategoryMap = buildAccountToCategoryMap(accounts, validCategories)

  const fundingSources = await prisma.fundingSource.findMany({
    select: { id: true, qboClassId: true },
  })
  const fundingSourceByClass = new Map(fundingSources.map((fs) => [fs.qboClassId, fs]))

  let upsertCount = 0

  async function processLines(
    txnId: string,
    txnType: string,
    txnDate: string,
    vendor: string | undefined,
    txnMemo: string | undefined,
    lines: QboTransactionLine[]
  ) {
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx]
      const detail = line.AccountBasedExpenseLineDetail ?? line.ItemBasedExpenseLineDetail
      if (!detail?.AccountRef?.value) continue

      const categoryId = accountToCategoryMap.get(detail.AccountRef.value)
      if (!categoryId) continue

      const classId = detail.ClassRef?.value
      const fundingSource = classId ? fundingSourceByClass.get(classId) : undefined
      const matchedFsId = fundingSource ? fundingSource.id : null

      const qboTransactionId = `${txnType}-${txnId}-L${idx}`

      const memo = line.Description || txnMemo || null

      await prisma.actual.upsert({
        where: {
          qboTransactionId_categoryId: { qboTransactionId, categoryId },
        },
        update: {
          amount: line.Amount,
          date: new Date(txnDate),
          vendor: vendor ?? null,
          memo,
          fundingSourceId: matchedFsId,
          qboTransactionType: txnType,
        },
        create: {
          categoryId,
          fundingSourceId: matchedFsId,
          amount: line.Amount,
          date: new Date(txnDate),
          vendor: vendor ?? null,
          memo,
          qboTransactionId,
          qboTransactionType: txnType,
        },
      })
      upsertCount++
    }
  }

  for (const txn of purchases) {
    await processLines(txn.Id, 'Purchase', txn.TxnDate, txn.EntityRef?.name, txn.PrivateNote, txn.Line)
  }
  for (const txn of bills) {
    await processLines(txn.Id, 'Bill', txn.TxnDate, txn.VendorRef?.name, txn.PrivateNote, txn.Line)
  }

  return upsertCount
}
