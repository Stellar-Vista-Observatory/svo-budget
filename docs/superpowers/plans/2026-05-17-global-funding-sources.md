# Global Funding Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make funding sources global (not tied to a project), fix the sync transaction-matching bug, and rederive per-project funding data from allocations.

**Architecture:** Remove `projectId` from `FundingSource`. QBO sync upserts one `FundingSource` per active QBO class. Transaction matching drops the project-equality guard. Per-project "secured funding" and funding source summaries are now computed by summing `FundingAllocation.allocatedAmount` records, not `FundingSource.allocatedTotal`. `allocatedTotal` on `FundingSource` remains as the global grant total (edited manually).

**Tech Stack:** Next.js 16.2.6 App Router, Prisma 7, TypeScript, Supabase Postgres, Jest 30

---

## File Map

```
prisma/
└── schema.prisma                            # Remove projectId + index from FundingSource; add @@unique on qboClassId; remove relation from Project

src/
├── lib/
│   ├── qbo/
│   │   └── sync.ts                         # syncClassNames → syncFundingSources (upsert); remove projectId check in syncTransactions
│   └── dashboard.ts                         # Rederive funding sources from allocations; update types
├── app/
│   └── api/
│       ├── dashboard/route.ts               # Remove fundingSources include; add allocations include to lineItems
│       ├── projects/
│       │   └── [id]/route.ts               # Same: derive funding sources from allocations
│       └── projects/
│           └── [id]/funding-sources/route.ts # Remove projectId from create data; use global count for color
└── __tests__/
    └── api/
        └── dashboard.test.ts                # Update test to match new buildDashboardData signature
```

---

## Task 1: Schema — make FundingSource global

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update schema**

Replace the `FundingSource` model and remove `fundingSources` from `Project`:

In `prisma/schema.prisma`, change the `Project` model — remove the `fundingSources FundingSource[]` line:

```prisma
model Project {
  id               String        @id @default(uuid())
  name             String
  description      String?
  projectType      ProjectType
  qboAccountId     String?
  qboAccountName   String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  lineItems        LineItem[]

  @@map("projects")
}
```

Replace the `FundingSource` model (remove `projectId`, `project` relation, `@@index([projectId])`; add `@@unique([qboClassId])`):

```prisma
model FundingSource {
  id             String       @id @default(uuid())
  name           String
  color          String
  allocatedTotal Decimal      @db.Decimal(12, 2)
  qboClassId     String       @unique
  qboClassName   String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  allocations    FundingAllocation[]
  actuals        Actual[]

  @@map("funding_sources")
}
```

- [ ] **Step 2: Push schema to database**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

Note: This drops the `projectId` column from the `funding_sources` table. Existing funding source records are preserved but lose their project association — that's intentional.

- [ ] **Step 3: Reset lastSyncedAt so next sync re-fetches all transactions**

Create a one-off script `scripts/reset-sync.ts`:

```typescript
import { prisma } from '../src/lib/prisma'

async function main() {
  const result = await prisma.qboConnection.updateMany({ data: { lastSyncedAt: null } })
  console.log(`Reset lastSyncedAt on ${result.count} connection(s)`)
  await prisma.$disconnect()
}

main().catch(console.error)
```

Run it:

```bash
npx tsx scripts/reset-sync.ts
```

Expected: `Reset lastSyncedAt on 1 connection(s)`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma scripts/reset-sync.ts
git commit -m "feat: make FundingSource global — remove projectId from schema"
```

---

## Task 2: Sync — upsert funding sources from classes; fix transaction matching

**Files:**
- Modify: `src/lib/qbo/sync.ts`

- [ ] **Step 1: Replace syncClassNames with syncFundingSources**

In `src/lib/qbo/sync.ts`, replace the `syncClassNames` function (lines 147–160) with `syncFundingSources` that creates new funding sources when a QBO class has no matching record:

```typescript
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
```

- [ ] **Step 2: Update syncAll to call syncFundingSources**

In `syncAll` (line 67), change:

```typescript
await syncClassNames(classes)
```

to:

```typescript
await syncFundingSources(classes)
```

- [ ] **Step 3: Remove projectId from syncTransactions**

In `syncTransactions`, change the funding source select (line 187):

```typescript
// Before:
const fundingSources = await prisma.fundingSource.findMany({
  select: { id: true, qboClassId: true, projectId: true },
})

// After:
const fundingSources = await prisma.fundingSource.findMany({
  select: { id: true, qboClassId: true },
})
```

And change the match logic (lines 211–213):

```typescript
// Before:
const matchedFsId =
  fundingSource?.projectId === lineItem.projectId ? fundingSource.id : null

// After:
const matchedFsId = fundingSource ? fundingSource.id : null
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/" | head -20
```

Expected: no errors in `src/lib/qbo/sync.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/qbo/sync.ts
git commit -m "feat: sync upserts funding sources from QBO classes; remove project match guard"
```

---

## Task 3: Dashboard lib — rederive funding sources from allocations

**Files:**
- Modify: `src/lib/dashboard.ts`
- Modify: `src/__tests__/api/dashboard.test.ts`

- [ ] **Step 1: Write updated failing test**

Replace entire `src/__tests__/api/dashboard.test.ts`:

```typescript
import { buildDashboardData } from '@/lib/dashboard'

const dec = (n: number) => ({ toNumber: () => n } as unknown as import('@prisma/client').Prisma.Decimal)

describe('buildDashboardData', () => {
  it('computes secured from allocations, not fundingSource.allocatedTotal', () => {
    const projects = [
      {
        id: 'p1',
        name: 'Observatory',
        projectType: 'claimed',
        lineItems: [
          {
            id: 'li1',
            estimatedAmount: dec(800),
            actuals: [{ amount: dec(200), fundingSourceId: 'fs1' }],
            allocations: [
              {
                allocatedAmount: dec(500),
                fundingSource: { id: 'fs1', name: 'SVO Funds', color: '#3b82f6' },
              },
            ],
          },
        ],
      },
    ]

    const result = buildDashboardData(projects as Parameters<typeof buildDashboardData>[0])

    expect(result.summary.estimatedCosts).toBe(800)
    expect(result.summary.securedFunding).toBe(500)   // sum of allocations, not allocatedTotal
    expect(result.summary.spentToDate).toBe(200)
    expect(result.summary.remaining).toBe(300)         // 500 - 200
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].spent).toBe(200)
    expect(result.projects[0].secured).toBe(500)
    expect(result.projects[0].fundingGap).toBe(300)   // 800 estimated - 500 secured
    expect(result.projects[0].fundingSources).toHaveLength(1)
    expect(result.projects[0].fundingSources[0].allocatedTotal).toBe(500)
  })

  it('deduplicates funding sources that appear on multiple line items', () => {
    const projects = [
      {
        id: 'p1',
        name: 'Observatory',
        projectType: 'claimed',
        lineItems: [
          {
            id: 'li1',
            estimatedAmount: dec(400),
            actuals: [],
            allocations: [
              {
                allocatedAmount: dec(200),
                fundingSource: { id: 'fs1', name: 'Grant A', color: '#3b82f6' },
              },
            ],
          },
          {
            id: 'li2',
            estimatedAmount: dec(600),
            actuals: [],
            allocations: [
              {
                allocatedAmount: dec(300),
                fundingSource: { id: 'fs1', name: 'Grant A', color: '#3b82f6' },
              },
            ],
          },
        ],
      },
    ]

    const result = buildDashboardData(projects as Parameters<typeof buildDashboardData>[0])
    expect(result.projects[0].fundingSources).toHaveLength(1)
    expect(result.projects[0].fundingSources[0].allocatedTotal).toBe(500) // 200 + 300
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/api/dashboard.test.ts --no-coverage
```

Expected: FAIL — types won't match.

- [ ] **Step 3: Replace src/lib/dashboard.ts**

```typescript
import type { Prisma, ProjectType } from '@prisma/client'
import { projectSpent, projectFundingGap, fundingSourceSpent } from './computed'

type Actual = { amount: Prisma.Decimal; fundingSourceId: string | null }
type Allocation = {
  allocatedAmount: Prisma.Decimal
  fundingSource: { id: string; name: string; color: string }
}
type LineItem = {
  id: string
  estimatedAmount: Prisma.Decimal
  actuals: Actual[]
  allocations: Allocation[]
}
type Project = {
  id: string
  name: string
  projectType: ProjectType
  lineItems: LineItem[]
}

export function buildDashboardData(projects: Project[]) {
  let totalEstimated = 0
  let totalSecured = 0
  let totalSpent = 0

  const projectCards = projects.map((p) => {
    const allActuals = p.lineItems.flatMap((li) => li.actuals)
    const spent = projectSpent(allActuals)
    const estimated = p.lineItems.reduce((s, li) => s + li.estimatedAmount.toNumber(), 0)

    // Secured = sum of allocations on this project's line items
    const secured = p.lineItems
      .flatMap((li) => li.allocations)
      .reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)

    const fundingGap = projectFundingGap(estimated, secured)

    totalEstimated += estimated
    totalSecured += secured
    totalSpent += spent

    // Deduplicate funding sources; sum per-project allocated amounts
    const fsMap = new Map<string, { id: string; name: string; color: string; allocated: number }>()
    for (const li of p.lineItems) {
      for (const alloc of li.allocations) {
        const fs = alloc.fundingSource
        const entry = fsMap.get(fs.id)
        if (entry) {
          entry.allocated += alloc.allocatedAmount.toNumber()
        } else {
          fsMap.set(fs.id, { id: fs.id, name: fs.name, color: fs.color, allocated: alloc.allocatedAmount.toNumber() })
        }
      }
    }

    const fundingSourceSummaries = Array.from(fsMap.values()).map((fs) => ({
      id: fs.id,
      name: fs.name,
      color: fs.color,
      allocatedTotal: fs.allocated,
      spent: fundingSourceSpent(fs.id, allActuals),
    }))

    return {
      id: p.id,
      name: p.name,
      estimated,
      secured,
      spent,
      fundingGap,
      lineItemCount: p.lineItems.length,
      fundingSources: fundingSourceSummaries,
    }
  })

  return {
    summary: {
      estimatedCosts: totalEstimated,
      securedFunding: totalSecured,
      spentToDate: totalSpent,
      remaining: totalSecured - totalSpent,
    },
    projects: projectCards,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/api/dashboard.test.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard.ts src/__tests__/api/dashboard.test.ts
git commit -m "feat: derive dashboard funding sources from allocations, not project relation"
```

---

## Task 4: Dashboard API route — update Prisma query

**Files:**
- Modify: `src/app/api/dashboard/route.ts`

- [ ] **Step 1: Update the query**

Replace entire `src/app/api/dashboard/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { buildDashboardData } from '@/lib/dashboard'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const projects = await prisma.project.findMany({
    include: {
      lineItems: {
        where: { isActive: true },
        include: {
          actuals: { select: { amount: true, fundingSourceId: true } },
          allocations: {
            include: {
              fundingSource: { select: { id: true, name: true, color: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(buildDashboardData(projects))
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "feat: dashboard route derives funding sources from allocations"
```

---

## Task 5: Project detail API route — derive funding sources from allocations

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts`

The current GET handler fetches `project.fundingSources` directly. After the schema change there is no such relation. We need to derive funding sources from `lineItems.allocations`.

- [ ] **Step 1: Replace the GET handler**

Replace entire `src/app/api/projects/[id]/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { lineItemSpent, lineItemRemaining, fundingSourceSpent, fundingSourceRemaining, projectSpent, projectFundingGap } from '@/lib/computed'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      lineItems: {
        where: { isActive: true },
        include: {
          actuals: { select: { amount: true, fundingSourceId: true } },
          allocations: {
            include: {
              fundingSource: { select: { id: true, name: true, color: true, allocatedTotal: true, qboClassId: true, qboClassName: true } },
            },
          },
        },
        orderBy: { displayPath: 'asc' },
      },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allActuals = project.lineItems.flatMap((li) => li.actuals)
  const totalSpent = projectSpent(allActuals)
  const totalEstimated = project.lineItems.reduce((s, li) => s + li.estimatedAmount.toNumber(), 0)

  // Secured = sum of allocations for this project's line items
  const totalSecured = project.lineItems
    .flatMap((li) => li.allocations)
    .reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)

  // Deduplicate funding sources; compute per-project allocated + spent
  const fsMap = new Map<string, {
    id: string; name: string; color: string
    allocatedTotal: number  // global grant total
    allocatedToProject: number  // sum of allocations on this project's line items
    qboClassId: string; qboClassName: string
  }>()
  for (const li of project.lineItems) {
    for (const alloc of li.allocations) {
      const fs = alloc.fundingSource
      const entry = fsMap.get(fs.id)
      if (entry) {
        entry.allocatedToProject += alloc.allocatedAmount.toNumber()
      } else {
        fsMap.set(fs.id, {
          id: fs.id,
          name: fs.name,
          color: fs.color,
          allocatedTotal: fs.allocatedTotal.toNumber(),
          allocatedToProject: alloc.allocatedAmount.toNumber(),
          qboClassId: fs.qboClassId,
          qboClassName: fs.qboClassName,
        })
      }
    }
  }

  const fundingSources = Array.from(fsMap.values()).map((fs) => {
    const spent = fundingSourceSpent(fs.id, allActuals)
    return {
      id: fs.id,
      name: fs.name,
      color: fs.color,
      allocatedTotal: fs.allocatedToProject,  // project-specific total for display
      qboClassId: fs.qboClassId,
      qboClassName: fs.qboClassName,
      spent,
      remaining: fs.allocatedToProject - spent,
    }
  })

  const lineItems = project.lineItems.map((li) => {
    const spent = lineItemSpent(li.actuals)
    const totalAllocated = li.allocations.reduce((s, a) => s + a.allocatedAmount.toNumber(), 0)
    const allocationPct = li.estimatedAmount.toNumber() > 0
      ? (totalAllocated / li.estimatedAmount.toNumber()) * 100
      : 0

    return {
      id: li.id,
      name: li.name,
      displayPath: li.displayPath,
      category: li.category,
      estimatedAmount: li.estimatedAmount.toNumber(),
      qboAccountId: li.qboAccountId,
      isActive: li.isActive,
      spent,
      remaining: lineItemRemaining(li.estimatedAmount, spent),
      allocationPct: Math.round(allocationPct),
      allocations: li.allocations.map((a) => ({
        id: a.id,
        fundingSourceId: a.fundingSource.id,
        fundingSourceName: a.fundingSource.name,
        fundingSourceColor: a.fundingSource.color,
        allocatedAmount: a.allocatedAmount.toNumber(),
      })),
    }
  })

  return NextResponse.json({
    id: project.id,
    name: project.name,
    description: project.description,
    projectType: project.projectType,
    totalEstimated,
    totalSecured,
    totalSpent,
    fundingGap: projectFundingGap(totalEstimated, totalSecured),
    fundingSources,
    lineItems,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as { qboAccountId?: string | null }

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

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/projects/[id]/route.ts"
git commit -m "feat: project detail route derives funding sources from allocations"
```

---

## Task 6: Funding source POST route — remove projectId

**Files:**
- Modify: `src/app/api/projects/[id]/funding-sources/route.ts`

- [ ] **Step 1: Remove projectId from create data**

Replace entire `src/app/api/projects/[id]/funding-sources/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const COLOR_PALETTE = ['#3b82f6','#16a34a','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

export async function POST(
  request: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json() as {
      name: string
      qboClassId: string
      qboClassName: string
      allocatedTotal: number
      color?: string
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (typeof body.allocatedTotal !== 'number' || !isFinite(body.allocatedTotal) || body.allocatedTotal < 0) {
      return NextResponse.json({ error: 'allocatedTotal must be a non-negative number' }, { status: 400 })
    }

    const existing = await prisma.fundingSource.count()
    const color = body.color ?? COLOR_PALETTE[existing % COLOR_PALETTE.length]

    const source = await prisma.fundingSource.create({
      data: {
        name: body.name,
        color,
        allocatedTotal: body.allocatedTotal,
        qboClassId: body.qboClassId,
        qboClassName: body.qboClassName,
      },
    })
    return NextResponse.json(source, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 2: Run full test suite and TypeScript check**

```bash
npx jest --no-coverage 2>&1 | tail -10
npx tsc --noEmit 2>&1 | grep -v ".next/" | head -20
```

Expected: all tests pass, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/projects/[id]/funding-sources/route.ts"
git commit -m "feat: funding source create no longer requires projectId"
```

---

## Self-Review

**Spec coverage:**
- ✅ `FundingSource.projectId` removed — Task 1
- ✅ Sync creates funding sources from QBO classes — Task 2
- ✅ Sync transaction matching drops project equality guard — Task 2
- ✅ `lastSyncedAt` reset so next sync re-fetches all transactions — Task 1
- ✅ Dashboard secured funding derived from allocations — Tasks 3 + 4
- ✅ Project detail funding sources derived from allocations — Task 5
- ✅ Funding source POST no longer sets projectId — Task 6
- ✅ Tests updated — Task 3

**What the user must do after deploying:**
Run a QBO sync from Settings. The sync will now:
1. Create/upsert funding sources from QBO classes (including "Kane County Economic Opportunity Board")
2. Re-match all transactions to funding sources without the project equality guard
3. The Garkane transaction on "Observatory Construction:Utilities" will be linked to the Kane County funding source correctly
