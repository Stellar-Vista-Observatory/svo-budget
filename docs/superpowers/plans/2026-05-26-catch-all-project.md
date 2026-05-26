# Catch-All Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create an "All Other Expenses" catch-all project on first QBO sync, protect it from modification/deletion, sort it last in all project lists, and display it with a "Default" badge in the settings UI.

**Architecture:** A `getOrCreateCatchAllProject()` helper is added to the sync library and called at the top of `syncCategories`, guaranteeing the catch-all always exists before unclaimed accounts are routed. PATCH and DELETE route handlers gain a preflight `findUnique` check that returns 403 for `catch_all` projects. The projects list API sorts `catch_all` last using compound `orderBy`. The settings UI renders the catch-all project with a badge and without edit/delete controls.

**Tech Stack:** Next.js App Router, Prisma ORM, Jest, MUI (Material UI), TypeScript

---

### Task 1: Add `getOrCreateCatchAllProject` helper

**Files:**
- Modify: `src/lib/qbo/sync.ts`
- Modify: `src/__tests__/lib/qbo/sync.test.ts`

- [ ] **Step 1: Extend the Prisma project mock to include `findFirst` and `create`**

In `src/__tests__/lib/qbo/sync.test.ts`, update the `jest.mock('@/lib/prisma', ...)` block. Change:

```ts
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn() },
    category: { findMany: jest.fn(), upsert: jest.fn() },
    fundingSource: { findMany: jest.fn(), upsert: jest.fn() },
    actual: { upsert: jest.fn() },
    qboConnection: { update: jest.fn() },
  },
}))
```

To:

```ts
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    category: { findMany: jest.fn(), upsert: jest.fn() },
    fundingSource: { findMany: jest.fn(), upsert: jest.fn() },
    actual: { upsert: jest.fn() },
    qboConnection: { update: jest.fn() },
  },
}))
```

- [ ] **Step 2: Write failing tests for `getOrCreateCatchAllProject`**

Update the import at the top of `src/__tests__/lib/qbo/sync.test.ts`:

```ts
import { syncAll, getOrCreateCatchAllProject } from '@/lib/qbo/sync'
```

Add this `describe` block at the end of the file:

```ts
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
```

- [ ] **Step 3: Run the new tests to confirm they fail**

```bash
npx jest src/__tests__/lib/qbo/sync.test.ts --testNamePattern="getOrCreateCatchAllProject" --no-coverage
```

Expected: FAIL — `getOrCreateCatchAllProject` is not exported from `@/lib/qbo/sync`

- [ ] **Step 4: Implement `getOrCreateCatchAllProject` in sync.ts**

In `src/lib/qbo/sync.ts`, add this exported function before `syncCategories`:

```ts
export async function getOrCreateCatchAllProject() {
  const existing = await prisma.project.findFirst({ where: { projectType: 'catch_all' } })
  if (existing) return existing
  return prisma.project.create({
    data: { name: 'All Other Expenses', projectType: 'catch_all' },
  })
}
```

- [ ] **Step 5: Run the new tests to confirm they pass**

```bash
npx jest src/__tests__/lib/qbo/sync.test.ts --testNamePattern="getOrCreateCatchAllProject" --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/qbo/sync.ts src/__tests__/lib/qbo/sync.test.ts
git commit -m "feat: add getOrCreateCatchAllProject helper"
```

---

### Task 2: Wire `getOrCreateCatchAllProject` into `syncCategories`

**Files:**
- Modify: `src/lib/qbo/sync.ts`
- Modify: `src/__tests__/lib/qbo/sync.test.ts`

- [ ] **Step 1: Add `findFirst` mock setup to all existing `syncAll` tests**

Each `syncAll` test now needs `findFirst` set up because `syncCategories` will call `getOrCreateCatchAllProject`. Open `src/__tests__/lib/qbo/sync.test.ts` and add the following line immediately after each `(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([...])` call in every existing `syncAll` test:

```ts
;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
  id: 'catch-1', projectType: 'catch_all', name: 'All Other Expenses', qboAccountId: null,
})
```

Do this for all four tests in `describe('syncAll — categories', ...)` and `describe('syncAll — transactions', ...)`.

**Exception for "puts unclaimed accounts into catch_all project":** this test currently puts the catch_all in `findMany`. Change it to put an empty array in `findMany` and the catch_all in `findFirst`:

```ts
;(mockPrisma.project.findMany as jest.Mock).mockResolvedValue([])
;(mockPrisma.project.findFirst as jest.Mock).mockResolvedValue({
  id: 'catch-1', projectType: 'catch_all', name: 'All Other Expenses', qboAccountId: null,
})
```

- [ ] **Step 2: Run full sync tests to confirm state before implementation change**

```bash
npx jest src/__tests__/lib/qbo/sync.test.ts --no-coverage
```

The `getOrCreateCatchAllProject` tests should PASS. The `syncAll` tests may fail because `syncCategories` doesn't call `findFirst` yet — that's expected.

- [ ] **Step 3: Replace the catch_all lookup in `syncCategories` with `getOrCreateCatchAllProject`**

In `src/lib/qbo/sync.ts`, replace the opening of `syncCategories`:

```ts
async function syncCategories(accounts: QboAccount[]): Promise<number> {
  const projects = await prisma.project.findMany()
  const claimedProjects = projects.filter(
    (p) => p.projectType === 'claimed' && p.qboAccountId
  )
  const catchAllProject = projects.find((p) => p.projectType === 'catch_all')
```

With:

```ts
async function syncCategories(accounts: QboAccount[]): Promise<number> {
  const [projects, catchAllProject] = await Promise.all([
    prisma.project.findMany(),
    getOrCreateCatchAllProject(),
  ])
  const claimedProjects = projects.filter(
    (p) => p.projectType === 'claimed' && p.qboAccountId
  )
```

- [ ] **Step 4: Remove the `if (catchAllProject)` guard around the unclaimed-account loop**

In `src/lib/qbo/sync.ts`, replace:

```ts
  // Catch-all: every unclaimed active account becomes its own category (flattened)
  if (catchAllProject) {
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
  }
```

With:

```ts
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
```

- [ ] **Step 5: Run the full sync test suite to confirm all tests pass**

```bash
npx jest src/__tests__/lib/qbo/sync.test.ts --no-coverage
```

Expected: All tests PASS

- [ ] **Step 6: Run ESLint on modified files**

```bash
npx eslint src/lib/qbo/sync.ts src/__tests__/lib/qbo/sync.test.ts
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/qbo/sync.ts src/__tests__/lib/qbo/sync.test.ts
git commit -m "feat: auto-create catch-all project during QBO sync"
```

---

### Task 3: Protect PATCH and DELETE for catch_all projects

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts`
- Create: `src/__tests__/api/projects-id.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/projects-id.test.ts`:

```ts
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireWriteAccess: jest.fn(),
}))

import { PATCH, DELETE } from '@/app/api/projects/[id]/route'
import { prisma } from '@/lib/prisma'
import { requireWriteAccess } from '@/lib/auth'

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireWriteAccess as jest.Mock).mockResolvedValue(null)
})

describe('PATCH /api/projects/[id]', () => {
  it('returns 403 when project is catch_all', async () => {
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1', projectType: 'catch_all',
    })

    const req = new Request('http://localhost/api/projects/p1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Renamed' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('The default project cannot be modified or deleted.')
  })

  it('returns 404 when project does not exist', async () => {
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)

    const req = new Request('http://localhost/api/projects/missing', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('returns 403 when project is catch_all', async () => {
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1', projectType: 'catch_all',
    })

    const req = new Request('http://localhost/api/projects/p1', { method: 'DELETE' })

    const res = await DELETE(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('The default project cannot be modified or deleted.')
  })

  it('returns 404 when project does not exist', async () => {
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)

    const req = new Request('http://localhost/api/projects/missing', { method: 'DELETE' })

    const res = await DELETE(req, { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npx jest src/__tests__/api/projects-id.test.ts --no-coverage
```

Expected: FAIL — PATCH and DELETE do not yet check `projectType`

- [ ] **Step 3: Update the PATCH handler**

In `src/app/api/projects/[id]/route.ts`, replace the entire `PATCH` function with:

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error

  const { id } = await params

  const existing = await prisma.project.findUnique({ where: { id }, select: { projectType: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.projectType === 'catch_all') {
    return NextResponse.json({ error: 'The default project cannot be modified or deleted.' }, { status: 403 })
  }

  const body = await request.json() as { name?: string; description?: string; qboAccountId?: string | null }

  if (body.qboAccountId) {
    await prisma.project.updateMany({
      where: { qboAccountId: body.qboAccountId, NOT: { id } },
      data: { qboAccountId: null },
    })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.description !== undefined) data.description = body.description?.trim() || null
  if ('qboAccountId' in body) data.qboAccountId = body.qboAccountId ?? null

  const updated = await prisma.project.update({
    where: { id },
    data,
    select: { id: true, name: true, description: true, qboAccountId: true },
  })
  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Update the DELETE handler**

In `src/app/api/projects/[id]/route.ts`, replace the entire `DELETE` function with:

```ts
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireWriteAccess()
  if (roleCheck) return roleCheck.error

  const { id } = await params

  const existing = await prisma.project.findUnique({ where: { id }, select: { projectType: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.projectType === 'catch_all') {
    return NextResponse.json({ error: 'The default project cannot be modified or deleted.' }, { status: 403 })
  }

  try {
    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
npx jest src/__tests__/api/projects-id.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 6: Run ESLint on modified files**

```bash
npx eslint src/app/api/projects/[id]/route.ts src/__tests__/api/projects-id.test.ts
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/app/api/projects/[id]/route.ts src/__tests__/api/projects-id.test.ts
git commit -m "feat: protect catch-all project from modification and deletion"
```

---

### Task 4: Sort catch_all project last in GET /api/projects

**Files:**
- Modify: `src/app/api/projects/route.ts`
- Create: `src/__tests__/api/projects.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/api/projects.test.ts`:

```ts
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn() },
  },
}))

import { GET } from '@/app/api/projects/route'
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.project.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/projects', () => {
  it('orders claimed projects before catch_all', async () => {
    await GET()

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, projectType: true, qboAccountId: true },
      orderBy: [{ projectType: 'desc' }, { createdAt: 'asc' }],
    })
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx jest src/__tests__/api/projects.test.ts --no-coverage
```

Expected: FAIL — current `orderBy` is `{ createdAt: 'asc' }` (single object, not the compound array)

- [ ] **Step 3: Update the GET handler**

In `src/app/api/projects/route.ts`, replace:

```ts
export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, projectType: true, qboAccountId: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ projects })
}
```

With:

```ts
export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, projectType: true, qboAccountId: true },
    orderBy: [{ projectType: 'desc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ projects })
}
```

`'claimed' > 'catch_all'` alphabetically (`l` > `a`), so `desc` puts `claimed` first and `catch_all` last.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx jest src/__tests__/api/projects.test.ts --no-coverage
```

Expected: PASS (1 test)

- [ ] **Step 5: Run ESLint on modified files**

```bash
npx eslint src/app/api/projects/route.ts src/__tests__/api/projects.test.ts
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/projects/route.ts src/__tests__/api/projects.test.ts
git commit -m "feat: sort catch-all project last in project list API"
```

---

### Task 5: Show catch-all project with "Default" badge in settings UI

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Add `Chip` to the MUI import block**

In `src/app/settings/page.tsx`, update the MUI import to include `Chip`:

```ts
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
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

- [ ] **Step 2: Update the project list to show all projects and badge the catch-all**

In `src/app/settings/page.tsx`, replace:

```tsx
{claimedProjects.length > 0 && (
  <Stack spacing={0.75} sx={{ mb: 2 }}>
    {claimedProjects.map((p) => (
      <Stack key={p.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'grey.400', flexShrink: 0 }} />
        {editingProjectId === p.id ? (
          <>
            <TextField
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProject(p.id); if (e.key === 'Escape') setEditingProjectId(null) }}
              size="small"
              autoFocus
              sx={{ flex: 1, maxWidth: 200 }}
            />
            <IconButton size="small" onClick={() => handleRenameProject(p.id)}><CheckIcon sx={{ fontSize: 16 }} /></IconButton>
            <IconButton size="small" onClick={() => setEditingProjectId(null)}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ flex: 1 }}>{p.name}</Typography>
            <Tooltip title="Rename">
              <IconButton size="small" onClick={() => { setEditingProjectId(p.id); setEditingName(p.name) }}>
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => handleDeleteProject(p.id, p.name)} sx={{ '&:hover': { color: 'error.main' } }}>
                <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>
    ))}
  </Stack>
)}
```

With:

```tsx
{projects.length > 0 && (
  <Stack spacing={0.75} sx={{ mb: 2 }}>
    {projects.map((p) => (
      <Stack key={p.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'grey.400', flexShrink: 0 }} />
        {p.projectType === 'catch_all' ? (
          <>
            <Typography variant="body2" sx={{ flex: 1 }}>{p.name}</Typography>
            <Chip label="Default" size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
          </>
        ) : editingProjectId === p.id ? (
          <>
            <TextField
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProject(p.id); if (e.key === 'Escape') setEditingProjectId(null) }}
              size="small"
              autoFocus
              sx={{ flex: 1, maxWidth: 200 }}
            />
            <IconButton size="small" onClick={() => handleRenameProject(p.id)}><CheckIcon sx={{ fontSize: 16 }} /></IconButton>
            <IconButton size="small" onClick={() => setEditingProjectId(null)}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ flex: 1 }}>{p.name}</Typography>
            <Tooltip title="Rename">
              <IconButton size="small" onClick={() => { setEditingProjectId(p.id); setEditingName(p.name) }}>
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => handleDeleteProject(p.id, p.name)} sx={{ '&:hover': { color: 'error.main' } }}>
                <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>
    ))}
  </Stack>
)}
```

Note: `claimedProjects` is still used in the Account Claims dropdown — do not change that section. The catch-all project should not appear as an option for account claims.

- [ ] **Step 3: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests PASS

- [ ] **Step 4: Run ESLint on the settings page**

```bash
npx eslint src/app/settings/page.tsx
```

Expected: No errors

- [ ] **Step 5: Manual verification**

Start the dev server (`npm run dev`) and navigate to `/settings`:
1. Run a QBO sync — confirm "All Other Expenses" appears in the project list
2. Confirm it appears at the bottom (after all user-created projects)
3. Confirm it shows a "Default" chip/badge
4. Confirm no rename/delete icons appear next to it
5. Confirm the Account Claims dropdown still shows only user-created (`claimed`) projects as options, not the catch-all

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: display catch-all project with Default badge in settings UI"
```
