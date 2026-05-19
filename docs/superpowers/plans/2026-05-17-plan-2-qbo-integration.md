# Plan 2: QBO Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up QuickBooks Online OAuth 2.0, sync chart of accounts → line items, sync class names → funding sources, sync transactions → actuals, and build the Settings page UI to connect/disconnect, trigger sync, and claim QBO accounts per project.

**Architecture:** All QBO logic lives in `src/lib/qbo/` (auth helpers, API client, sync orchestrator). API routes under `src/app/api/qbo/` handle OAuth callbacks and trigger sync. The Settings page is a client component that fetches from these routes. No QBO SDK — raw `fetch` throughout.

**Tech Stack:** Next.js 16.2.6 App Router, Prisma 7, TypeScript, Jest 30 (node environment), Tailwind v4

---

## File Map

```
src/
├── app/
│   ├── api/
│   │   ├── qbo/
│   │   │   ├── connect/route.ts        # GET: build QBO auth URL → redirect
│   │   │   ├── callback/route.ts       # GET: exchange code for tokens, store QboConnection
│   │   │   ├── disconnect/route.ts     # POST: delete QboConnection
│   │   │   ├── sync/route.ts           # POST: run full sync, return counts
│   │   │   ├── status/route.ts         # GET: return connection status + lastSyncedAt
│   │   │   └── accounts/route.ts       # GET: return top-level QBO expense accounts
│   │   └── projects/
│   │       └── [id]/route.ts           # PATCH: update project.qboAccountId
│   └── settings/
│       └── page.tsx                    # QBO settings UI (replaces "Coming soon" stub)
├── lib/
│   └── qbo/
│       ├── auth.ts                     # buildAuthUrl, exchangeCodeForTokens, refreshAccessToken
│       ├── client.ts                   # getValidConnection, qboQuery
│       └── sync.ts                     # syncAll, syncLineItems, syncClassNames, syncTransactions
└── __tests__/
    └── lib/
        └── qbo/
            ├── auth.test.ts
            ├── client.test.ts
            └── sync.test.ts
prisma/
└── schema.prisma                       # Add @@unique([qboAccountId]) to LineItem
```

---

## Task 1: Schema migration + env vars

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

- [ ] **Step 1: Add unique constraint to LineItem**

In `prisma/schema.prisma`, add `@@unique([qboAccountId])` to the `LineItem` model so upserts work during sync:

```prisma
model LineItem {
  id              String       @id @default(uuid())
  projectId       String
  name            String
  displayPath     String
  category        String?
  estimatedAmount Decimal      @db.Decimal(12, 2) @default(0)
  qboAccountId    String
  qboAccountName  String
  isActive        Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  project         Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  allocations     FundingAllocation[]
  actuals         Actual[]

  @@unique([qboAccountId])
  @@index([projectId])
  @@map("line_items")
}
```

- [ ] **Step 2: Push schema to database**

```bash
npx prisma db push
```

Expected output ends with: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Add QBO env vars to .env.example**

```
# QuickBooks Online OAuth
QBO_CLIENT_ID=your_qbo_client_id
QBO_CLIENT_SECRET=your_qbo_client_secret
QBO_REDIRECT_URI=http://localhost:3000/api/qbo/callback
QBO_ENVIRONMENT=sandbox
```

> **Note for Mislav:** After adding these lines to `.env.example`, copy them into `.env.local` and fill in your actual values from the Intuit Developer Portal. For production on Vercel, add these as environment variables in the Vercel dashboard.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat: add LineItem.qboAccountId unique constraint + QBO env vars"
```

---

## Task 2: QBO auth helpers

**Files:**
- Create: `src/lib/qbo/auth.ts`
- Create: `src/__tests__/lib/qbo/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/qbo/auth.test.ts`:

```typescript
import { buildAuthUrl, exchangeCodeForTokens, refreshAccessToken } from '@/lib/qbo/auth'

const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    QBO_CLIENT_ID: 'test-client-id',
    QBO_CLIENT_SECRET: 'test-client-secret',
    QBO_REDIRECT_URI: 'http://localhost:3000/api/qbo/callback',
  }
  global.fetch = jest.fn()
})

afterEach(() => {
  process.env = originalEnv
  jest.restoreAllMocks()
})

describe('buildAuthUrl', () => {
  it('includes required OAuth params', () => {
    const url = buildAuthUrl('my-state-token')
    expect(url).toContain('client_id=test-client-id')
    expect(url).toContain('redirect_uri=')
    expect(url).toContain('response_type=code')
    expect(url).toContain('scope=com.intuit.quickbooks.accounting')
    expect(url).toContain('state=my-state-token')
  })
})

describe('exchangeCodeForTokens', () => {
  it('returns token response on success', async () => {
    const mockTokens = {
      access_token: 'acc123',
      refresh_token: 'ref456',
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
      token_type: 'bearer',
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokens,
    })

    const result = await exchangeCodeForTokens('auth-code')
    expect(result.access_token).toBe('acc123')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws when response is not ok', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400 })
    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow('Token exchange failed: 400')
  })
})

describe('refreshAccessToken', () => {
  it('sends refresh_token grant type', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-acc',
        refresh_token: 'new-ref',
        expires_in: 3600,
        x_refresh_token_expires_in: 8726400,
        token_type: 'bearer',
      }),
    })

    await refreshAccessToken('old-refresh-token')
    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(options.body.toString()).toContain('grant_type=refresh_token')
    expect(options.body.toString()).toContain('refresh_token=old-refresh-token')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/lib/qbo/auth.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/qbo/auth'`

- [ ] **Step 3: Create src/lib/qbo/auth.ts**

```typescript
const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QBO_SCOPE = 'com.intuit.quickbooks.accounting'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
  token_type: string
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID!,
    redirect_uri: process.env.QBO_REDIRECT_URI!,
    response_type: 'code',
    scope: QBO_SCOPE,
    state,
  })
  return `${QBO_AUTH_URL}?${params.toString()}`
}

function basicAuth(): string {
  return Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64')
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI!,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/lib/qbo/auth.test.ts --no-coverage
```

Expected: PASS (3 suites, 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/qbo/auth.ts src/__tests__/lib/qbo/auth.test.ts
git commit -m "feat: QBO OAuth auth helpers (buildAuthUrl, exchangeCodeForTokens, refreshAccessToken)"
```

---

## Task 3: OAuth API routes

**Files:**
- Create: `src/app/api/qbo/connect/route.ts`
- Create: `src/app/api/qbo/callback/route.ts`
- Create: `src/app/api/qbo/disconnect/route.ts`

These routes have no automated tests (they depend on HTTP redirects and external OAuth flow). Manual testing instructions are in Task 7.

- [ ] **Step 1: Create connect route**

Create `src/app/api/qbo/connect/route.ts`:

```typescript
import { buildAuthUrl } from '@/lib/qbo/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const state = crypto.randomUUID()
  const authUrl = buildAuthUrl(state)
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('qbo_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return response
}
```

- [ ] **Step 2: Create callback route**

Create `src/app/api/qbo/callback/route.ts`:

```typescript
import { exchangeCodeForTokens } from '@/lib/qbo/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('qbo_oauth_state')?.value

  if (!code || !realmId || !state || state !== storedState) {
    return NextResponse.redirect(`${origin}/settings?error=qbo_auth`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    // Fetch company name from QBO
    const apiBase = process.env.QBO_ENVIRONMENT === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
      : 'https://quickbooks.api.intuit.com/v3/company'

    const companyRes = await fetch(
      `${apiBase}/${realmId}/companyinfo/${realmId}?minorversion=70`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      }
    )
    const companyData = await companyRes.json()
    const companyName: string = companyData?.CompanyInfo?.CompanyName ?? 'QuickBooks Company'

    await prisma.qboConnection.upsert({
      where: { realmId },
      update: {
        companyName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      create: {
        realmId,
        companyName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })

    const response = NextResponse.redirect(`${origin}/settings?connected=true`)
    response.cookies.delete('qbo_oauth_state')
    return response
  } catch {
    return NextResponse.redirect(`${origin}/settings?error=qbo_auth`)
  }
}
```

- [ ] **Step 3: Create disconnect route**

Create `src/app/api/qbo/disconnect/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
  await prisma.qboConnection.deleteMany()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/qbo/connect/route.ts src/app/api/qbo/callback/route.ts src/app/api/qbo/disconnect/route.ts
git commit -m "feat: QBO OAuth connect/callback/disconnect API routes"
```

---

## Task 4: QBO API client

**Files:**
- Create: `src/lib/qbo/client.ts`
- Create: `src/__tests__/lib/qbo/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/qbo/client.test.ts`:

```typescript
import { qboQuery } from '@/lib/qbo/client'

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('qboQuery', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, QBO_ENVIRONMENT: 'sandbox' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('calls QBO query endpoint and returns entity array', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        QueryResponse: {
          Account: [
            { Id: '1', Name: 'Construction', FullyQualifiedName: 'Construction' },
          ],
        },
      }),
    })

    const accounts = await qboQuery('realm123', 'acc-token', 'SELECT * FROM Account MAXRESULTS 1000')

    expect(accounts).toHaveLength(1)
    expect((accounts[0] as { Name: string }).Name).toBe('Construction')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sandbox-quickbooks.api.intuit.com'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer acc-token' }) })
    )
  })

  it('returns empty array when entity is not in response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ QueryResponse: {} }),
    })

    const result = await qboQuery('realm123', 'token', 'SELECT * FROM Account MAXRESULTS 1000')
    expect(result).toEqual([])
  })

  it('throws on non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(qboQuery('realm123', 'bad-token', 'SELECT * FROM Account MAXRESULTS 1000')).rejects.toThrow('QBO query failed: 401')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/lib/qbo/client.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/qbo/client'`

- [ ] **Step 3: Create src/lib/qbo/client.ts**

```typescript
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './auth'
import type { QboConnection } from '@prisma/client'

const QBO_API_BASE =
  process.env.QBO_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    : 'https://quickbooks.api.intuit.com/v3/company'

export async function getValidConnection(): Promise<QboConnection> {
  const conn = await prisma.qboConnection.findFirst()
  if (!conn) throw new Error('No QBO connection found')

  // Refresh if expiring within 5 minutes
  if (conn.tokenExpiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
    const tokens = await refreshAccessToken(conn.refreshToken)
    return prisma.qboConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })
  }
  return conn
}

export async function qboQuery<T>(
  realmId: string,
  accessToken: string,
  sql: string
): Promise<T[]> {
  const url = `${QBO_API_BASE}/${realmId}/query?query=${encodeURIComponent(sql)}&minorversion=70`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`QBO query failed: ${res.status}`)
  const data = await res.json()
  const entityName = sql.match(/FROM\s+(\w+)/i)?.[1] ?? ''
  return (data.QueryResponse?.[entityName] ?? []) as T[]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/lib/qbo/client.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/qbo/client.ts src/__tests__/lib/qbo/client.test.ts
git commit -m "feat: QBO API client with token refresh and query helper"
```

---

## Task 5: Sync logic

**Files:**
- Create: `src/lib/qbo/sync.ts`
- Create: `src/__tests__/lib/qbo/sync.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/qbo/sync.test.ts`:

```typescript
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
    fundingSource: { findMany: jest.fn(), update: jest.fn() },
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
      { id: 'li-1', qboAccountId: 'acc-1', projectId: 'proj-1' },
    ])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([
      { id: 'fs-1', qboClassId: 'class-1', projectId: 'proj-1' },
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

  it('sets fundingSourceId to null when class belongs to a different project', async () => {
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
      { id: 'li-1', qboAccountId: 'acc-1', projectId: 'proj-1' },
    ])
    ;(mockPrisma.fundingSource.findMany as jest.Mock).mockResolvedValue([
      { id: 'fs-1', qboClassId: 'class-1', projectId: 'proj-DIFFERENT' },
    ])
    ;(mockPrisma.actual.upsert as jest.Mock).mockResolvedValue({})

    await syncAll()

    const upsertCall = (mockPrisma.actual.upsert as jest.Mock).mock.calls[0][0]
    expect(upsertCall.create.fundingSourceId).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/lib/qbo/sync.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/qbo/sync'`

- [ ] **Step 3: Create src/lib/qbo/sync.ts**

```typescript
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
  await syncClassNames(classes)
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

async function syncClassNames(classes: QboClass[]): Promise<void> {
  const classMap = new Map(classes.map((c) => [c.Id, c]))
  const fundingSources = await prisma.fundingSource.findMany()

  for (const source of fundingSources) {
    const qboClass = classMap.get(source.qboClassId)
    if (qboClass && qboClass.Name !== source.qboClassName) {
      await prisma.fundingSource.update({
        where: { id: source.id },
        data: { qboClassName: qboClass.Name },
      })
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
    select: { id: true, qboAccountId: true, projectId: true },
  })
  const fundingSources = await prisma.fundingSource.findMany({
    select: { id: true, qboClassId: true, projectId: true },
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
      const matchedFsId =
        fundingSource?.projectId === lineItem.projectId ? fundingSource.id : null

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/lib/qbo/sync.test.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/qbo/sync.ts src/__tests__/lib/qbo/sync.test.ts
git commit -m "feat: QBO sync logic — line items, class names, transactions"
```

---

## Task 6: Sync route + project and status endpoints

**Files:**
- Create: `src/app/api/qbo/sync/route.ts`
- Create: `src/app/api/qbo/status/route.ts`
- Create: `src/app/api/qbo/accounts/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`

- [ ] **Step 1: Create sync route**

Create `src/app/api/qbo/sync/route.ts`:

```typescript
import { syncAll } from '@/lib/qbo/sync'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const result = await syncAll()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create status route**

Create `src/app/api/qbo/status/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const conn = await prisma.qboConnection.findFirst({
    select: { realmId: true, companyName: true, lastSyncedAt: true },
  })
  return NextResponse.json({ connected: !!conn, connection: conn ?? null })
}
```

- [ ] **Step 3: Create accounts route**

This fetches top-level expense accounts from QBO (used by the settings UI account-claim table).

Create `src/app/api/qbo/accounts/route.ts`:

```typescript
import { getValidConnection, qboQuery } from '@/lib/qbo/client'
import { prisma } from '@/lib/prisma'
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
  try {
    const conn = await getValidConnection()
    const accounts = await qboQuery<QboAccount>(
      conn.realmId,
      conn.accessToken,
      'SELECT * FROM Account MAXRESULTS 1000'
    )
    // Return only top-level expense accounts
    const topLevel = accounts.filter(
      (a) => !a.ParentRef && a.Active && a.AccountType === 'Expense'
    )
    // Annotate with current project claim
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
```

- [ ] **Step 4: Create project PATCH endpoint**

Create `src/app/api/projects/[id]/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/projects/[id]'>
) {
  const { id } = await ctx.params
  const body = await request.json() as { qboAccountId?: string | null }

  // If claiming a new account, clear any other project that had it
  if (body.qboAccountId) {
    await prisma.project.updateMany({
      where: { qboAccountId: body.qboAccountId, NOT: { id } },
      data: { qboAccountId: null },
    })
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { qboAccountId: body.qboAccountId ?? null },
    select: { id: true, name: true, qboAccountId: true },
  })
  return NextResponse.json(updated)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/qbo/sync/route.ts src/app/api/qbo/status/route.ts src/app/api/qbo/accounts/route.ts src/app/api/projects/
git commit -m "feat: QBO sync, status, accounts API routes + project PATCH endpoint"
```

---

## Task 7: Settings page UI

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Replace settings page with QBO settings UI**

Replace the entire contents of `src/app/settings/page.tsx`:

```tsx
'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useEffect, useState, useCallback } from 'react'

interface QboStatus {
  connected: boolean
  connection: { realmId: string; companyName: string; lastSyncedAt: string | null } | null
}

interface QboAccount {
  id: string
  name: string
  claimedByProject: { id: string; name: string; qboAccountId: string } | null
}

interface Project {
  id: string
  name: string
  projectType: string
  qboAccountId: string | null
}

export default function SettingsPage() {
  const [status, setStatus] = useState<QboStatus | null>(null)
  const [accounts, setAccounts] = useState<QboAccount[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [claimingAccount, setClaimingAccount] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/qbo/status')
    const data = await res.json()
    setStatus(data)
  }, [])

  const loadAccountsAndProjects = useCallback(async () => {
    const [accountsRes, projectsRes] = await Promise.all([
      fetch('/api/qbo/accounts'),
      fetch('/api/projects'),
    ])
    if (accountsRes.ok) {
      const data = await accountsRes.json()
      setAccounts(data.accounts ?? [])
    }
    if (projectsRes.ok) {
      const data = await projectsRes.json()
      setProjects(data.projects ?? [])
    }
  }, [])

  useEffect(() => {
    loadStatus()
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      setSyncResult('Connected to QuickBooks successfully.')
      window.history.replaceState({}, '', '/settings')
    }
    if (params.get('error') === 'qbo_auth') {
      setSyncResult('QuickBooks connection failed. Please try again.')
      window.history.replaceState({}, '', '/settings')
    }
  }, [loadStatus])

  useEffect(() => {
    if (status?.connected) {
      loadAccountsAndProjects()
    }
  }, [status?.connected, loadAccountsAndProjects])

  async function handleDisconnect() {
    if (!confirm('Disconnect from QuickBooks? Existing synced data will be kept.')) return
    setDisconnecting(true)
    await fetch('/api/qbo/disconnect', { method: 'POST' })
    await loadStatus()
    setAccounts([])
    setProjects([])
    setDisconnecting(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/qbo/sync', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSyncResult(`Sync complete — ${data.lineItemsUpserted} line items, ${data.actualsUpserted} actuals updated.`)
      await loadStatus()
      await loadAccountsAndProjects()
    } else {
      setSyncResult(`Sync failed: ${data.error}`)
    }
    setSyncing(false)
  }

  async function handleClaimChange(accountId: string, projectId: string) {
    setClaimingAccount(accountId)
    if (projectId === '') {
      // unclaim: find the project that currently claims this account and clear it
      const currentProject = projects.find((p) => p.qboAccountId === accountId)
      if (currentProject) {
        await fetch(`/api/projects/${currentProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qboAccountId: null }),
        })
      }
    } else {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qboAccountId: accountId }),
      })
    }
    await loadAccountsAndProjects()
    setClaimingAccount(null)
  }

  const claimedProjects = projects.filter((p) => p.projectType === 'claimed')

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

      <div className="max-w-2xl space-y-8">
        {/* Connection Section */}
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">QuickBooks Online</h2>

          {status === null ? (
            <p className="text-slate-500 text-base">Loading…</p>
          ) : status.connected && status.connection ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <span className="text-base font-medium text-slate-900">
                  {status.connection.companyName}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-base font-medium rounded-md transition-colors"
                >
                  {syncing ? 'Syncing…' : '↻ Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-base font-medium rounded-md transition-colors"
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>

              {status.connection.lastSyncedAt && (
                <p className="text-sm text-slate-500">
                  Last synced:{' '}
                  {new Date(status.connection.lastSyncedAt).toLocaleString()}
                </p>
              )}
              {!status.connection.lastSyncedAt && (
                <p className="text-sm text-slate-500">Never synced — click Sync Now to import data.</p>
              )}

              {syncResult && (
                <p className={`text-base p-3 rounded-md ${syncResult.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {syncResult}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-base text-slate-600">
                Connect your QuickBooks Online account to sync your chart of accounts and transactions.
              </p>
              <a
                href="/api/qbo/connect"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-md transition-colors"
              >
                Connect to QuickBooks
              </a>
              {syncResult && (
                <p className="text-base p-3 rounded-md bg-red-50 text-red-700">{syncResult}</p>
              )}
            </div>
          )}
        </section>

        {/* Account Claims Section */}
        {status?.connected && accounts.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Project Account Claims</h2>
            <p className="text-base text-slate-600 mb-4">
              Assign each top-level QBO account to a project. Unassigned accounts go into the catch-all project.
            </p>

            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left font-medium text-slate-600 pb-2">QBO Account</th>
                  <th className="text-left font-medium text-slate-600 pb-2">Claimed By</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const currentProjectId =
                    projects.find((p) => p.qboAccountId === account.id)?.id ?? ''
                  return (
                    <tr key={account.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4 text-slate-900">{account.name}</td>
                      <td className="py-3">
                        <select
                          value={currentProjectId}
                          onChange={(e) => handleClaimChange(account.id, e.target.value)}
                          disabled={claimingAccount === account.id}
                          className="text-base border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 disabled:opacity-50"
                        >
                          <option value="">— None (catch-all) —</option>
                          {claimedProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Add GET /api/projects route (needed by the settings page)**

Create `src/app/api/projects/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, projectType: true, qboAccountId: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ projects })
}
```

- [ ] **Step 3: Start the dev server and test manually**

```bash
npm run dev
```

Open http://localhost:3000/settings

**Manual test checklist:**
1. Page shows "Connect to QuickBooks" button (no connection yet)
2. Click "Connect to QuickBooks" → redirected to Intuit login page
3. Authorize the app → redirected back to /settings with success message
4. Page shows company name, green dot, "Sync Now" button, "Disconnect" button
5. Click "Sync Now" → shows "Syncing…" during sync → shows result message with counts
6. Account claims table appears with QBO top-level expense accounts
7. Select a project in any dropdown → page updates without full reload
8. Click "Disconnect" → confirm dialog → page reverts to "Connect" state

> **Note for Mislav:** You need QBO sandbox credentials from https://developer.intuit.com to test this. In Intuit Developer Portal: create an app, set the redirect URI to `http://localhost:3000/api/qbo/callback`, copy Client ID and Client Secret to `.env.local`, set `QBO_ENVIRONMENT=sandbox`.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/app/api/projects/route.ts
git commit -m "feat: QBO settings page — connect/disconnect, sync now, account claims"
```

---

## Full test suite

- [ ] **Run all tests before final commit**

```bash
npx jest --no-coverage
```

Expected: all tests pass. If any fail, fix before continuing.

- [ ] **Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix: address test failures from QBO integration"
```

---

## Self-review against spec

**Spec coverage check:**
- ✅ QBO OAuth 2.0 connect flow — Tasks 2 + 3
- ✅ Sync chart of accounts → line items — Task 5 (`syncLineItems`)
- ✅ Sync classes → funding source name updates — Task 5 (`syncClassNames`)
- ✅ Transaction sync → actuals (bills + expenses) — Task 5 (`syncTransactions`)
- ✅ Settings page: connect/disconnect — Task 7
- ✅ Settings page: sync now + last synced timestamp — Task 7
- ✅ Project account claims UI — Task 7
- ✅ Deduplication via `qboTransactionId` — Task 5 (`upsert` with composite unique key)
- ✅ Token refresh — Task 4 (`getValidConnection`)
- ✅ Sync failure handling — Task 6 (sync route returns error, data not wiped)
- ✅ Class/account renamed → display name updated on next sync — Task 5

**Not in scope for Plan 2 (in spec but deferred):**
- Deleted QBO account → flag "no longer active" warning — needs UI work, deferred to Plan 3
- Transaction with unrecognized class → flagged for admin review — stored with `fundingSourceId: null`, UI treatment in Plan 3
- Journal entries — spec mentions them but Purchase + Bill covers the main cases; can be added later

**Prisma note:** The `Actual.fundingSourceId` field is nullable (`String?`) in the schema, but the `update` call in `syncTransactions` sets it to `matchedFsId` which can be `null`. Prisma accepts `null` for optional relation fields, so this is correct.
