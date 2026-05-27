import { syncAll, getOrCreateCatchAllProject } from '@/lib/qbo/sync'

jest.mock('@/lib/qbo/client', () => ({
  getValidConnection: jest.fn(),
  qboQuery: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    category: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    fundingSource: { findMany: jest.fn(), upsert: jest.fn() },
    actual: { upsert: jest.fn(), deleteMany: jest.fn() },
    qboConnection: { update: jest.fn() },
  },
}))

import { getValidConnection, qboQuery } from '@/lib/qbo/client'
import { prisma } from '@/lib/prisma'

const mockGetValidConnection = getValidConnection as jest.Mock
const mockQboQuery = qboQuery as jest.Mock
const mockPrisma = prisma as jest.Mocked<typeof prisma>

const fakeConn = {
  id: 'conn-1',
  realmId: 'realm123',
  accessToken: 'acc-token',
  refreshToken: 'ref-token',
  tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
  lastSyncedAt: null,
  companyName: 'Test Co',
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetValidConnection.mockResolvedValue(fakeConn)
  ;(mockPrisma.qboConnection.update as jest.Mock).mockResolvedValue(fakeConn)
  ;(mockPrisma.fundingSource.upsert as jest.Mock).mockResolvedValue({})
  ;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
    id: 'catch-1', projectType: 'catch_all', name: 'All Other Expenses', qboAccountId: null,
  })
  ;(mockPrisma.actual.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
  ;(mockPrisma.category.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
})

describe('syncAll — categories', () => {
  it('creates categories from direct children of a claimed project root', async () => {
    const accounts = [
      { Id: 'parent-1', Name: 'Observatory Construction', FullyQualifiedName: 'Observatory Construction', Active: true, AccountType: 'Expense' },
      { Id: 'child-1', Name: 'Foundation', FullyQualifiedName: 'Observatory Construction:Foundation', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
      { Id: 'child-2', Name: 'Roofing', FullyQualifiedName: 'Observatory Construction:Roofing', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
    ]
    const classes = [{ Id: 'class-1', Name: 'SVO Funds', Active: true }]

    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce(classes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'proj-1', projectType: 'claimed', qboAccountId: 'parent-1' },
    ])
    ;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
      id: 'catch-1', projectType: 'catch_all', name: 'All Other Expenses', qboAccountId: null,
    })
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])

    const result = await syncAll()

    // 1 "Uncategorized" category for root + 2 direct children = 3
    expect(result.categoriesSynced).toBe(3)
    expect(mockPrisma.category.upsert).toHaveBeenCalledTimes(3)

    // First call is the "Uncategorized" category for the root account
    const uncategorizedCall = (mockPrisma.category.upsert as jest.Mock).mock.calls[0][0]
    expect(uncategorizedCall.create.projectId).toBe('proj-1')
    expect(uncategorizedCall.where.qboAccountId).toBe('parent-1')
    expect(uncategorizedCall.create.name).toBe('Uncategorized')

    // Second call is first direct child
    const childCall = (mockPrisma.category.upsert as jest.Mock).mock.calls[1][0]
    expect(childCall.create.projectId).toBe('proj-1')
    expect(childCall.where.qboAccountId).toBe('child-1')
  })

  it('puts unclaimed accounts into catch_all project as categories', async () => {
    const accounts = [
      { Id: 'acc-1', Name: 'Office Supplies', FullyQualifiedName: 'Office Supplies', Active: true, AccountType: 'Expense' },
    ]
    const classes: unknown[] = []

    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce(classes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
      id: 'catch-1', projectType: 'catch_all', name: 'All Other Expenses', qboAccountId: null,
    })
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])

    const result = await syncAll()

    expect(result.categoriesSynced).toBe(1)
    const upsertCall = (mockPrisma.category.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertCall.create.projectId).toBe('catch-1')
  })
})

describe('syncAll — transactions', () => {
  it('creates actuals linked to categories via account-to-category mapping', async () => {
    const accounts = [
      { Id: 'parent-1', Name: 'Construction', FullyQualifiedName: 'Construction', Active: true, AccountType: 'Expense' },
      { Id: 'child-1', Name: 'Foundation', FullyQualifiedName: 'Construction:Foundation', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
    ]
    const classes: unknown[] = []
    const purchases = [
      {
        Id: 'txn-1',
        TxnDate: '2024-03-01',
        EntityRef: { name: 'Home Depot' },
        Line: [
          {
            LineNum: 1,
            Amount: 500,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: 'child-1' },
              ClassRef: { value: 'class-1' },
            },
          },
        ],
      },
    ]

    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce(classes)
      .mockResolvedValueOnce(purchases)
      .mockResolvedValueOnce([])

    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'proj-1', projectType: 'claimed', qboAccountId: 'parent-1' },
    ])
    ;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
      id: 'catch-1', projectType: 'catch_all', name: 'All Other Expenses', qboAccountId: null,
    })
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([
      { id: 'cat-1', qboAccountId: 'child-1' },
    ])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([
      { id: 'fs-1', qboClassId: 'class-1' },
    ])
    ;(mockPrisma.actual.upsert as jest.Mock).mockResolvedValue({})

    const result = await syncAll()

    expect(result.actualsUpserted).toBe(1)
    const upsertCall = (mockPrisma.actual.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertCall.create.categoryId).toBe('cat-1')
    expect(upsertCall.create.vendor).toBe('Home Depot')
    expect(upsertCall.create.amount).toBe(500)
    expect(upsertCall.create.fundingSourceId).toBe('fs-1')
    expect(upsertCall.create.qboTransactionId).toBe('Purchase-txn-1-L0')
  })

  it('maps deep sub-account transactions to their ancestor category', async () => {
    const accounts = [
      { Id: 'root', Name: 'Project', FullyQualifiedName: 'Project', Active: true, AccountType: 'Expense' },
      { Id: 'cat-acct', Name: 'Personnel', FullyQualifiedName: 'Project:Personnel', ParentRef: { value: 'root' }, Active: true, AccountType: 'Expense' },
      { Id: 'deep-acct', Name: 'Benefits', FullyQualifiedName: 'Project:Personnel:Benefits', ParentRef: { value: 'cat-acct' }, Active: true, AccountType: 'Expense' },
    ]
    const purchases = [
      {
        Id: 'txn-2',
        TxnDate: '2024-04-01',
        Line: [
          {
            LineNum: 1,
            Amount: 200,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: { AccountRef: { value: 'deep-acct' } },
          },
        ],
      },
    ]

    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(purchases)
      .mockResolvedValueOnce([])

    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'proj-1', projectType: 'claimed', qboAccountId: 'root' },
    ])
    ;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
      id: 'catch-1', projectType: 'catch_all', name: 'All Other Expenses', qboAccountId: null,
    })
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([
      { id: 'cat-1', qboAccountId: 'cat-acct' },
    ])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.actual.upsert as jest.Mock).mockResolvedValue({})

    const result = await syncAll()

    expect(result.actualsUpserted).toBe(1)
    const upsertCall = (mockPrisma.actual.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertCall.create.categoryId).toBe('cat-1')
  })
})

describe('getOrCreateCatchAllProject', () => {
  it('creates a catch_all project when none exists', async () => {
    ;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.project.create as jest.Mock).mockResolvedValue({
      id: 'new-catch-all',
      projectType: 'catch_all',
      name: 'All Other Expenses',
      qboAccountId: null,
    })

    const result = await getOrCreateCatchAllProject()

    expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
      where: { projectType: 'catch_all' },
    })
    expect(mockPrisma.project.create).toHaveBeenCalledWith({
      data: { name: 'All Other Expenses', projectType: 'catch_all' },
    })
    expect(result.project!.id).toBe('new-catch-all')
    expect(result.created).toBe(true)
  })

  it('returns existing catch_all project without creating a new one', async () => {
    const existing = {
      id: 'existing-catch-all',
      projectType: 'catch_all',
      name: 'All Other Expenses',
      qboAccountId: null,
    }
    ;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(existing)

    const result = await getOrCreateCatchAllProject()

    expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
      where: { projectType: 'catch_all' },
    })
    expect(mockPrisma.project.create).not.toHaveBeenCalled()
    expect(result.project!.id).toBe('existing-catch-all')
    expect(result.created).toBe(false)
  })
})

describe('syncAll — stale actuals cleanup', () => {
  function setupBasicSync(accounts: unknown[], purchases: unknown[]) {
    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(purchases)
      .mockResolvedValueOnce([])
    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'proj-1', projectType: 'claimed', qboAccountId: 'parent-1' },
    ])
    ;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
      id: 'catch-1', projectType: 'catch_all', name: 'All Other Expenses', qboAccountId: null,
    })
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.actual.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.actual.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
  }

  it('deletes actuals whose qboTransactionId was re-categorised to a different category', async () => {
    const accounts = [
      { Id: 'parent-1', Name: 'Construction', FullyQualifiedName: 'Construction', Active: true, AccountType: 'Expense' },
      { Id: 'cat-a', Name: 'Signage', FullyQualifiedName: 'Construction:Signage', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
    ]
    // Transaction txn-1 is now under cat-a (Signage); it used to be under cat-b (Solar System Walk)
    const purchases = [
      {
        Id: 'txn-1',
        TxnDate: '2026-04-08',
        EntityRef: { name: 'Solar System Trails' },
        Line: [
          {
            LineNum: 1,
            Amount: 1000,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: { AccountRef: { value: 'cat-a' } },
          },
        ],
      },
    ]

    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([
      { id: 'cat-a-id', qboAccountId: 'cat-a' },
    ])
    setupBasicSync(accounts, purchases)

    await syncAll()

    // Must delete actuals for 'Purchase-txn-1-L0' that are NOT mapped to the new category
    expect(mockPrisma.actual.deleteMany).toHaveBeenCalledWith({
      where: {
        qboTransactionId: 'Purchase-txn-1-L0',
        categoryId: { notIn: ['cat-a-id'] },
      },
    })
  })

  it('deletes actuals for transactions that were deleted in QBO during a full sync', async () => {
    // Full sync (lastSyncedAt = null) returns only txn-2; txn-1 was deleted in QBO
    const accounts = [
      { Id: 'parent-1', Name: 'Construction', FullyQualifiedName: 'Construction', Active: true, AccountType: 'Expense' },
      { Id: 'cat-a', Name: 'Signage', FullyQualifiedName: 'Construction:Signage', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
    ]
    const purchases = [
      {
        Id: 'txn-2',
        TxnDate: '2026-04-08',
        EntityRef: { name: 'Vendor B' },
        Line: [
          {
            LineNum: 1,
            Amount: 500,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: { AccountRef: { value: 'cat-a' } },
          },
        ],
      },
    ]

    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([
      { id: 'cat-a-id', qboAccountId: 'cat-a' },
    ])
    setupBasicSync(accounts, purchases)

    await syncAll()

    // Full sync: must purge all actuals whose transaction was deleted from QBO
    expect(mockPrisma.actual.deleteMany).toHaveBeenCalledWith({
      where: { qboTransactionId: { notIn: ['Purchase-txn-2-L0'] } },
    })
  })
})

describe('syncAll — inactive account cleanup', () => {
  it('queries QBO accounts including inactive ones', async () => {
    mockQboQuery.mockResolvedValue([])
    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])

    await syncAll()

    const accountQuery = mockQboQuery.mock.calls[0][2] as string
    expect(accountQuery).toMatch(/Active\s+IN\s*\(true,\s*false\)/i)
  })

  it('deletes categories whose QBO account has been inactivated', async () => {
    const accounts = [
      { Id: 'parent-1', Name: 'Construction', FullyQualifiedName: 'Construction', Active: true, AccountType: 'Expense' },
      { Id: 'child-active', Name: 'Foundation', FullyQualifiedName: 'Construction:Foundation', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
      { Id: 'child-inactive', Name: 'Solar System Walk', FullyQualifiedName: 'Construction:Solar System Walk', ParentRef: { value: 'parent-1' }, Active: false, AccountType: 'Expense' },
    ]

    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'proj-1', projectType: 'claimed', qboAccountId: 'parent-1' },
    ])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])

    await syncAll()

    expect(mockPrisma.category.deleteMany).toHaveBeenCalledWith({
      where: { qboAccountId: { in: ['child-inactive'] } },
    })
  })

  it('does not delete categories for still-active QBO accounts', async () => {
    const accounts = [
      { Id: 'parent-1', Name: 'Construction', FullyQualifiedName: 'Construction', Active: true, AccountType: 'Expense' },
      { Id: 'child-active', Name: 'Foundation', FullyQualifiedName: 'Construction:Foundation', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
    ]

    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'proj-1', projectType: 'claimed', qboAccountId: 'parent-1' },
    ])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])

    await syncAll()

    const deleteCalls = (mockPrisma.category.deleteMany as jest.Mock).mock.calls
    const deletedAnything = deleteCalls.some(
      (call) => (call[0]?.where?.qboAccountId?.in ?? []).length > 0
    )
    expect(deletedAnything).toBe(false)
  })
})

describe('syncAll — always full fetch', () => {
  it('fetches all transactions from 2020-01-01 even when lastSyncedAt is set', async () => {
    const connWithLastSynced = { ...fakeConn, lastSyncedAt: new Date('2025-01-01') }
    mockGetValidConnection.mockResolvedValue(connWithLastSynced)
    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.actual.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    mockQboQuery.mockResolvedValue([])

    await syncAll()

    const purchaseQuery = mockQboQuery.mock.calls[2][2] as string
    expect(purchaseQuery).toContain('2020-01-01')
    expect(purchaseQuery).not.toContain('2025-01-01')
  })

  it('purges deleted-in-QBO actuals on every sync, not just when lastSyncedAt is null', async () => {
    const connWithLastSynced = { ...fakeConn, lastSyncedAt: new Date('2025-01-01') }
    mockGetValidConnection.mockResolvedValue(connWithLastSynced)

    const accounts = [
      { Id: 'parent-1', Name: 'Construction', FullyQualifiedName: 'Construction', Active: true, AccountType: 'Expense' },
      { Id: 'cat-a', Name: 'Signage', FullyQualifiedName: 'Construction:Signage', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
    ]
    const purchases = [
      {
        Id: 'txn-2',
        TxnDate: '2026-04-08',
        EntityRef: { name: 'Vendor B' },
        Line: [{ LineNum: 1, Amount: 500, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { value: 'cat-a' } } }],
      },
    ]
    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(purchases)
      .mockResolvedValueOnce([])
    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'proj-1', projectType: 'claimed', qboAccountId: 'parent-1' },
    ])
    ;(mockPrisma.category.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.category.findMany as jest.Mock).mockResolvedValue([
      { id: 'cat-a-id', qboAccountId: 'cat-a' },
    ])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.actual.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.actual.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })

    await syncAll()

    expect(mockPrisma.actual.deleteMany).toHaveBeenCalledWith({
      where: { qboTransactionId: { notIn: ['Purchase-txn-2-L0'] } },
    })
  })
})
