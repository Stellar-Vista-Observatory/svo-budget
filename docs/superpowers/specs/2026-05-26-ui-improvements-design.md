# UI Improvements — Design Spec
**Date:** 2026-05-26
**Status:** Approved

---

## 1. Shared Decisions

### Color Palette (grant / funding source colors)
Green (`#16a34a`) and red (`#ef4444`) are reserved exclusively for good/bad status signals (remaining budget, overspent, funding gap). The `COLOR_PALETTE` constant in two files is updated:

- `src/lib/qbo/sync.ts:197`
- `src/app/api/projects/[id]/funding-sources/route.ts:5`

```
Before: ['#3b82f6', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
After:  ['#3b82f6', '#06b6d4', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
```

Position 1: green → cyan (`#06b6d4`)
Position 3: red → indigo (`#6366f1`)

Existing funding sources keep their stored color in the DB — no migration needed. Only newly created funding sources get the new palette.

### Header Styling
All report tables and the project detail table should use a dark navy header (`bgcolor: #1e3a5f`, white text) to visually distinguish column headers from category summary rows.

### Line Item Grouping (both reports)
When line items are shown, they are grouped under two sub-headers per category:
- `BUDGETED` — budget entry line items
- `ACTUALS · QBO Read only` — actual transactions (date + vendor/memo + amount)

This pattern already exists in `LineItemsTable.tsx` and is extended to both reports.

---

## 2. Budget vs Actual Report (`src/app/reports/budget-vs-actual/page.tsx`)

### Label renames
| Before | After |
|--------|-------|
| `Category / Line Item` | `Expense` |
| `Estimated` | `Budgeted` |
| `Spent` | `Actuals` |

### Header styling
Change `TableHead` row from `bgcolor: grey.100` to `bgcolor: #1e3a5f` with white text on all cells.

### Show Detail toggle
Add a `Switch` + `FormControlLabel` ("Show detail") in the controls row. Default: OFF.

When ON:
- Each category row expands to show:
  1. BUDGETED sub-header row
  2. Budget entry rows (indented, name + estimated amount)
  3. ACTUALS sub-header row (with QBO lock icon)
  4. Actual transaction rows (indented, date + vendor/memo + amount)
- Actuals columns show `—` for budget entries; budget columns show `—` for actuals

When OFF: only category summary rows and the TOTAL row are visible.

The `CategoryReport` interface's `actuals` field must be enriched from `{ amount: number }[]` to `{ id: string; date: string; vendor: string | null; memo: string | null; amount: number }[]`. The project API endpoint already returns this data.

### Stacked bar chart (Recharts)
Install `recharts`. Above the table `Paper`, render a `Paper variant="outlined"` containing a Recharts `ResponsiveContainer` (height: 200) with a horizontal `BarChart`.

- One data entry per category (x-axis: category name, truncated to ~15 chars)
- Two stacked bars: "Actuals" and "Remaining"
  - If remaining ≥ 0: Actuals = `#3b82f6`, Remaining = `#e2e8f0`
  - If remaining < 0 (overspent): Actuals = `#dc2626`, Remaining = `0` (clamped; the overage is communicated by the red actuals bar overflowing)
- `Tooltip` showing exact amounts
- `Legend` at bottom

---

## 3. Funding Source Report (`src/app/reports/funding-source/page.tsx`)

### Label renames
| Before | After |
|--------|-------|
| `Category / Line Item` | `Expense` |
| `Allocated` (column header and summary strip) | `Budgeted` |

### Add % Spent column
New column after Actuals: `% Spent` = `actuals / budgeted * 100`, formatted as `N%`. Shows `—` when budgeted = 0.

### Add actual line items
`CategoryRow` interface gains: `actuals: { date: string; vendor: string | null; memo: string | null; amount: number }[]`

Data assembly in the page component already filters `cat.actuals` by `fundingSourceId` for the category `spent` total — extend this to also collect the individual actual records into `actuals`.

Line items render with BUDGETED / ACTUALS sub-headers (same pattern as Budget vs Actual report). Actuals are always shown (no toggle — the funding source report is detail-oriented by nature).

### Header styling
Same dark navy header as other tables.

---

## 4. Project Detail (`src/components/project/LineItemsTable.tsx`)

### Overspent indicator on category rows
When `totalBudget - totalSpent < 0` for a category:
- Row `bgcolor`: `#fef2f2`
- Row `borderLeft`: `3px solid #dc2626`
- Remaining cell: render an MUI `Chip` with label `Overspent ${fmt(Math.abs(remaining))}`, `bgcolor: #dc2626`, `color: white`, size small

When `totalBudget - totalSpent >= 0`:
- Normal row styling
- Remaining cell: show `${fmt(remaining)}` in default text color (no green — green is reserved for status)

A new "Remaining" column must be added to the category-level display. Currently the table does not show budget minus actuals at the category row level.

### "General" → "Uncategorized"
In `src/lib/qbo/sync.ts` lines 143–148, change the string `'General'` to `'Uncategorized'` in both the `update` and `create` branches of the upsert. The next QBO sync will rename existing "General" categories automatically.

---

## 5. Out of Scope
- Retroactively updating existing funding source colors stored in the DB
- Any changes to the dashboard page
- Any changes to the settings page (other than what's triggered by sync behavior)

---

## 6. Implementation Order

These areas are largely independent and can be worked in parallel or in any order:

1. Color palette update (touches 2 files, no tests needed beyond existing coverage)
2. "General" → "Uncategorized" rename (touches `sync.ts`, needs test update)
3. Project detail overspent indicator (touches `LineItemsTable.tsx`)
4. Budget vs Actual report changes (label renames, toggle, header, chart)
5. Funding Source report changes (label renames, actuals, % Spent, header)
