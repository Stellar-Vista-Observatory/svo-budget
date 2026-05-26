# Catch-All Project — Design Spec

**Date:** 2026-05-26

## Problem

When a user creates a project and claims a QuickBooks account for it, expenses from unclaimed accounts have nowhere to go. The sync engine already supports a `catch_all` project type but only uses it if one happens to exist — there is no automatic creation. Users currently have to manually create a catch-all project, which is surprising and error-prone.

## Goal

Automatically create a catch-all project named "All Other Expenses" on the first QBO sync (if none exists), so unclaimed expenses are always captured without any manual setup.

---

## Design

### 1. Backend — Auto-creation

**Where:** `src/lib/qbo/sync.ts`, `syncCategories()`

**What:** Extract a `getOrCreateCatchAllProject()` helper that is called at the top of `syncCategories`. It does:

1. `prisma.project.findFirst({ where: { projectType: 'catch_all' } })`
2. If found, return it.
3. If not found, `prisma.project.create({ data: { name: 'All Other Expenses', projectType: 'catch_all' } })` and return it.

The returned value replaces the current `projects.find(p => p.projectType === 'catch_all')` lookup. The `if (catchAllProject)` guard around the unclaimed-account loop is removed — the catch-all is now guaranteed to exist.

**Self-healing:** If the catch-all project is somehow absent (e.g., direct DB deletion), the next sync recreates it automatically.

---

### 2. Backend — Protection

**Where:** `src/app/api/projects/[id]/route.ts`

Both the `PATCH` and `DELETE` handlers must check the project's `projectType` before proceeding:

```
if (project.projectType === 'catch_all') {
  return 403 { error: 'The default project cannot be modified or deleted.' }
}
```

The `PATCH` handler currently does not fetch the project before patching; it will need a `findUnique` preflight to read `projectType`.

---

### 3. API — Sort order

**Where:** `src/app/api/projects/route.ts`, `GET` handler

Change `orderBy` from `{ createdAt: 'asc' }` to order claimed projects first, catch-all last. Because `'catch_all'` < `'claimed'` alphabetically, a plain `asc` sort would put the catch-all first — the opposite of what we want. Instead, sort descending on `projectType` (putting `claimed` before `catch_all`), then `createdAt asc` as a tiebreaker:

```
orderBy: [
  { projectType: 'desc' },  // 'claimed' > 'catch_all' alphabetically, so desc puts claimed first
  { createdAt: 'asc' },
]
```

This ensures the catch-all always appears at the bottom of every list that consumes `GET /api/projects`.

---

### 4. UI — Visual distinction

**Where:** Settings page (`src/app/settings/page.tsx`) and any other project list components.

- Render a small "Default" badge next to the name when `projectType === 'catch_all'`.
- Hide (not just disable) the delete and rename controls for the catch-all project.
- No layout or structural changes — the catch-all appears in the same list as regular projects, just last and badged.

---

## Data model

No schema changes. `ProjectType` enum already has `claimed` and `catch_all`. The feature uses existing fields.

---

## Testing

| Unit | Test cases |
|------|-----------|
| `getOrCreateCatchAllProject()` | Creates when none exists; returns existing when one exists; idempotent on repeat calls |
| `syncCategories()` | Unclaimed accounts route to the auto-created catch-all; claimed accounts are unaffected |
| `PATCH /api/projects/[id]` | Returns 403 for a `catch_all` project |
| `DELETE /api/projects/[id]` | Returns 403 for a `catch_all` project |
| Settings UI | Catch-all renders with "Default" badge; delete/rename controls absent |

All tests follow project TDD conventions (failing test first).

---

## Out of scope

- Allowing the user to rename the catch-all project (protected).
- Multiple catch-all projects.
- Migrating existing unclaimed expenses retroactively (handled naturally on next sync).
