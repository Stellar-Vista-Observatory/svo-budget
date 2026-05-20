# SVO Budget

Project-based fund accounting for Stellar Vista Observatory. Tracks budgeted costs per project, matches them to funding sources (grants + internal funds), and compares against actual spending pulled from QuickBooks Online.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| UI | MUI v9 (Material UI) |
| Database | Supabase (hosted Postgres) |
| ORM | Prisma 7 |
| Auth | Supabase Auth (email + Google OAuth) |
| QBO Integration | QBO OAuth 2.0 + REST API (read-only) |
| Deployment | Vercel |

## Data Model

**Project** → **Category** (maps to QBO sub-accounts) → **BudgetEntry** (user-created line items) + **Actual** (QBO transactions, read-only)

**FundingSource** (maps to QBO classes, global — not tied to a project) → **FundingAllocation** (links a BudgetEntry to a FundingSource with a dollar amount)

Projects are either `claimed` (linked to a specific QBO account subtree) or `catch_all` (one system-wide project that captures all unclaimed accounts).

## Key Architecture Notes

- Auth is enforced in `src/proxy.ts` (Next.js 16's name for middleware). Unauthenticated API requests get 401; page routes redirect to `/login`.
- Role-based access: `admin` (full write access) or `viewer` (read-only). Enforced via `src/lib/auth.ts` helpers (`requireWriteAccess`, `requireAdmin`).
- QBO sync lives in `src/lib/qbo/sync.ts`. It upserts categories from QBO account sub-trees, upserts funding sources from QBO classes, and upserts actuals from Purchase + Bill transactions.
- All computed financial values (totals, gaps, remaining) are derived at query time — nothing is stored redundantly.
- MUI v9 has breaking changes: `fontWeight`, `display`, `flexWrap` must be in the `sx` prop, not component props.

## Running Locally

```bash
npm install
npm run dev
```

Requires a `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
DATABASE_URL=
DIRECT_URL=
QBO_CLIENT_ID=
QBO_CLIENT_SECRET=
QBO_REDIRECT_URI=
```

## Running Tests

```bash
npm test
```
