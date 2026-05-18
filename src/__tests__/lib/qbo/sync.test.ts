import { syncAll } from '@/lib/qbo/sync'

// Mock the QBO client
jest.mock('@/lib/qbo/client', () => ({
  getValidConnection: jest.fn(),
  qboQuery: jest.fn(),
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn() },
    lineItem: { findMany: jest.fn(), upsert: jest.fn() },
    fundingSource: { findMany: jest.fn(), update: jest.fn(), upsert: jest.fn() },
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
})

describe('syncAll — line items', () => {
  it('creates line items for accounts in a claimed project subtree', async () => {
    const accounts = [
      { Id: 'parent-1', Name: 'Observatory Construction', FullyQualifiedName: 'Observatory Construction', Active: true, AccountType: 'Expense' },
      { Id: 'child-1', Name: 'Foundation', FullyQualifiedName: 'Observatory Construction:Foundation', ParentRef: { value: 'parent-1' }, Active: true, AccountType: 'Expense' },
    ]
    const classes = [{ Id: 'class-1', Name: 'SVO Funds', Active: true }]

    mockQboQuery
      .mockResolvedValueOnce(accounts)  // accounts query
      .mockResolvedValueOnce(classes)   // classes query
      .mockResolvedValueOnce([])        // Purchase query
      .mockResolvedValueOnce([])        // Bill query

    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'proj-1', projectType: 'claimed', qboAccountId: 'parent-1' },
    ])
    ;(mockPrisma.lineItem.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.lineItem.upsert as jest.Mock).mockResolvedValue({})

    const result = await syncAll()

    expect(result.lineItemsUpserted).toBe(2)
    expect(mockPrisma.lineItem.upsert).toHaveBeenCalledTimes(2)

    const firstCall = (mockPrisma.lineItem.upsert as jest.Mock).mock.calls[0][0]
    expect(firstCall.create.projectId).toBe('proj-1')
    expect(firstCall.where.qboAccountId).toBe('parent-1')
  })

  it('puts unclaimed accounts into catch_all project', async () => {
    const accounts = [
      { Id: 'acc-1', Name: 'Office Supplies', FullyQualifiedName: 'Office Supplies', Active: true, AccountType: 'Expense' },
    ]
    const classes: unknown[] = []

    mockQboQuery
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce(classes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'catch-1', projectType: 'catch_all', qboAccountId: null },
    ])
    ;(mockPrisma.lineItem.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.lineItem.upsert as jest.Mock).mockResolvedValue({})

    const result = await syncAll()

    expect(result.lineItemsUpserted).toBe(1)
    const upsertCall = (mockPrisma.lineItem.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertCall.create.projectId).toBe('catch-1')
  })
})

describe('syncAll — transactions', () => {
  it('creates actuals from Purchase transactions', async () => {
    const accounts: unknown[] = []
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
              AccountRef: { value: 'acc-1' },
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

    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.lineItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'li-1', qboAccountId: 'acc-1' },
    ])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([
      { id: 'fs-1', qboClassId: 'class-1' },
    ])
    ;(mockPrisma.actual.upsert as jest.Mock).mockResolvedValue({})

    const result = await syncAll()

    expect(result.actualsUpserted).toBe(1)
    const upsertCall = (mockPrisma.actual.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertCall.create.vendor).toBe('Home Depot')
    expect(upsertCall.create.amount).toBe(500)
    expect(upsertCall.create.fundingSourceId).toBe('fs-1')
    expect(upsertCall.create.qboTransactionId).toBe('Purchase-txn-1-1')
  })

  it('sets fundingSourceId when class matches, regardless of project', async () => {
    mockQboQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          Id: 'txn-2',
          TxnDate: '2024-03-01',
          Line: [
            {
              LineNum: 1,
              Amount: 100,
              DetailType: 'AccountBasedExpenseLineDetail',
              AccountBasedExpenseLineDetail: {
                AccountRef: { value: 'acc-1' },
                ClassRef: { value: 'class-1' },
              },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([])

    ;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.lineItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'li-1', qboAccountId: 'acc-1' },
    ])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([
      { id: 'fs-1', qboClassId: 'class-1' },
    ])
    ;(mockPrisma.actual.upsert as jest.Mock).mockResolvedValue({})

    await syncAll()

    const upsertCall = (mockPrisma.actual.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertCall.create.fundingSourceId).toBe('fs-1')
  })
})
