import { syncAll, getOrCreateCatchAllProject } from '@/lib/qbo/sync'

jest.mock('@/lib/qbo/client', () => ({
  getValidConnection: jest.fn(),
  qboQuery: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    category: { findMany: jest.fn(), upsert: jest.fn() },
    fundingSource: { findMany: jest.fn(), upsert: jest.fn() },
    actual: { upsert: jest.fn() },
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

    // 1 "General" category for root + 2 direct children = 3
    expect(result.categoriesSynced).toBe(3)
    expect(mockPrisma.category.upsert).toHaveBeenCalledTimes(3)

    // First call is the "General" category for the root account
    const generalCall = (mockPrisma.category.upsert as jest.Mock).mock.calls[0][0]
    expect(generalCall.create.projectId).toBe('proj-1')
    expect(generalCall.where.qboAccountId).toBe('parent-1')
    expect(generalCall.create.name).toBe('General')

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
    expect(result.id).toBe('new-catch-all')
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
    expect(result.id).toBe('existing-catch-all')
  })
})
