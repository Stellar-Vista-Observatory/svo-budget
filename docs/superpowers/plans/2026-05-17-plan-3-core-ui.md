# Plan 3: Core UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dashboard, project detail page, allocation management, user roles, and responsive design so the app is fully usable end-to-end.

**Architecture:** New API routes under `src/app/api/` return all computed values server-side (no client-side math). UI components are pure presentational components in `src/components/`. Pages are thin wrappers that fetch data and pass it down. Role enforcement happens in a shared `requireAuth` helper used by all API routes and server components.

**Tech Stack:** Next.js 16.2.6 App Router, Prisma 7, TypeScript, Tailwind v4, Jest 30 (node environment), Supabase Auth

---

## File Map

```
src/
├── app/
│   ├── api/
│   │   ├── dashboard/route.ts              # GET: aggregate summary + project cards data
│   │   ├── projects/
│   │   │   ├── route.ts                    # existing GET — extend with lineItemCount, fundingSourceCount
│   │   │   └── [id]/
│   │   │       ├── route.ts                # existing PATCH + new GET: full project detail
│   │   │       └── funding-sources/
│   │   │           └── route.ts            # POST: create funding source for project
│   │   ├── funding-sources/
│   │   │   └── [id]/route.ts              # PATCH: update name/color/allocatedTotal; DELETE
│   │   ├── line-items/
│   │   │   ├── route.ts                   # POST: create manual line item
│   │   │   └── [id]/
│   │   │       ├── route.ts               # PATCH: name, category, estimatedAmount
│   │   │       └── allocations/
│   │   │           └── route.ts           # POST: add allocation; GET: list for line item
│   │   ├── funding-allocations/
│   │   │   └── [id]/route.ts             # PATCH: allocatedAmount; DELETE
│   │   └── users/
│   │       ├── route.ts                   # GET: list users+roles (admin only); POST: set role
│   │       └── [id]/route.ts             # PATCH: update role (admin only)
│   ├── dashboard/page.tsx                 # replace stub
│   ├── projects/[id]/page.tsx             # replace stub
│   ├── admin/
│   │   └── users/page.tsx                # admin-only user management page
│   └── settings/page.tsx                 # fix cosmetic disconnect bug
├── components/
│   ├── SegmentedBar.tsx                   # blue/green/amber progress bar — reused everywhere
│   ├── FundingChip.tsx                    # colored dot + label + amount
│   ├── dashboard/
│   │   ├── SummaryStrip.tsx               # 4-stat row at top of dashboard
│   │   └── ProjectCard.tsx                # one card per project
│   └── project/
│       ├── FundingSourceCard.tsx          # funding source card with mini bar
│       ├── LineItemsTable.tsx             # table with expandable rows
│       └── AllocationRow.tsx              # expanded allocation editing row
├── lib/
│   ├── auth.ts                            # requireAdmin(), requireAuth() helpers
│   └── computed.ts                        # pure functions for computed financial values
└── __tests__/
    ├── lib/
    │   └── computed.test.ts
    └── api/
        ├── dashboard.test.ts
        ├── line-items.test.ts
        └── funding-allocations.test.ts
prisma/
└── schema.prisma                          # Add UserRole model
```

---

## Task 1: Bug fix — disconnect sync result cosmetic issue

**Files:**
- Modify: `src/app/settings/page.tsx`

The bug: after disconnecting QBO, `syncResult` state still holds the old message (styled red if it previously showed an error). Fix: clear `syncResult` when disconnect completes.

- [ ] **Step 1: Fix handleDisconnect to clear syncResult**

In `src/app/settings/page.tsx`, find `handleDisconnect` (around line 1257) and add `setSyncResult(null)` after `setAccounts([])`:

```typescript
async function handleDisconnect() {
  if (!confirm('Disconnect from QuickBooks? Existing synced data will be kept.')) return
  setDisconnecting(true)
  await fetch('/api/qbo/disconnect', { method: 'POST' })
  await loadStatus()
  setAccounts([])
  setProjects([])
  setSyncResult(null)
  setDisconnecting(false)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "fix: clear sync result message on QBO disconnect"
```

---

## Task 2: Schema — UserRole table

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add UserRole model**

Append to `prisma/schema.prisma`:

```prisma
enum Role {
  admin
  viewer
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String   @unique
  role      Role     @default(viewer)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("user_roles")
}
```

- [ ] **Step 2: Push schema**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add UserRole table to schema"
```

---

## Task 3: Auth helpers + computed value utilities

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/computed.ts`
- Create: `src/__tests__/lib/computed.test.ts`

- [ ] **Step 1: Write failing tests for computed helpers**

Create `src/__tests__/lib/computed.test.ts`:

```typescript
import {
  lineItemSpent,
  lineItemRemaining,
  projectSpent,
  projectFundingGap,
  fundingSourceSpent,
  fundingSourceRemaining,
} from '@/lib/computed'

const dec = (n: number) => ({ toNumber: () => n } as unknown as import('@prisma/client').Prisma.Decimal)

describe('lineItemSpent', () => {
  it('sums actuals amounts', () => {
    const actuals = [{ amount: dec(100) }, { amount: dec(50) }]
    expect(lineItemSpent(actuals)).toBe(150)
  })

  it('returns 0 with no actuals', () => {
    expect(lineItemSpent([])).toBe(0)
  })
})

describe('lineItemRemaining', () => {
  it('subtracts spent from estimated', () => {
    expect(lineItemRemaining(dec(500), 200)).toBe(300)
  })

  it('returns negative when overspent', () => {
    expect(lineItemRemaining(dec(100), 150)).toBe(-50)
  })
})

describe('fundingSourceSpent', () => {
  it('sums actuals for matching funding source', () => {
    const actuals = [
      { fundingSourceId: 'fs-1', amount: dec(200) },
      { fundingSourceId: 'fs-2', amount: dec(100) },
      { fundingSourceId: 'fs-1', amount: dec(75) },
    ]
    expect(fundingSourceSpent('fs-1', actuals)).toBe(275)
  })
})

describe('fundingSourceRemaining', () => {
  it('subtracts spent from allocated total', () => {
    expect(fundingSourceRemaining(dec(1000), 400)).toBe(600)
  })
})

describe('projectSpent', () => {
  it('sums all actuals for the project', () => {
    const actuals = [{ amount: dec(100) }, { amount: dec(200) }, { amount: dec(50) }]
    expect(projectSpent(actuals)).toBe(350)
  })
})

describe('projectFundingGap', () => {
  it('returns positive when funding short', () => {
    expect(projectFundingGap(1000, 600)).toBe(400)
  })

  it('returns negative (surplus) when over-funded', () => {
    expect(projectFundingGap(600, 1000)).toBe(-400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/lib/computed.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/computed'`

- [ ] **Step 3: Create src/lib/computed.ts**

```typescript
import type { Prisma } from '@prisma/client'

export function lineItemSpent(actuals: { amount: Prisma.Decimal }[]): number {
  return actuals.reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

export function lineItemRemaining(estimatedAmount: Prisma.Decimal, spent: number): number {
  return estimatedAmount.toNumber() - spent
}

export function fundingSourceSpent(
  fundingSourceId: string,
  actuals: { fundingSourceId: string | null; amount: Prisma.Decimal }[]
): number {
  return actuals
    .filter((a) => a.fundingSourceId === fundingSourceId)
    .reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

export function fundingSourceRemaining(allocatedTotal: Prisma.Decimal, spent: number): number {
  return allocatedTotal.toNumber() - spent
}

export function projectSpent(actuals: { amount: Prisma.Decimal }[]): number {
  return actuals.reduce((sum, a) => sum + a.amount.toNumber(), 0)
}

export function projectFundingGap(estimatedCosts: number, securedFunding: number): number {
  return estimatedCosts - securedFunding
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/lib/computed.test.ts --no-coverage
```

Expected: PASS (8 tests)

- [ ] **Step 5: Create src/lib/auth.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function getSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getRole(userId: string): Promise<'admin' | 'viewer'> {
  const userRole = await prisma.userRole.findUnique({ where: { userId } })
  return userRole?.role ?? 'viewer'
}

export async function requireAuth(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getSession>>>; role: 'admin' | 'viewer' } |
  { error: NextResponse }
> {
  const user = await getSession()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const role = await getRole(user.id)
  return { user, role }
}

export async function requireAdmin(): Promise<{ error: NextResponse } | null> {
  const result = await requireAuth()
  if ('error' in result) return result
  if (result.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return null
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/computed.ts src/__tests__/lib/computed.test.ts src/lib/auth.ts
git commit -m "feat: computed financial value helpers + auth role helpers"
```

---

## Task 4: Dashboard API route

**Files:**
- Create: `src/app/api/dashboard/route.ts`
- Create: `src/__tests__/api/dashboard.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/dashboard.test.ts`:

```typescript
import { buildDashboardData } from '@/lib/dashboard'

const dec = (n: number) => ({ toNumber: () => n } as unknown as import('@prisma/client').Prisma.Decimal)

describe('buildDashboardData', () => {
  it('computes summary totals across projects', () => {
    const projects = [
      {
        id: 'p1',
        name: 'Observatory',
        projectType: 'claimed',
        fundingSources: [{ id: 'fs1', allocatedTotal: dec(1000), color: '#3b82f6', name: 'SVO Funds', actuals: [] }],
        lineItems: [
          { id: 'li1', estimatedAmount: dec(800), actuals: [{ amount: dec(200), fundingSourceId: 'fs1' }] },
        ],
      },
    ]

    const result = buildDashboardData(projects as Parameters<typeof buildDashboardData>[0])

    expect(result.summary.estimatedCosts).toBe(800)
    expect(result.summary.securedFunding).toBe(1000)
    expect(result.summary.spentToDate).toBe(200)
    expect(result.summary.remaining).toBe(800)
    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].spent).toBe(200)
    expect(result.projects[0].fundingGap).toBe(-200) // surplus
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/api/dashboard.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/dashboard'`

- [ ] **Step 3: Create src/lib/dashboard.ts**

```typescript
import type { Prisma } from '@prisma/client'
import { projectSpent, projectFundingGap, fundingSourceSpent } from './computed'

type Actual = { amount: Prisma.Decimal; fundingSourceId: string | null }
type FundingSource = { id: string; name: string; color: string; allocatedTotal: Prisma.Decimal; actuals: Actual[] }
type LineItem = { id: string; estimatedAmount: Prisma.Decimal; actuals: Actual[] }
type Project = {
  id: string
  name: string
  projectType: string
  fundingSources: FundingSource[]
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
    const secured = p.fundingSources.reduce((s, fs) => s + fs.allocatedTotal.toNumber(), 0)
    const fundingGap = projectFundingGap(estimated, secured)

    totalEstimated += estimated
    totalSecured += secured
    totalSpent += spent

    const fundingSourceSummaries = p.fundingSources.map((fs) => ({
      id: fs.id,
      name: fs.name,
      color: fs.color,
      allocatedTotal: fs.allocatedTotal.toNumber(),
      spent: fundingSourceSpent(fs.id, allActuals),
    }))

    return {
      id: p.id,
      name: p.name,
      projectType: p.projectType,
      estimated,
      secured,
      spent,
      fundingGap,
      lineItemCount: p.lineItems.length,
      fundingSourceCount: p.fundingSources.length,
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

Expected: PASS (1 test)

- [ ] **Step 5: Create src/app/api/dashboard/route.ts**

```typescript
import { prisma } from '@/lib/prisma'
import { buildDashboardData } from '@/lib/dashboard'
import { NextResponse } from 'next/server'

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      fundingSources: {
        include: { actuals: { select: { amount: true, fundingSourceId: true } } },
      },
      lineItems: {
        where: { isActive: true },
        include: { actuals: { select: { amount: true, fundingSourceId: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(buildDashboardData(projects))
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard.ts src/__tests__/api/dashboard.test.ts src/app/api/dashboard/route.ts
git commit -m "feat: dashboard data builder + GET /api/dashboard"
```

---

## Task 5: SegmentedBar + FundingChip components

**Files:**
- Create: `src/components/SegmentedBar.tsx`
- Create: `src/components/FundingChip.tsx`

These are pure presentational components — no tests needed.

- [ ] **Step 1: Create SegmentedBar**

Create `src/components/SegmentedBar.tsx`:

```tsx
interface Segment {
  value: number   // dollar amount
  color: string   // tailwind bg class or hex
  label: string
}

interface SegmentedBarProps {
  segments: Segment[]
  total: number   // denominator for width calculation
  height?: string // tailwind height class, default 'h-3'
}

export function SegmentedBar({ segments, total, height = 'h-3' }: SegmentedBarProps) {
  if (total <= 0) {
    return <div className={`w-full ${height} bg-slate-100 rounded-full`} />
  }

  return (
    <div className={`w-full ${height} bg-slate-100 rounded-full overflow-hidden flex`}>
      {segments.map((seg, i) => {
        const pct = Math.min(100, Math.max(0, (seg.value / total) * 100))
        if (pct === 0) return null
        return (
          <div
            key={i}
            style={{ width: `${pct}%`, backgroundColor: seg.color }}
            title={`${seg.label}: $${seg.value.toLocaleString()}`}
            className="h-full transition-all"
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create FundingChip**

Create `src/components/FundingChip.tsx`:

```tsx
interface FundingChipProps {
  color: string   // hex color
  label: string
  amount?: number
}

export function FundingChip({ color, label, amount }: FundingChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
      {amount !== undefined && (
        <span className="text-slate-500">${amount.toLocaleString()}</span>
      )}
    </span>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SegmentedBar.tsx src/components/FundingChip.tsx
git commit -m "feat: SegmentedBar and FundingChip UI components"
```

---

## Task 6: Dashboard page UI

**Files:**
- Create: `src/components/dashboard/SummaryStrip.tsx`
- Create: `src/components/dashboard/ProjectCard.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create SummaryStrip**

Create `src/components/dashboard/SummaryStrip.tsx`:

```tsx
interface SummaryStripProps {
  estimatedCosts: number
  securedFunding: number
  spentToDate: number
  remaining: number
}

function StatBox({ label, value, valueColor }: { label: string; value: number; valueColor?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex-1 min-w-0">
      <p className="text-sm text-slate-500 font-medium mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${valueColor ?? 'text-slate-900'}`}>
        ${value.toLocaleString()}
      </p>
    </div>
  )
}

export function SummaryStrip({ estimatedCosts, securedFunding, spentToDate, remaining }: SummaryStripProps) {
  return (
    <div className="flex gap-4 flex-wrap sm:flex-nowrap">
      <StatBox label="Estimated Costs" value={estimatedCosts} />
      <StatBox label="Secured Funding" value={securedFunding} valueColor="text-green-700" />
      <StatBox label="Spent to Date" value={spentToDate} valueColor="text-blue-700" />
      <StatBox label="Remaining" value={remaining} valueColor={remaining >= 0 ? 'text-green-700' : 'text-red-600'} />
    </div>
  )
}
```

- [ ] **Step 2: Create ProjectCard**

Create `src/components/dashboard/ProjectCard.tsx`:

```tsx
import Link from 'next/link'
import { SegmentedBar } from '@/components/SegmentedBar'
import { FundingChip } from '@/components/FundingChip'

interface FundingSourceSummary {
  id: string
  name: string
  color: string
  allocatedTotal: number
  spent: number
}

interface ProjectCardProps {
  id: string
  name: string
  estimated: number
  secured: number
  spent: number
  fundingGap: number
  lineItemCount: number
  fundingSources: FundingSourceSummary[]
}

export function ProjectCard({
  id,
  name,
  estimated,
  secured,
  spent,
  fundingGap,
  lineItemCount,
  fundingSources,
}: ProjectCardProps) {
  const barTotal = Math.max(estimated, secured)
  const securedUnspent = Math.max(0, secured - spent)

  return (
    <Link
      href={`/projects/${id}`}
      className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {fundingSources.length} funding source{fundingSources.length !== 1 ? 's' : ''} · {lineItemCount} line item{lineItemCount !== 1 ? 's' : ''}
          </p>
        </div>
        {fundingGap > 0 ? (
          <span className="text-sm font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full shrink-0 ml-3">
            ${fundingGap.toLocaleString()} gap
          </span>
        ) : (
          <span className="text-sm font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full shrink-0 ml-3">
            ${Math.abs(fundingGap).toLocaleString()} surplus
          </span>
        )}
      </div>

      <SegmentedBar
        total={barTotal}
        segments={[
          { value: spent, color: '#3b82f6', label: 'Spent' },
          { value: securedUnspent, color: '#16a34a', label: 'Secured unspent' },
          { value: Math.max(0, fundingGap), color: '#f59e0b', label: 'Funding gap' },
        ]}
      />

      {fundingSources.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {fundingSources.map((fs) => (
            <FundingChip
              key={fs.id}
              color={fs.color}
              label={fs.name}
              amount={fs.allocatedTotal}
            />
          ))}
        </div>
      )}
    </Link>
  )
}
```

- [ ] **Step 3: Replace dashboard page**

Replace entire `src/app/dashboard/page.tsx`:

```tsx
'use client'

import { AppShell } from '@/components/layout/AppShell'
import { SummaryStrip } from '@/components/dashboard/SummaryStrip'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { useEffect, useState } from 'react'

interface FundingSourceSummary {
  id: string
  name: string
  color: string
  allocatedTotal: number
  spent: number
}

interface ProjectCardData {
  id: string
  name: string
  projectType: string
  estimated: number
  secured: number
  spent: number
  fundingGap: number
  lineItemCount: number
  fundingSourceCount: number
  fundingSources: FundingSourceSummary[]
}

interface DashboardData {
  summary: {
    estimatedCosts: number
    securedFunding: number
    spentToDate: number
    remaining: number
  }
  projects: ProjectCardData[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError('Failed to load dashboard data'))
  }, [])

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-4 text-base mb-6">{error}</div>
      )}

      {data === null && !error && (
        <div className="text-slate-500 text-base">Loading…</div>
      )}

      {data && (
        <div className="space-y-6">
          <SummaryStrip {...data.summary} />

          {data.projects.length === 0 ? (
            <p className="text-slate-500 text-base">No projects yet. Sync QBO data from Settings to get started.</p>
          ) : (
            <div className="space-y-4">
              {data.projects.map((project) => (
                <ProjectCard key={project.id} {...project} />
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
```

- [ ] **Step 4: Start dev server and verify dashboard loads**

```bash
npm run dev
```

Open http://localhost:3000/dashboard. Verify:
1. Summary strip shows 4 stat boxes
2. Each project appears as a card with segmented bar and funding chips
3. Clicking a card navigates to `/projects/[id]` (stub for now)
4. No console errors

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/ src/app/dashboard/page.tsx
git commit -m "feat: dashboard page with summary strip and project cards"
```

---

## Task 7: Project detail API route

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts`

- [ ] **Step 1: Add GET handler to project [id] route**

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
      fundingSources: {
        include: {
          actuals: { select: { amount: true, fundingSourceId: true } },
          allocations: { select: { allocatedAmount: true, lineItemId: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
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
        orderBy: { displayPath: 'asc' },
      },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allActuals = project.lineItems.flatMap((li) => li.actuals)
  const totalSpent = projectSpent(allActuals)
  const totalEstimated = project.lineItems.reduce((s, li) => s + li.estimatedAmount.toNumber(), 0)
  const totalSecured = project.fundingSources.reduce((s, fs) => s + fs.allocatedTotal.toNumber(), 0)

  const fundingSources = project.fundingSources.map((fs) => {
    const spent = fundingSourceSpent(fs.id, allActuals)
    return {
      id: fs.id,
      name: fs.name,
      color: fs.color,
      allocatedTotal: fs.allocatedTotal.toNumber(),
      qboClassId: fs.qboClassId,
      qboClassName: fs.qboClassName,
      spent,
      remaining: fundingSourceRemaining(fs.allocatedTotal, spent),
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

- [ ] **Step 2: Commit**

```bash
git add src/app/api/projects/[id]/route.ts
git commit -m "feat: GET /api/projects/[id] with full project detail and computed values"
```

---

## Task 8: Project detail page — layout + funding source cards

**Files:**
- Create: `src/components/project/FundingSourceCard.tsx`
- Modify: `src/app/projects/[id]/page.tsx`

- [ ] **Step 1: Create FundingSourceCard**

Create `src/components/project/FundingSourceCard.tsx`:

```tsx
import { SegmentedBar } from '@/components/SegmentedBar'

interface FundingSourceCardProps {
  name: string
  color: string
  allocatedTotal: number
  spent: number
  remaining: number
}

export function FundingSourceCard({ name, color, allocatedTotal, spent, remaining }: FundingSourceCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-slate-900">{name}</span>
        <span className="text-sm text-slate-500">${allocatedTotal.toLocaleString()} total</span>
      </div>

      <SegmentedBar
        height="h-2"
        total={allocatedTotal}
        segments={[
          { value: spent, color: '#3b82f6', label: 'Spent' },
          { value: Math.max(0, remaining), color: '#16a34a', label: 'Remaining' },
        ]}
      />

      <div className="flex gap-4 text-sm">
        <span className="text-blue-700 font-medium">${spent.toLocaleString()} spent</span>
        <span className={remaining >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
          ${Math.abs(remaining).toLocaleString()} {remaining >= 0 ? 'remaining' : 'over'}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace project page with full layout (read-only for now)**

Replace entire `src/app/projects/[id]/page.tsx`:

```tsx
'use client'

import { AppShell } from '@/components/layout/AppShell'
import { FundingSourceCard } from '@/components/project/FundingSourceCard'
import { LineItemsTable } from '@/components/project/LineItemsTable'
import { SegmentedBar } from '@/components/SegmentedBar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { use } from 'react'

interface AllocationData {
  id: string
  fundingSourceId: string
  fundingSourceName: string
  fundingSourceColor: string
  allocatedAmount: number
}

interface LineItemData {
  id: string
  name: string
  displayPath: string
  category: string | null
  estimatedAmount: number
  isActive: boolean
  spent: number
  remaining: number
  allocationPct: number
  allocations: AllocationData[]
}

interface FundingSourceData {
  id: string
  name: string
  color: string
  allocatedTotal: number
  spent: number
  remaining: number
  qboClassId: string
  qboClassName: string
}

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  projectType: string
  totalEstimated: number
  totalSecured: number
  totalSpent: number
  fundingGap: number
  fundingSources: FundingSourceData[]
  lineItems: LineItemData[]
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadProject() {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) { setError('Project not found'); return }
    setProject(await res.json())
  }

  useEffect(() => { loadProject() }, [id])

  if (error) return (
    <AppShell>
      <p className="text-red-600 text-base">{error}</p>
    </AppShell>
  )

  if (!project) return (
    <AppShell>
      <p className="text-slate-500 text-base">Loading…</p>
    </AppShell>
  )

  const barTotal = Math.max(project.totalEstimated, project.totalSecured)
  const securedUnspent = Math.max(0, project.totalSecured - project.totalSpent)

  return (
    <AppShell>
      <div className="mb-2">
        <nav className="text-sm text-slate-500 mb-4">
          <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
          <span className="mx-2">›</span>
          <span className="text-slate-900">{project.name}</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
        {project.description && <p className="text-slate-500 text-base mt-1">{project.description}</p>}
      </div>

      <div className="mt-4 mb-6">
        <SegmentedBar
          total={barTotal}
          segments={[
            { value: project.totalSpent, color: '#3b82f6', label: 'Spent' },
            { value: securedUnspent, color: '#16a34a', label: 'Secured unspent' },
            { value: Math.max(0, project.fundingGap), color: '#f59e0b', label: 'Funding gap' },
          ]}
        />
        <div className="flex gap-6 mt-2 text-sm text-slate-600">
          <span>Estimated: <strong className="text-slate-900">${project.totalEstimated.toLocaleString()}</strong></span>
          <span>Secured: <strong className="text-green-700">${project.totalSecured.toLocaleString()}</strong></span>
          <span>Spent: <strong className="text-blue-700">${project.totalSpent.toLocaleString()}</strong></span>
          {project.fundingGap > 0
            ? <span>Gap: <strong className="text-amber-700">${project.fundingGap.toLocaleString()}</strong></span>
            : <span>Surplus: <strong className="text-green-700">${Math.abs(project.fundingGap).toLocaleString()}</strong></span>
          }
        </div>
      </div>

      {project.fundingSources.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Funding Sources</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {project.fundingSources.map((fs) => (
              <FundingSourceCard key={fs.id} {...fs} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Budget Line Items</h2>
        <LineItemsTable
          lineItems={project.lineItems}
          isCatchAll={project.projectType === 'catch_all'}
          projectId={id}
          fundingSources={project.fundingSources}
          onUpdate={loadProject}
        />
      </section>
    </AppShell>
  )
}
```

- [ ] **Step 3: Commit (LineItemsTable stub exists in next task — create stub now)**

Create `src/components/project/LineItemsTable.tsx` (stub for now):

```tsx
interface LineItemData {
  id: string
  name: string
  displayPath: string
  category: string | null
  estimatedAmount: number
  spent: number
  remaining: number
  allocationPct: number
  allocations: {
    id: string
    fundingSourceId: string
    fundingSourceName: string
    fundingSourceColor: string
    allocatedAmount: number
  }[]
}

interface FundingSourceOption {
  id: string
  name: string
  color: string
  allocatedTotal: number
}

interface LineItemsTableProps {
  lineItems: LineItemData[]
  isCatchAll: boolean
  projectId: string
  fundingSources: FundingSourceOption[]
  onUpdate: () => void
}

export function LineItemsTable({ lineItems }: LineItemsTableProps) {
  if (lineItems.length === 0) {
    return <p className="text-slate-500 text-base">No line items yet. Run a QBO sync to import data.</p>
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-base">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left font-medium text-slate-600 px-4 py-3">Line Item</th>
            <th className="text-left font-medium text-slate-600 px-4 py-3">Category</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Estimated</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Spent</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => (
            <tr key={li.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3 text-slate-900">{li.name}</td>
              <td className="px-4 py-3 text-slate-500">{li.category ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">${li.estimatedAmount.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums text-blue-700">${li.spent.toLocaleString()}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${li.remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                ${li.remaining.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

```bash
git add src/components/project/ src/app/projects/[id]/page.tsx
git commit -m "feat: project detail page with funding source cards and line items table"
```

---

## Task 9: Line items table — inline expand + editing

**Files:**
- Modify: `src/components/project/LineItemsTable.tsx`
- Create: `src/components/project/AllocationRow.tsx`
- Create: `src/app/api/line-items/[id]/route.ts`
- Create: `src/__tests__/api/line-items.test.ts`

- [ ] **Step 1: Write failing tests for line item PATCH**

Create `src/__tests__/api/line-items.test.ts`:

```typescript
// These test the pure validation logic extracted to a helper
import { validateLineItemPatch } from '@/lib/line-items'

describe('validateLineItemPatch', () => {
  it('accepts valid patch with name', () => {
    expect(validateLineItemPatch({ name: 'Foundation' })).toEqual({ name: 'Foundation' })
  })

  it('accepts valid patch with estimatedAmount', () => {
    expect(validateLineItemPatch({ estimatedAmount: 1500 })).toEqual({ estimatedAmount: 1500 })
  })

  it('accepts null category to clear it', () => {
    expect(validateLineItemPatch({ category: null })).toEqual({ category: null })
  })

  it('rejects negative estimatedAmount', () => {
    expect(() => validateLineItemPatch({ estimatedAmount: -1 })).toThrow('estimatedAmount must be >= 0')
  })

  it('rejects empty name', () => {
    expect(() => validateLineItemPatch({ name: '' })).toThrow('name cannot be empty')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/api/line-items.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/line-items'`

- [ ] **Step 3: Create src/lib/line-items.ts**

```typescript
interface LineItemPatch {
  name?: string
  category?: string | null
  estimatedAmount?: number
}

export function validateLineItemPatch(body: LineItemPatch): LineItemPatch {
  if (body.name !== undefined && body.name.trim() === '') throw new Error('name cannot be empty')
  if (body.estimatedAmount !== undefined && body.estimatedAmount < 0) throw new Error('estimatedAmount must be >= 0')
  return body
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/api/line-items.test.ts --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 5: Create src/app/api/line-items/[id]/route.ts**

```typescript
import { prisma } from '@/lib/prisma'
import { validateLineItemPatch } from '@/lib/line-items'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const patch = validateLineItemPatch(body)
    const updated = await prisma.lineItem.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.category !== undefined && { category: patch.category }),
        ...(patch.estimatedAmount !== undefined && { estimatedAmount: patch.estimatedAmount }),
      },
      select: { id: true, name: true, category: true, estimatedAmount: true },
    })
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 6: Create AllocationRow component**

Create `src/components/project/AllocationRow.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface AllocationRowProps {
  allocationId: string
  fundingSourceName: string
  fundingSourceColor: string
  allocatedAmount: number
  onUpdate: (newAmount: number) => Promise<void>
  onDelete: () => Promise<void>
}

export function AllocationRow({
  allocationId,
  fundingSourceName,
  fundingSourceColor,
  allocatedAmount,
  onUpdate,
  onDelete,
}: AllocationRowProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(allocatedAmount))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setSaving(true)
    await onUpdate(num)
    setEditing(false)
    setSaving(false)
  }

  return (
    <tr className="bg-slate-50 border-b border-slate-100">
      <td className="pl-10 pr-4 py-2.5" colSpan={2}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fundingSourceColor }} />
          <span className="text-base text-slate-700">{fundingSourceName}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right" colSpan={2}>
        {editing ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-slate-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-28 border border-blue-400 rounded px-2 py-1 text-base text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            />
            <button onClick={handleSave} disabled={saving} className="text-sm text-blue-700 font-medium hover:text-blue-900 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-base tabular-nums text-slate-900 border-b border-dashed border-blue-400 hover:border-blue-600 pr-0.5"
            title="Click to edit"
          >
            ${allocatedAmount.toLocaleString()}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <button
          onClick={onDelete}
          className="text-sm text-slate-400 hover:text-red-600 transition-colors"
          title="Remove allocation"
        >
          ✕
        </button>
      </td>
    </tr>
  )
}
```

- [ ] **Step 7: Replace LineItemsTable with full expandable version**

Replace entire `src/components/project/LineItemsTable.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { AllocationRow } from './AllocationRow'

interface AllocationData {
  id: string
  fundingSourceId: string
  fundingSourceName: string
  fundingSourceColor: string
  allocatedAmount: number
}

interface LineItemData {
  id: string
  name: string
  displayPath: string
  category: string | null
  estimatedAmount: number
  spent: number
  remaining: number
  allocationPct: number
  allocations: AllocationData[]
}

interface FundingSourceOption {
  id: string
  name: string
  color: string
  allocatedTotal: number
}

interface LineItemsTableProps {
  lineItems: LineItemData[]
  isCatchAll: boolean
  projectId: string
  fundingSources: FundingSourceOption[]
  onUpdate: () => void
}

function EditableCell({
  value,
  onSave,
  type = 'text',
}: {
  value: string
  onSave: (v: string) => Promise<void>
  type?: 'text' | 'number'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    await onSave(draft)
    setEditing(false)
    setSaving(false)
  }

  if (editing) {
    return (
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus
        disabled={saving}
        className="w-full border border-blue-400 rounded px-2 py-0.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className="text-left w-full border-b border-dashed border-blue-300 hover:border-blue-500 pb-0.5 group"
      title="Click to edit"
    >
      {value || <span className="text-slate-400 italic">—</span>}
      <span className="ml-1 text-slate-400 opacity-0 group-hover:opacity-100 text-xs">✎</span>
    </button>
  )
}

export function LineItemsTable({ lineItems, isCatchAll, fundingSources, onUpdate }: LineItemsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingSourceFor, setAddingSourceFor] = useState<string | null>(null)
  const [selectedFsId, setSelectedFsId] = useState('')
  const [newAllocationAmount, setNewAllocationAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function patchLineItem(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/line-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    onUpdate()
  }

  async function patchAllocation(id: string, amount: number) {
    await fetch(`/api/funding-allocations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocatedAmount: amount }),
    })
    onUpdate()
  }

  async function deleteAllocation(id: string) {
    await fetch(`/api/funding-allocations/${id}`, { method: 'DELETE' })
    onUpdate()
  }

  async function addAllocation(lineItemId: string) {
    if (!selectedFsId || !newAllocationAmount) return
    setSaving(true)
    await fetch(`/api/line-items/${lineItemId}/allocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fundingSourceId: selectedFsId, allocatedAmount: parseFloat(newAllocationAmount) }),
    })
    setAddingSourceFor(null)
    setSelectedFsId('')
    setNewAllocationAmount('')
    setSaving(false)
    onUpdate()
  }

  if (lineItems.length === 0) {
    return <p className="text-slate-500 text-base">No line items yet. Run a QBO sync to import data.</p>
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-base">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left font-medium text-slate-600 px-4 py-3">Line Item</th>
            <th className="text-left font-medium text-slate-600 px-4 py-3">Category</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Estimated</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Spent</th>
            <th className="text-right font-medium text-slate-600 px-4 py-3">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => {
            const isExpanded = expandedId === li.id
            return (
              <>
                <tr
                  key={li.id}
                  className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : li.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs w-3">{isExpanded ? '▼' : '▶'}</span>
                      <span className="text-slate-900">
                        {isCatchAll ? li.displayPath : li.name}
                      </span>
                      {li.allocationPct < 100 && li.estimatedAmount > 0 && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded ml-1">
                          {li.allocationPct}% allocated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{li.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">${li.estimatedAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-blue-700">${li.spent.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${li.remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    ${li.remaining.toLocaleString()}
                  </td>
                </tr>

                {isExpanded && (
                  <>
                    {/* Editable name + category row */}
                    <tr className="bg-blue-50/20 border-b border-slate-100">
                      <td className="pl-10 pr-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <EditableCell
                          value={li.name}
                          onSave={(v) => patchLineItem(li.id, { name: v })}
                        />
                      </td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <EditableCell
                          value={li.category ?? ''}
                          onSave={(v) => patchLineItem(li.id, { category: v || null })}
                        />
                      </td>
                      <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <EditableCell
                          value={String(li.estimatedAmount)}
                          type="number"
                          onSave={(v) => patchLineItem(li.id, { estimatedAmount: parseFloat(v) })}
                        />
                      </td>
                      <td colSpan={2} />
                    </tr>

                    {/* Allocation rows */}
                    {li.allocations.map((alloc) => (
                      <AllocationRow
                        key={alloc.id}
                        allocationId={alloc.id}
                        fundingSourceName={alloc.fundingSourceName}
                        fundingSourceColor={alloc.fundingSourceColor}
                        allocatedAmount={alloc.allocatedAmount}
                        onUpdate={(amount) => patchAllocation(alloc.id, amount)}
                        onDelete={() => deleteAllocation(alloc.id)}
                      />
                    ))}

                    {/* Add source row */}
                    {addingSourceFor === li.id ? (
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <td className="pl-10 pr-4 py-2" colSpan={2} onClick={(e) => e.stopPropagation()}>
                          <select
                            value={selectedFsId}
                            onChange={(e) => setSelectedFsId(e.target.value)}
                            className="text-base border border-slate-300 rounded px-2 py-1 bg-white"
                          >
                            <option value="">Select funding source…</option>
                            {fundingSources
                              .filter((fs) => !li.allocations.some((a) => a.fundingSourceId === fs.id))
                              .map((fs) => (
                                <option key={fs.id} value={fs.id}>{fs.name}</option>
                              ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-500">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={newAllocationAmount}
                              onChange={(e) => setNewAllocationAmount(e.target.value)}
                              className="w-28 border border-slate-300 rounded px-2 py-1 text-base text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right" colSpan={2} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => addAllocation(li.id)}
                              disabled={saving || !selectedFsId || !newAllocationAmount}
                              className="text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
                            >
                              {saving ? 'Adding…' : 'Add'}
                            </button>
                            <button
                              onClick={() => { setAddingSourceFor(null); setSelectedFsId(''); setNewAllocationAmount('') }}
                              className="text-sm text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <td className="pl-10 pr-4 py-2" colSpan={5} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setAddingSourceFor(li.id)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            + Add source
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/project/LineItemsTable.tsx src/components/project/AllocationRow.tsx src/lib/line-items.ts src/__tests__/api/line-items.test.ts src/app/api/line-items/
git commit -m "feat: expandable line items table with inline editing and allocation management UI"
```

---

## Task 10: Allocation CRUD API

**Files:**
- Create: `src/app/api/line-items/[id]/allocations/route.ts`
- Create: `src/app/api/funding-allocations/[id]/route.ts`
- Create: `src/__tests__/api/funding-allocations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/funding-allocations.test.ts`:

```typescript
import { validateAllocationAmount } from '@/lib/allocations'

describe('validateAllocationAmount', () => {
  it('accepts valid positive amount', () => {
    expect(validateAllocationAmount(500)).toBe(500)
  })

  it('accepts zero', () => {
    expect(validateAllocationAmount(0)).toBe(0)
  })

  it('rejects negative', () => {
    expect(() => validateAllocationAmount(-1)).toThrow('allocatedAmount must be >= 0')
  })

  it('rejects non-finite', () => {
    expect(() => validateAllocationAmount(NaN)).toThrow('allocatedAmount must be >= 0')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/api/funding-allocations.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/allocations'`

- [ ] **Step 3: Create src/lib/allocations.ts**

```typescript
export function validateAllocationAmount(amount: number): number {
  if (!isFinite(amount) || amount < 0) throw new Error('allocatedAmount must be >= 0')
  return amount
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/api/funding-allocations.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Create POST allocations route**

Create `src/app/api/line-items/[id]/allocations/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { validateAllocationAmount } from '@/lib/allocations'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lineItemId } = await params
  try {
    const body = await request.json() as { fundingSourceId: string; allocatedAmount: number }
    const amount = validateAllocationAmount(body.allocatedAmount)
    const allocation = await prisma.fundingAllocation.create({
      data: { lineItemId, fundingSourceId: body.fundingSourceId, allocatedAmount: amount },
    })
    return NextResponse.json(allocation, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 6: Create PATCH + DELETE allocation route**

Create `src/app/api/funding-allocations/[id]/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { validateAllocationAmount } from '@/lib/allocations'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json() as { allocatedAmount: number }
    const amount = validateAllocationAmount(body.allocatedAmount)
    const updated = await prisma.fundingAllocation.update({
      where: { id },
      data: { allocatedAmount: amount },
    })
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.fundingAllocation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/allocations.ts src/__tests__/api/funding-allocations.test.ts src/app/api/line-items/[id]/allocations/ src/app/api/funding-allocations/
git commit -m "feat: allocation CRUD API routes (POST, PATCH, DELETE)"
```

---

## Task 11: Funding source CRUD API

**Files:**
- Create: `src/app/api/projects/[id]/funding-sources/route.ts`
- Create: `src/app/api/funding-sources/[id]/route.ts`

No new test file needed — validation follows the same pattern already tested.

The predefined color palette for auto-assigning colors:

```
['#3b82f6','#16a34a','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']
```

- [ ] **Step 1: Create POST funding sources route**

Create `src/app/api/projects/[id]/funding-sources/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const COLOR_PALETTE = ['#3b82f6','#16a34a','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const body = await request.json() as {
    name: string
    qboClassId: string
    qboClassName: string
    allocatedTotal: number
    color?: string
  }

  const existing = await prisma.fundingSource.count({ where: { projectId } })
  const color = body.color ?? COLOR_PALETTE[existing % COLOR_PALETTE.length]

  const source = await prisma.fundingSource.create({
    data: {
      projectId,
      name: body.name,
      color,
      allocatedTotal: body.allocatedTotal,
      qboClassId: body.qboClassId,
      qboClassName: body.qboClassName,
    },
  })
  return NextResponse.json(source, { status: 201 })
}
```

- [ ] **Step 2: Create PATCH + DELETE funding source route**

Create `src/app/api/funding-sources/[id]/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as { name?: string; color?: string; allocatedTotal?: number }
  const updated = await prisma.fundingSource.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.allocatedTotal !== undefined && { allocatedTotal: body.allocatedTotal }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.fundingSource.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/[id]/funding-sources/ src/app/api/funding-sources/
git commit -m "feat: funding source CRUD API routes"
```

---

## Task 12: User roles API + admin users page

**Files:**
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/users/[id]/route.ts`
- Create: `src/app/admin/users/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create users API routes**

Create `src/app/api/users/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied.error

  const supabase = await createClient()
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const roles = await prisma.userRole.findMany()
  const roleMap = new Map(roles.map((r) => [r.userId, r.role]))

  const result = (users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    role: roleMap.get(u.id) ?? 'viewer',
  }))

  return NextResponse.json({ users: result })
}
```

Create `src/app/api/users/[id]/route.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied.error

  const { id: userId } = await params
  const body = await request.json() as { role: 'admin' | 'viewer' }

  if (body.role !== 'admin' && body.role !== 'viewer') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const userRole = await prisma.userRole.upsert({
    where: { userId },
    update: { role: body.role },
    create: { userId, role: body.role },
  })
  return NextResponse.json(userRole)
}
```

- [ ] **Step 2: Create admin users page**

Create `src/app/admin/users/page.tsx`:

```tsx
'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useEffect, useState } from 'react'

interface UserRow {
  id: string
  email: string
  role: 'admin' | 'viewer'
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  async function loadUsers() {
    const res = await fetch('/api/users')
    if (!res.ok) { setError('Access denied or failed to load users'); setLoading(false); return }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function handleRoleChange(userId: string, role: 'admin' | 'viewer') {
    setUpdating(userId)
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    await loadUsers()
    setUpdating(null)
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">User Management</h1>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-4 text-base mb-6">{error}</div>}
      {loading && <p className="text-slate-500 text-base">Loading…</p>}

      {!loading && !error && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-w-2xl">
          <table className="w-full text-base">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Email</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-900">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'viewer')}
                      disabled={updating === user.id}
                      className="text-base border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 disabled:opacity-50"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
```

- [ ] **Step 3: Add Admin link to sidebar**

In `src/components/layout/Sidebar.tsx`, add the admin nav item:

```typescript
const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reports', label: 'Reports' },
  { href: '/admin/users', label: 'Users' },
  { href: '/settings', label: 'Settings' },
]
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/ src/app/admin/ src/components/layout/Sidebar.tsx
git commit -m "feat: user roles admin page and API routes"
```

---

## Task 13: Responsive design

**Files:**
- Modify: `src/components/dashboard/SummaryStrip.tsx`
- Modify: `src/components/dashboard/ProjectCard.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Make SummaryStrip responsive (2×2 grid on mobile)**

In `src/components/dashboard/SummaryStrip.tsx`, change the wrapper div:

```tsx
// Replace:
<div className="flex gap-4 flex-wrap sm:flex-nowrap">
// With:
<div className="grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap sm:gap-4">
```

- [ ] **Step 2: Make ProjectCard hide funding chips on mobile**

In `src/components/dashboard/ProjectCard.tsx`, add `hidden sm:flex` to the funding chips div:

```tsx
// Replace:
<div className="flex flex-wrap gap-2 mt-3">
// With:
<div className="hidden sm:flex flex-wrap gap-2 mt-3">
```

- [ ] **Step 3: Make AppShell collapsible sidebar on mobile**

Replace entire `src/components/layout/AppShell.tsx`:

```tsx
'use client'

import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useState } from 'react'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed md:static z-30 h-full transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update Topbar to accept onMenuClick**

Replace entire `src/components/layout/Topbar.tsx`:

```tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md"
        aria-label="Open menu"
      >
        ☰
      </button>
      <div className="hidden md:block" />
      <button
        onClick={handleSignOut}
        className="text-base text-slate-500 hover:text-slate-900"
      >
        Sign out
      </button>
    </header>
  )
}
```

- [ ] **Step 5: Update Sidebar to accept onClose prop**

In `src/components/layout/Sidebar.tsx`, add `onClose` prop and a close button on mobile:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reports', label: 'Reports' },
  { href: '/admin/users', label: 'Users' },
  { href: '/settings', label: 'Settings' },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col h-full min-h-screen">
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-lg font-bold text-slate-900">SVO Budget</span>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-700 text-xl" aria-label="Close menu">
            ✕
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`flex items-center px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
              pathname.startsWith(item.href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 6: Start dev server and check responsive layout**

```bash
npm run dev
```

Open http://localhost:3000/dashboard in browser. Test:
1. Resize to mobile width (375px) — summary strip shows as 2×2 grid, funding chips hidden on cards
2. Hamburger menu button appears on mobile; click opens sidebar overlay
3. Clicking nav item closes sidebar
4. On desktop, sidebar is always visible, no hamburger button

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/ src/components/dashboard/SummaryStrip.tsx src/components/dashboard/ProjectCard.tsx
git commit -m "feat: responsive layout with collapsible mobile sidebar and 2x2 summary grid"
```

---

## Task 14: Full test suite + final verification

- [ ] **Step 1: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass. Fix any failures before continuing.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Manual end-to-end checklist**

Start dev server: `npm run dev`

Work through this checklist:

**Dashboard:**
- [ ] Summary strip shows Estimated Costs, Secured Funding, Spent to Date, Remaining
- [ ] Each project shows as a card with segmented bar (blue/green/amber) and funding chips
- [ ] Clicking a project card navigates to project detail

**Project Detail:**
- [ ] Breadcrumb shows "Dashboard › Project Name"
- [ ] Segmented bar + summary figures at top
- [ ] Funding source cards show colored left border, mini bar, spent/remaining
- [ ] Line items table shows all items with Estimated / Spent / Remaining
- [ ] Amber "X% allocated" badge on under-allocated items
- [ ] Clicking a row expands it inline
- [ ] In expanded view: name, category, estimated amount are editable (dashed underline + ✎)
- [ ] In expanded view: allocation rows show per funding source with editable amounts
- [ ] Save on Enter/blur; Cancel on Escape
- [ ] "+ Add source" shows dropdown + amount input; clicking Add creates allocation
- [ ] ✕ on allocation row removes it

**Settings:**
- [ ] After disconnecting QBO, sync result message clears (bug fix)

**Users page:**
- [ ] Admin can see list of users with roles
- [ ] Changing role dropdown updates the role immediately

**Responsive (resize to 375px):**
- [ ] Summary strip is 2×2 grid
- [ ] Funding chips hidden on project cards
- [ ] Hamburger menu opens/closes sidebar

- [ ] **Step 4: Commit any fixes**

```bash
git add -p
git commit -m "fix: address issues found during end-to-end verification"
```

---

## Self-Review Against Spec

**Spec coverage:**

- ✅ Dashboard summary strip (Estimated Costs, Secured Funding, Spent to Date, Remaining) — Task 6
- ✅ Project cards with segmented progress bars (blue/green/amber) — Task 6
- ✅ Funding source chips with allocated amounts — Task 6
- ✅ Funding gap / surplus badge on project cards — Task 6
- ✅ Project detail: breadcrumb navigation — Task 8
- ✅ Project detail: funding source cards with colored left border, mini bar — Task 8
- ✅ Budget line items table: Estimated (editable), Spent (read-only), Remaining (calculated) — Task 9
- ✅ Catch-all project shows full colon-separated path in Line Item column — Task 9
- ✅ Click row to expand inline with allocation rows — Task 9
- ✅ Editable fields: name, category, estimated amount — Task 9
- ✅ Editable in expanded view: allocated amount per funding source — Task 9
- ✅ Amber "X% allocated" badge on under-allocated items — Task 9
- ✅ "+ Add source" button in expanded footer — Task 9
- ✅ Allocation CRUD (add, edit amount, remove) — Tasks 9 + 10
- ✅ Admin/Viewer roles — Tasks 12 + 13 (admin page, API, auth helpers)
- ✅ Responsive design: summary strip 2×2 on mobile, chips hidden — Task 13
- ✅ Mobile sidebar with overlay — Task 13
- ✅ Cosmetic bug fix: disconnect clears sync result — Task 1

**Deferred to Plan 4:**
- Reports page (Funding Source Report, Project Budget vs Actual, PDF export)
- "+ Add Funding Source" button on project detail page (API exists in Task 11, but no UI button added to project page — add in a follow-up if needed before Plan 4)
- "+ Add Line Item" manual creation button (API stub noted in file map, not wired to UI — QBO-sourced items cover the main use case)
- Warning when mapped QBO class/account is no longer active

**Note on `+ Add Funding Source` button:** The API route (`POST /api/projects/[id]/funding-sources`) is built in Task 11. A button can be added to the project detail page after Task 8 using the same pattern as other edit actions. This was scoped out of the table tasks to keep them focused, but the hook (`onUpdate`) is already in place.
