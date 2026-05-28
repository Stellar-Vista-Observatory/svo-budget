# Actuals Sign Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-user database-backed toggle that displays actuals (QuickBooks expenses) as negative red numbers across all views, defaulting to on.

**Architecture:** A new `UserPreference` Prisma model stores the flag per Supabase user ID. A `UserPreferencesProvider` React context (mirrors `ToastProvider`) fetches the preference once on mount and exposes it app-wide. An `applyActualSign` helper applies the sign at render time only — internal arithmetic always uses raw positive amounts.

**Tech Stack:** Prisma 7 (PostgreSQL), Next.js App Router API routes, React context, MUI v9, Jest (mocked Prisma pattern matching existing tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/formatting.ts` | `applyActualSign` utility |
| Create | `src/lib/UserPreferencesProvider.tsx` | React context + hook |
| Create | `src/app/api/me/preferences/route.ts` | GET + PATCH API route |
| Modify | `prisma/schema.prisma` | Add `UserPreference` model |
| Modify | `src/app/layout.tsx` | Wrap with `UserPreferencesProvider` |
| Modify | `src/app/settings/page.tsx` | Add "Display Preferences" section |
| Modify | `src/components/project/LineItemsTable.tsx` | Apply sign in `ActualsSection` + `CategorySection` + `TotalsRow` |
| Modify | `src/app/projects/[id]/page.tsx` | Apply sign in stat boxes |
| Modify | `src/app/reports/budget-vs-actual/page.tsx` | Apply sign in table rows + summary |
| Modify | `src/app/reports/funding-source/page.tsx` | Apply sign in table rows + summary |
| Create | `src/__tests__/lib/formatting.test.ts` | Unit tests for `applyActualSign` |
| Create | `src/__tests__/api/me-preferences.test.ts` | Integration tests for preferences API |

---

## Task 1: `applyActualSign` utility (TDD)

**Files:**
- Create: `src/lib/formatting.ts`
- Create: `src/__tests__/lib/formatting.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/formatting.test.ts`:

```ts
import { applyActualSign } from '@/lib/formatting'

describe('applyActualSign', () => {
  describe('showAsNegative = true', () => {
    it('negates a positive amount', () => {
      expect(applyActualSign(29000, true)).toBe(-29000)
    })
    it('negates an already-negative amount (normalizes first)', () => {
      expect(applyActualSign(-29000, true)).toBe(-29000)
    })
    it('returns 0 for zero', () => {
      expect(applyActualSign(0, true)).toBe(0)
    })
  })

  describe('showAsNegative = false', () => {
    it('returns a positive amount unchanged', () => {
      expect(applyActualSign(29000, false)).toBe(29000)
    })
    it('returns absolute value for a negative input', () => {
      expect(applyActualSign(-29000, false)).toBe(29000)
    })
    it('returns 0 for zero', () => {
      expect(applyActualSign(0, false)).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/lib/formatting.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/formatting'`

- [ ] **Step 3: Create `src/lib/formatting.ts`**

```ts
export function applyActualSign(amount: number, showAsNegative: boolean): number {
  return showAsNegative ? -Math.abs(amount) : Math.abs(amount)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/lib/formatting.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Lint**

```bash
npx eslint src/lib/formatting.ts src/__tests__/lib/formatting.test.ts
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/formatting.ts src/__tests__/lib/formatting.test.ts
git commit -m "feat: add applyActualSign formatting utility"
```

---

## Task 2: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model**

Append to `prisma/schema.prisma` (after the `UserRole` model, before the final newline):

```prisma
model UserPreference {
  id                    String   @id @default(uuid())
  userId                String   @unique
  showActualsAsNegative Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@map("user_preferences")
}
```

- [ ] **Step 2: Generate and run migration**

```bash
npx prisma migrate dev --name add-user-preferences
```

Expected output includes: `The following migration(s) have been applied: .../add-user-preferences/migration.sql`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add UserPreference schema and migration"
```

---

## Task 3: `/api/me/preferences` route (TDD)

**Files:**
- Create: `src/app/api/me/preferences/route.ts`
- Create: `src/__tests__/api/me-preferences.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/api/me-preferences.test.ts`:

```ts
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userPreference: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { GET, PATCH } from '@/app/api/me/preferences/route'

const mockCreateClient = createClient as jest.Mock

function mockSession(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/me/preferences', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('upserts default row and returns showActualsAsNegative: true on first call', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      showActualsAsNegative: true,
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ showActualsAsNegative: true })
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', showActualsAsNegative: true },
      update: {},
      select: { showActualsAsNegative: true },
    })
  })

  it('returns existing preference when row already exists', async () => {
    mockSession({ id: 'user-2' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      showActualsAsNegative: false,
    })
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ showActualsAsNegative: false })
  })
})

describe('PATCH /api/me/preferences', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: false }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('persists showActualsAsNegative: false', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      showActualsAsNegative: false,
    })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: false }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ showActualsAsNegative: false })
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', showActualsAsNegative: false },
      update: { showActualsAsNegative: false },
      select: { showActualsAsNegative: true },
    })
  })

  it('persists showActualsAsNegative: true', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      showActualsAsNegative: true,
    })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: true }),
    })
    const res = await PATCH(req)
    const body = await res.json()
    expect(body).toEqual({ showActualsAsNegative: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/__tests__/api/me-preferences.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/me/preferences/route'`

- [ ] **Step 3: Create the route**

Create `src/app/api/me/preferences/route.ts`:

```ts
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const pref = await prisma.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, showActualsAsNegative: true },
    update: {},
    select: { showActualsAsNegative: true },
  })

  return NextResponse.json(pref)
}

export async function PATCH(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const { showActualsAsNegative } = await req.json() as { showActualsAsNegative: boolean }

  const pref = await prisma.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, showActualsAsNegative },
    update: { showActualsAsNegative },
    select: { showActualsAsNegative: true },
  })

  return NextResponse.json(pref)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/__tests__/api/me-preferences.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Lint**

```bash
npx eslint src/app/api/me/preferences/route.ts src/__tests__/api/me-preferences.test.ts
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/me/preferences/route.ts src/__tests__/api/me-preferences.test.ts
git commit -m "feat: add /api/me/preferences GET and PATCH route"
```

---

## Task 4: `UserPreferencesProvider` context

**Files:**
- Create: `src/lib/UserPreferencesProvider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the provider**

Create `src/lib/UserPreferencesProvider.tsx`:

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface UserPreferencesContextValue {
  showActualsAsNegative: boolean
  setShowActualsAsNegative: (value: boolean) => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  showActualsAsNegative: true,
  setShowActualsAsNegative: async () => {},
})

export function useUserPreferences() {
  return useContext(UserPreferencesContext)
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [showActualsAsNegative, setShowActualsAsNegativeState] = useState(true)

  useEffect(() => {
    fetch('/api/me/preferences')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.showActualsAsNegative === 'boolean') {
          setShowActualsAsNegativeState(d.showActualsAsNegative)
        }
      })
      .catch(() => {})
  }, [])

  async function setShowActualsAsNegative(value: boolean) {
    setShowActualsAsNegativeState(value)
    await fetch('/api/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showActualsAsNegative: value }),
    })
  }

  return (
    <UserPreferencesContext.Provider value={{ showActualsAsNegative, setShowActualsAsNegative }}>
      {children}
    </UserPreferencesContext.Provider>
  )
}
```

- [ ] **Step 2: Wrap the root layout**

Edit `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ToastProvider'
import { UserPreferencesProvider } from '@/lib/UserPreferencesProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SVO Budget',
  description: 'Project budget tracking for SVO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <UserPreferencesProvider>
            {children}
          </UserPreferencesProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Lint**

```bash
npx eslint src/lib/UserPreferencesProvider.tsx src/app/layout.tsx
```

Expected: no errors

- [ ] **Step 4: Run full test suite to check nothing broke**

```bash
npx jest --no-coverage
```

Expected: all previously passing tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/UserPreferencesProvider.tsx src/app/layout.tsx
git commit -m "feat: add UserPreferencesProvider context"
```

---

## Task 5: Settings UI toggle

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Add `FormControlLabel`, `Switch`, and `Divider` to imports**

At the top of `src/app/settings/page.tsx`, add `FormControlLabel`, `Switch`, and `Divider` to the existing MUI import block:

```tsx
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
```

- [ ] **Step 2: Import `useUserPreferences`**

Add to the imports at the top of `src/app/settings/page.tsx`:

```tsx
import { useUserPreferences } from '@/lib/UserPreferencesProvider'
```

- [ ] **Step 3: Consume the context inside `SettingsPage`**

At the top of the `SettingsPage` function body (after the existing `useState` calls), add:

```tsx
const { showActualsAsNegative, setShowActualsAsNegative } = useUserPreferences()
```

- [ ] **Step 4: Add "Display Preferences" section**

Just before the closing `</Stack>` tag (before `</AppShell>`) in `src/app/settings/page.tsx`, insert:

```tsx
{/* Display Preferences */}
<Paper variant="outlined" sx={{ p: 3 }}>
  <Typography variant="h6" sx={{ mb: 2 }}>Display Preferences</Typography>
  <Divider sx={{ mb: 2 }} />
  <FormControlLabel
    control={
      <Switch
        checked={showActualsAsNegative}
        onChange={(e) => setShowActualsAsNegative(e.target.checked)}
      />
    }
    label={
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>Show actuals as negative numbers</Typography>
        <Typography variant="caption" color="text.secondary">
          When enabled, expenses imported from QuickBooks are displayed as negative values (e.g., –$29,000) in red.
        </Typography>
      </Box>
    }
  />
</Paper>
```

- [ ] **Step 5: Lint**

```bash
npx eslint src/app/settings/page.tsx
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add display preferences toggle in settings"
```

---

## Task 6: Apply sign in `LineItemsTable`

**Files:**
- Modify: `src/components/project/LineItemsTable.tsx`

There are three sub-components to update: `ActualsSection`, `CategorySection` (`totalSpent` display), and `TotalsRow` (`totalActual` display). Arithmetic (remaining calculations) is never changed — only the final rendered value passed to `fmt()`.

- [ ] **Step 1: Import `applyActualSign` and `useUserPreferences`**

In `src/components/project/LineItemsTable.tsx`, add to the existing imports:

```tsx
import { applyActualSign } from '@/lib/formatting'
import { useUserPreferences } from '@/lib/UserPreferencesProvider'
```

- [ ] **Step 2: Read the preference in `ActualsSection`**

At the top of the `ActualsSection` function body (after the `useState` calls), add:

```tsx
const { showActualsAsNegative } = useUserPreferences()
```

- [ ] **Step 3: Apply sign in `ActualsSection` — funding-source subtotals (line ~491)**

Replace:
```tsx
{actualBySourceId[fs.id] > 0 ? fmt(actualBySourceId[fs.id]) : <span style={{ color: '#ccc' }}>—</span>}
```
With:
```tsx
{actualBySourceId[fs.id] > 0
  ? <span style={{ color: showActualsAsNegative ? 'var(--mui-palette-error-main, #d32f2f)' : undefined }}>
      {fmt(applyActualSign(actualBySourceId[fs.id], showActualsAsNegative))}
    </span>
  : <span style={{ color: '#ccc' }}>—</span>}
```

- [ ] **Step 4: Apply sign in `ActualsSection` — section total (line ~496)**

Replace:
```tsx
<TableCell align="right" sx={subHdrSx}>{fmt(totalActual)}</TableCell>
```
With:
```tsx
<TableCell align="right" sx={{ ...subHdrSx, color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(totalActual, showActualsAsNegative))}
</TableCell>
```

- [ ] **Step 5: Apply sign in `ActualsSection` — individual row amounts (lines ~517 and ~525)**

Replace the two `fmt(a.amount)` calls inside the `actuals.map` block:

First occurrence (inside the funding-source column, line ~517):
```tsx
<Typography sx={{ fontSize: '0.78rem', color: a.fundingSourceColor, fontWeight: 500 }}>{fmt(a.amount)}</Typography>
```
Replace with:
```tsx
<Typography sx={{ fontSize: '0.78rem', color: showActualsAsNegative ? 'error.main' : a.fundingSourceColor, fontWeight: 500 }}>
  {fmt(applyActualSign(a.amount, showActualsAsNegative))}
</Typography>
```

Second occurrence (the row total column, line ~525):
```tsx
<Typography sx={{ fontSize: '0.78rem', fontWeight: 500 }}>{fmt(a.amount)}</Typography>
```
Replace with:
```tsx
<Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(a.amount, showActualsAsNegative))}
</Typography>
```

- [ ] **Step 6: Read the preference in `CategorySection` and apply to `totalSpent` display**

At the top of the `CategoryRow` function body (after `const [seenSignal, setSeenSignal] = useState(signal.count)`), add:

```tsx
const { showActualsAsNegative } = useUserPreferences()
```

Then find the `totalSpent` display cell (line ~654–656):
```tsx
<Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
  {totalSpent === 0 ? <span style={{ color: '#9e9e9e' }}>$0</span> : fmt(totalSpent)}
</Typography>
```
Replace with:
```tsx
<Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: totalSpent === 0 ? undefined : showActualsAsNegative ? 'error.main' : undefined }}>
  {totalSpent === 0
    ? <span style={{ color: '#9e9e9e' }}>$0</span>
    : fmt(applyActualSign(totalSpent, showActualsAsNegative))}
</Typography>
```

- [ ] **Step 7: Read the preference in `TotalsRow` and apply to `totalActual` display**

At the top of the `TotalsRow` function body, add:

```tsx
const { showActualsAsNegative } = useUserPreferences()
```

Then find (line ~729):
```tsx
<TableCell align="right" sx={cellSx}>{fmt(totalActual)}</TableCell>
```
Replace with:
```tsx
<TableCell align="right" sx={{ ...cellSx, color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(totalActual, showActualsAsNegative))}
</TableCell>
```

- [ ] **Step 8: Lint**

```bash
npx eslint src/components/project/LineItemsTable.tsx
```

Expected: no errors

- [ ] **Step 9: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 10: Commit**

```bash
git add src/components/project/LineItemsTable.tsx
git commit -m "feat: apply actuals sign preference in LineItemsTable"
```

---

## Task 7: Apply sign in project detail page

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`

- [ ] **Step 1: Import `applyActualSign` and `useUserPreferences`**

Add to the imports in `src/app/projects/[id]/page.tsx`:

```tsx
import { applyActualSign } from '@/lib/formatting'
import { useUserPreferences } from '@/lib/UserPreferencesProvider'
```

- [ ] **Step 2: Read the preference**

Inside the `default export` page component function body, after the existing `const remaining = ...` line, add:

```tsx
const { showActualsAsNegative } = useUserPreferences()
```

- [ ] **Step 3: Apply sign to "Actuals To Date" stat box (line ~187)**

Replace:
```tsx
<StatBox label="Actuals To Date" value={fmt(project.totalSpent)} />
```
With:
```tsx
<StatBox
  label="Actuals To Date"
  value={fmt(applyActualSign(project.totalSpent, showActualsAsNegative))}
  highlight={showActualsAsNegative && project.totalSpent > 0 ? 'bad' : undefined}
/>
```

`StatBox` is defined at line 87 of the same file and accepts `highlight?: 'warn' | 'bad' | 'good'`. `'bad'` renders with a red background + red text (`#c62828`).

- [ ] **Step 5: Lint**

```bash
npx eslint "src/app/projects/[id]/page.tsx"
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "src/app/projects/[id]/page.tsx"
git commit -m "feat: apply actuals sign preference in project detail page"
```

---

## Task 8: Apply sign in budget-vs-actual report

**Files:**
- Modify: `src/app/reports/budget-vs-actual/page.tsx`

- [ ] **Step 1: Import `applyActualSign` and `useUserPreferences`**

Add to the imports in `src/app/reports/budget-vs-actual/page.tsx`:

```tsx
import { applyActualSign } from '@/lib/formatting'
import { useUserPreferences } from '@/lib/UserPreferencesProvider'
```

- [ ] **Step 2: Read the preference**

Inside the `BudgetVsActualReport` function body, after the existing `useState` calls, add:

```tsx
const { showActualsAsNegative } = useUserPreferences()
```

- [ ] **Step 3: Apply sign to summary strip "Total Actuals" (line ~182)**

Replace:
```tsx
<Typography sx={{ fontWeight: 700 }}>{fmt(report.totalSpent)}</Typography>
```
(the one directly under `<Typography variant="caption" color="text.secondary">Total Actuals</Typography>`)

With:
```tsx
<Typography sx={{ fontWeight: 700, color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(report.totalSpent, showActualsAsNegative))}
</Typography>
```

- [ ] **Step 4: Apply sign to category row `totalSpent` (line ~234)**

Replace:
```tsx
<TableCell align="right">{fmt(cat.totalSpent)}</TableCell>
```
With:
```tsx
<TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(cat.totalSpent, showActualsAsNegative))}
</TableCell>
```

- [ ] **Step 5: Apply sign to individual actual row amounts (line ~290)**

Replace:
```tsx
<TableCell align="right">{fmt(actual.amount)}</TableCell>
```
With:
```tsx
<TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(actual.amount, showActualsAsNegative))}
</TableCell>
```

- [ ] **Step 6: Apply sign to totals row `totalSpent` (line ~306)**

Replace:
```tsx
<TableCell align="right">{fmt(report.totalSpent)}</TableCell>
```
(inside the `TOTAL` row)

With:
```tsx
<TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(report.totalSpent, showActualsAsNegative))}
</TableCell>
```

- [ ] **Step 7: Lint**

```bash
npx eslint src/app/reports/budget-vs-actual/page.tsx
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/app/reports/budget-vs-actual/page.tsx
git commit -m "feat: apply actuals sign preference in budget-vs-actual report"
```

---

## Task 9: Apply sign in funding-source report

**Files:**
- Modify: `src/app/reports/funding-source/page.tsx`

- [ ] **Step 1: Import `applyActualSign` and `useUserPreferences`**

Add to the imports in `src/app/reports/funding-source/page.tsx`:

```tsx
import { applyActualSign } from '@/lib/formatting'
import { useUserPreferences } from '@/lib/UserPreferencesProvider'
```

- [ ] **Step 2: Read the preference**

Inside the `FundingSourceReport` function body, after the existing `useState` calls, add:

```tsx
const { showActualsAsNegative } = useUserPreferences()
```

- [ ] **Step 3: Apply sign to summary strip "Total Actuals" (line ~220)**

Replace:
```tsx
<Typography sx={{ fontWeight: 700 }}>{fmt(report.totalSpent)}</Typography>
```
(under `<Typography variant="caption" color="text.secondary">Total Actuals</Typography>`)

With:
```tsx
<Typography sx={{ fontWeight: 700, color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(report.totalSpent, showActualsAsNegative))}
</Typography>
```

- [ ] **Step 4: Apply sign to category row `cat.spent` (line ~250)**

Replace:
```tsx
<TableCell align="right">{fmt(cat.spent)}</TableCell>
```
With:
```tsx
<TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(cat.spent, showActualsAsNegative))}
</TableCell>
```

- [ ] **Step 5: Apply sign to individual actual row amounts (line ~304)**

Replace:
```tsx
<TableCell align="right">{fmt(actual.amount)}</TableCell>
```
With:
```tsx
<TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(actual.amount, showActualsAsNegative))}
</TableCell>
```

- [ ] **Step 6: Apply sign to totals row `totalSpent` (line ~316)**

Replace:
```tsx
<TableCell align="right">{fmt(report.totalSpent)}</TableCell>
```
(inside the `TOTAL` row)

With:
```tsx
<TableCell align="right" sx={{ color: showActualsAsNegative ? 'error.main' : undefined }}>
  {fmt(applyActualSign(report.totalSpent, showActualsAsNegative))}
</TableCell>
```

- [ ] **Step 7: Lint**

```bash
npx eslint src/app/reports/funding-source/page.tsx
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/app/reports/funding-source/page.tsx
git commit -m "feat: apply actuals sign preference in funding-source report"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass, no regressions

- [ ] **Step 2: Lint all modified files**

```bash
npx eslint \
  src/lib/formatting.ts \
  src/lib/UserPreferencesProvider.tsx \
  src/app/api/me/preferences/route.ts \
  src/app/layout.tsx \
  src/app/settings/page.tsx \
  src/components/project/LineItemsTable.tsx \
  "src/app/projects/[id]/page.tsx" \
  src/app/reports/budget-vs-actual/page.tsx \
  src/app/reports/funding-source/page.tsx
```

Expected: no errors
