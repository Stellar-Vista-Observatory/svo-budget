# SVO Budget — Design Spec
*2026-05-17*

## Overview

A web application for project-based fund accounting at SVO (a small nonprofit). The primary use case is tracking anticipated costs for capital projects (starting with an observatory construction project), matching those costs to funding sources (grants + internal funds), and comparing budgeted vs. actual spending using QuickBooks Online as the source of truth for actuals.

QuickBooks Online (QBO) is read-only from this app's perspective. All financial transactions live in QBO; this app adds budgeting, allocation, and reporting on top.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (hosted Postgres) |
| ORM | Prisma |
| Auth | Supabase Auth (email/password + Google) |
| QBO Integration | QBO OAuth 2.0 + REST API |
| Deployment | Vercel (free tier) |

Single repo, single deployment. No separate backend service.

**Estimated monthly cost: $0** — Vercel free tier, Supabase free tier (500MB DB, 50K users), QBO API access is free. Paid tiers only needed if DB grows very large or Vercel team features are required.

---

## Data Model

### Project
A budgeting container — one per initiative or operating bucket.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | string | e.g., "Phase I Construction", "General Operating" |
| description | string | optional |
| project_type | enum | claimed, catch_all |
| qbo_account_id | string | nullable — set for "claimed" projects only |
| qbo_account_name | string | display name, synced from QBO |

**project_type values:**
- `claimed` — linked to a QBO account; line items auto-populate from that account's subtree
- `catch_all` — exactly one allowed in the system; auto-captures all unclaimed QBO accounts

System enforces: only one `catch_all` project may exist. A project cannot be both claimed and catch_all.

### Funding Source
A grant or internal fund that provides money to a project. Maps to a QBO class.

**QBO classes are flat** — all funding sources exist at the top level in QBO with no parent classes. This allows a single funding source (e.g., "SVO Funds") to cover transactions across multiple projects. The project a transaction belongs to is determined by its QBO account, not its class.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| project_id | uuid | FK → Project |
| name | string | e.g., "Garkane Energy", "SVO Funds" |
| color | string | hex color for consistent visual identity across UI |
| allocated_total | decimal | total dollars committed to this project |
| qbo_class_id | string | QBO class ID — stable even if name changes |
| qbo_class_name | string | display name, synced from QBO |

### Budget Line Item
An anticipated cost within a project. For claimed projects, auto-populated from QBO sub-accounts. For the catch-all project, populated from all unclaimed accounts at any depth.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| project_id | uuid | FK → Project |
| name | string | e.g., "Foundation & concrete" |
| display_path | string | colon-separated full path, e.g., "Observatory Construction:Foundation & Concrete" |
| category | string | optional, e.g., "Civil", "Structural", "MEP" — editable |
| estimated_amount | decimal | total anticipated cost — editable, 0 by default for catch-all items |
| qbo_account_id | string | QBO account ID — stable even if name changes |
| qbo_account_name | string | display name, synced from QBO |

### Funding Allocation
How a line item's estimated cost is split across funding sources.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| line_item_id | uuid | FK → Budget Line Item |
| funding_source_id | uuid | FK → Funding Source |
| allocated_amount | decimal | dollars of this line item covered by this source |

Constraint: sum of allocations for a line item should equal the line item's estimated_amount (app warns when not 100%).

### Actual
A real expense synced from QBO. Read-only in this app.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| line_item_id | uuid | FK → Budget Line Item (matched via QBO account) |
| funding_source_id | uuid | FK → Funding Source (matched via QBO class) |
| amount | decimal | |
| date | date | transaction date from QBO |
| vendor | string | payee name from QBO |
| qbo_transaction_id | string | unique per line, used for deduplication on re-sync |
| qbo_transaction_type | string | bill, expense, check, etc. |

---

## QBO Account → Project Mapping

Projects are classified into two types:

**Claimed projects** — an admin selects a QBO account to "claim" for this project. All accounts in that account's subtree (at any depth) become line items automatically. QBO supports up to 5 levels of account nesting; we handle all levels recursively. The parent account itself also becomes a line item if transactions can be posted directly to it.

**Catch-all project ("Unallocated / General Operating")** — a single special project that automatically receives all QBO accounts not claimed by any other project. Admins can rename this project but cannot delete it. Line items in the catch-all project display their full colon-separated path (e.g., "Office Supplies:Paper") so context is clear without the account hierarchy.

**Account sync behavior:**
- New QBO account added under a claimed parent → automatically becomes a line item in that project on next sync
- New QBO account not under any claimed parent → automatically appears in catch-all project on next sync
- QBO account renamed → display name and display_path updated on next sync, no remapping needed (ID is stable)
- QBO account deleted → line item flagged "no longer active in QBO", historical actuals preserved, admin archives manually
- Admin claims a new project account → accounts move from catch-all to the new project on next sync (actuals re-matched)

---

## Key Computed Values

These are never stored — always calculated at query time:

| Value | Formula |
|---|---|
| Line item spent | SUM(actuals) where line_item_id matches |
| Line item remaining | estimated_amount − spent |
| Funding source spent | SUM(actuals) where funding_source_id matches |
| Funding source remaining | allocated_total − spent |
| Project estimated costs | SUM(line_item.estimated_amount) |
| Project secured funding | SUM(funding_source.allocated_total) |
| Project spent | SUM(actuals) for project |
| Project funding gap | estimated_costs − secured_funding (negative = surplus) |

---

## Pages & UI

### 0. Dashboard (home)
- Summary strip: Estimated Costs, Secured Funding, Spent to Date, Remaining (across all active projects)
- One card per active project showing:
  - Name, funding source count, line item count
  - Segmented progress bar: blue (spent) + green (secured unspent) + amber (funding gap)
  - Funding source chips with allocated amounts
  - Funding gap or surplus badge
- "All Active Projects" summary row at bottom with combined bar
- "↻ Sync QBO" button + last-synced timestamp in nav

### 1. Project Detail
- Breadcrumb navigation (Dashboard › Project Name)
- Project-level progress bar (same segmented design)
- Funding source cards (one per source):
  - Colored left border using source's identity color
  - Mini progress bar (spent vs. remaining)
  - Allocated / Spent / Remaining figures
- Budget line items table:
  - Columns: Line Item (editable name/category), Category (editable), Estimated (editable), Spent (QBO, read-only), Remaining (calculated, read-only), Funding Split (color bar)
  - For catch-all project: Line Item column shows full colon-separated path
  - Click row to expand inline — shows allocation rows per funding source
  - Expanded allocation row columns match parent table for alignment
  - Editable fields indicated with dashed blue underline + pencil icon (✎)
  - Editable in expanded view: allocated amount per funding source
  - Amber "X% allocated" badge on line items not yet 100% allocated
  - "+ Add source" button in expanded footer
  - "+ Add Line Item" button above table (manual items only — QBO-sourced items auto-populate)
- "+ Add Funding Source" button

### 2. Reports
Two report types, both exportable as PDF:

**Funding Source Report** (for grant reporting):
- Filter by project + funding source
- Shows all line items that draw from the selected source
- Columns: Line Item, Allocated to this source, Spent, Remaining
- PDF export includes organization name, date range, and report title

**Project Budget vs. Actual Report**:
- Filter by project
- Shows all line items with Estimated, Spent, Remaining, and % spent
- Summary section: Estimated Costs, Secured Funding, Funding Gap/Surplus, Total Spent
- PDF export includes organization name, project name, and as-of date

### 3. QBO Connection & Sync Settings
- "Connect to QuickBooks" button → OAuth 2.0 flow
- Connected company name + status
- "Sync Now" button + last-synced timestamp
- Project account claims: list of QBO top-level accounts; admin selects which project (if any) claims each one
- Warning when a mapped QBO class or account is no longer active in QBO

---

## QBO Integration

### Authentication

Standard OAuth 2.0. User clicks "Connect to QuickBooks", authorizes the app in QBO, tokens stored securely in database. Tokens refresh automatically.

### Class & Account Sync
On connect (and on demand): fetch full class list and chart of accounts from QBO. Store QBO IDs + names. IDs are stable — if a name changes in QBO, update the display name and recompute display_path, but all mappings remain intact.

### Transaction Sync ("Sync Now")
1. Fetch all transactions (bills, expenses, checks, journal entries) since last sync date
2. For each transaction line item:
   - Look up QBO account ID → Budget Line Item
   - Look up QBO class ID → Funding Source
   - If account matches a line item: upsert Actual using qbo_transaction_id for deduplication
   - If class doesn't match any funding source in the matched project: record actual with funding_source_id = null, flag for admin review
   - If account matches no line item: ignore (truly unrelated transaction)
3. Update last-synced timestamp
4. If sync fails: show error banner, preserve existing actuals, never wipe data

### Deleted/Renamed QBO Classes or Accounts
- Renamed: update display name + display_path on next sync, all mappings intact
- Deleted: flag with "no longer active in QBO" warning, preserve historical actuals, admin archives manually

---

## Typography & Accessibility

This app will be used by people who may have difficulty reading small text. All typography decisions prioritize legibility:

- **Base font size: 16px minimum** — never smaller for any body text or data values
- **Key financial figures: 18–20px** — amounts on dashboard cards and project summaries
- **Table data: 15px minimum** — slightly larger than web defaults
- **Labels and secondary text: 13px minimum** — captions, timestamps, chip text only
- **Line height: 1.5 minimum** — for all body text
- **Font weight: 500+ for numbers** — medium weight improves legibility of financial figures
- Sufficient color contrast on all text (WCAG AA minimum)
- Touch targets minimum 44×44px on mobile

---

## Color System

The UI uses two distinct color roles that must never be confused:

**Status colors** (used in progress bars and summary figures):
- Blue (#3b82f6) = spent
- Green (#16a34a) = secured unspent / remaining
- Amber (#f59e0b) = funding gap
- Green badge = surplus
- Red = cost overrun (actuals exceed estimate)

**Funding source identity colors** (assigned per source, consistent across cards and split bars):
- Each project's funding sources get distinct colors from a predefined palette
- Color is stored on the Funding Source record
- Used: colored left border on cards, segments in funding split bars, legend chips

---

## User Roles

| Role | Permissions |
|---|---|
| Admin | Full access: create/edit projects, line items, funding sources, run QBO sync, manage users, export PDFs |
| Viewer | Read-only: view all dashboards and reports, export PDFs |

User management: admin-only page to invite users by email and assign roles.

---

## Responsive Design

- Desktop: full layout as designed
- Mobile (≤375px): summary strip reflows to 2×2 grid; project cards simplified (funding chips hidden, tap to drill in); larger touch targets
- Tablet: intermediate — full summary strip, simplified cards

---

## Error Handling

- QBO sync failure: error banner, last-synced timestamp preserved, no data wiped
- Funding allocation < 100%: amber warning badge on line item, no hard block
- Funding allocation > 100%: red warning, user must correct before saving
- QBO class/account deleted: warning label on affected funding source or line item
- Actuals exceed line item estimate (cost overrun): Remaining shown as negative in red — informational only, not blocked
- Transaction with unrecognized class: actual recorded with null funding source, flagged for admin review
- Unauthenticated access: redirect to login

---

## Out of Scope (v1)

- Email notifications or alerts
- Budget approval workflows
- Multi-company QBO connections
- Export to Excel/CSV
- Mobile app (responsive web only)
