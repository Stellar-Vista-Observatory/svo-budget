# Design: "Show Actuals as Negative" User Preference

**Date:** 2026-05-27
**Status:** Approved

## Overview

Add a per-user toggle that controls whether actuals (expenses imported from QuickBooks Online) are displayed as negative numbers in red, or as positive numbers in the default text color. The default is negative (on). The setting persists in the database and is scoped to each authenticated user.

---

## 1. Data Layer

### New Prisma model

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

- `userId` maps to the Supabase auth user ID (same as `UserRole.userId`).
- Default is `true` — actuals shown as negative out of the box.
- A row is created via upsert on the first `GET /api/me/preferences` call, so no explicit signup step is needed.

### Migration

Generate with `npx prisma migrate dev --name add-user-preferences`.

---

## 2. API

### `GET /api/me/preferences`

- Requires auth (`requireAuth()`).
- Reads the `UserPreference` row for the current user. If none exists, upserts one with defaults and returns it.
- Response: `{ showActualsAsNegative: boolean }`

### `PATCH /api/me/preferences`

- Requires auth.
- Body: `{ showActualsAsNegative: boolean }`
- Upserts the row (create or update).
- Response: `{ showActualsAsNegative: boolean }`

---

## 3. State Management

### `UserPreferencesProvider` (new file: `src/lib/UserPreferencesProvider.tsx`)

A React context that:
- Fetches `GET /api/me/preferences` once on mount.
- Exposes `showActualsAsNegative: boolean` and `setShowActualsAsNegative(value: boolean): Promise<void>`.
- `setShowActualsAsNegative` updates local state optimistically and fires `PATCH /api/me/preferences` in the background.
- Mirrors the existing `ToastProvider` pattern.

### Hook

```ts
export function useUserPreferences(): UserPreferencesContextValue
```

### Root layout integration

`UserPreferencesProvider` wraps the app in `src/app/layout.tsx`, inside `ToastProvider` (auth is required for the app anyway, so the fetch will always have a session).

---

## 4. Display Logic

### `applyActualSign` helper (new file: `src/lib/formatting.ts`)

```ts
export function applyActualSign(amount: number, showAsNegative: boolean): number {
  return showAsNegative ? -Math.abs(amount) : Math.abs(amount)
}
```

Raw `amount` values in the DB stay positive. Only the display sign flips. Derived calculations (e.g., `remaining = budget − spent`) always use the raw positive amounts internally — `applyActualSign` is called only at the final render step, never on values fed into arithmetic.

### Color rule

When `showActualsAsNegative` is `true`, all rendered actual amounts use `color: 'error.main'` (MUI red — already used for overspent amounts in the app). When `false`, they render in the default text color.

### Affected call sites (5 places)

All five locations call `applyActualSign(amount, showActualsAsNegative)` before passing the value to `fmt()`, and conditionally apply `color: 'error.main'`:

1. **`src/components/project/LineItemsTable.tsx` — `ActualsSection`**
   - Individual actual row amounts (line ~517, ~525)
   - Funding-source subtotals (line ~491)
   - Section total (line ~496)

2. **`src/components/project/LineItemsTable.tsx` — `CategorySection`**
   - `totalSpent` used in the remaining/overspent chip and footer cell (lines ~655, ~729)

3. **`src/app/projects/[id]/page.tsx`**
   - "Actuals To Date" stat box (line ~187)
   - Remaining calculation display (line ~190–191)

4. **`src/app/reports/budget-vs-actual/page.tsx`**
   - Individual actual row amounts (line ~290)
   - `totalSpent` summary cells (lines ~182, ~234, ~306)

5. **`src/app/reports/funding-source/page.tsx`**
   - Individual actual row amounts (line ~304)
   - `totalSpent` summary cells (lines ~220, ~250, ~316)
   - Remaining calculation display (line ~252, ~318)

---

## 5. Settings UI

Add a **"Display Preferences"** section to `src/app/settings/page.tsx`.

### Toggle

- MUI `FormControlLabel` with a `Switch`
- Label: **"Show actuals as negative numbers"**
- Helper text: "When enabled, expenses imported from QuickBooks are displayed as negative values (e.g., –$29,000) in red."
- Reads from and writes to `useUserPreferences()`.
- No page reload needed — context update triggers a re-render everywhere.

---

## 6. Testing

All tests written before production code (TDD per CLAUDE.md).

### Unit tests

- `applyActualSign`: positive/negative/zero inputs, both flag values.

### Integration tests (Jest + test DB)

- `GET /api/me/preferences`: returns defaults on first call and creates a row; returns existing row on subsequent calls.
- `PATCH /api/me/preferences`: persists `showActualsAsNegative: false`; returns updated value.

---

## Out of Scope

- The raw `amount` values stored in the DB are not changed.
- The Recharts bar chart in the budget-vs-actual report does not flip to negative values — chart axes behave unexpectedly with negatives and the visual meaning is preserved as-is. Only tabular/text actuals are affected.
