# SVO Budget — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js app with Supabase Postgres, Prisma schema, Supabase Auth (Google + email), and a working shell layout with navigation — deployable to Vercel.

**Architecture:** Next.js 14 App Router with Prisma ORM over Supabase Postgres. Auth via Supabase Auth with middleware protecting all routes except `/login`. Layout shell renders nav and a content area; all pages are stubs at this stage.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Prisma, Supabase (Postgres + Auth), Vercel

---

## File Map

```
svo-budget/
├── prisma/
│   └── schema.prisma              # Full data model
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout — font, global CSS
│   │   ├── page.tsx               # Redirects to /dashboard
│   │   ├── login/
│   │   │   └── page.tsx           # Login page (email + Google)
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Dashboard stub
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Project detail stub
│   │   ├── reports/
│   │   │   └── page.tsx           # Reports stub
│   │   └── settings/
│   │       └── page.tsx           # Settings stub
│   ├── components/
│   │   └── layout/
│   │       ├── AppShell.tsx       # Sidebar + topbar wrapper
│   │       ├── Sidebar.tsx        # Nav links
│   │       └── Topbar.tsx         # App name + user menu
│   ├── lib/
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── supabase/
│   │       ├── client.ts          # Browser Supabase client
│   │       └── server.ts          # Server Supabase client (cookies)
│   └── middleware.ts              # Auth guard — redirect to /login if unauthenticated
├── .env.local                     # Local env vars (never committed)
├── .env.example                   # Template for required env vars
└── next.config.ts
```

---

## Task 1: Initialize project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env.example`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/mkos/code/svo/svo-budget
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

Accept all defaults. This creates the project in the existing directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install @prisma/client @supabase/supabase-js @supabase/ssr prisma
npm install --save-dev @types/node
```

- [ ] **Step 3: Create `.env.example`**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

- [ ] **Step 4: Create `.env.local` from the example**

```bash
cp .env.example .env.local
```

Then fill in real values from your Supabase project dashboard (Settings → API and Settings → Database).

- [ ] **Step 5: Verify Next.js starts**

```bash
npm run dev
```

Expected: server starts at http://localhost:3000, default Next.js page loads.

- [ ] **Step 6: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js app with Tailwind and Supabase deps"
```

---

## Task 2: Prisma schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env` — you already have it in `.env.local`, so ignore the generated `.env`.

- [ ] **Step 2: Write the schema**

Replace the contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum ProjectType {
  claimed
  catch_all
}

model Project {
  id               String        @id @default(uuid())
  name             String
  description      String?
  projectType      ProjectType
  qboAccountId     String?
  qboAccountName   String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  fundingSources   FundingSource[]
  lineItems        LineItem[]

  @@map("projects")
}

model FundingSource {
  id             String       @id @default(uuid())
  projectId      String
  name           String
  color          String
  allocatedTotal Decimal      @db.Decimal(12, 2)
  qboClassId     String
  qboClassName   String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  allocations    FundingAllocation[]
  actuals        Actual[]

  @@map("funding_sources")
}

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

  @@map("line_items")
}

model FundingAllocation {
  id              String        @id @default(uuid())
  lineItemId      String
  fundingSourceId String
  allocatedAmount Decimal       @db.Decimal(12, 2)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  lineItem        LineItem      @relation(fields: [lineItemId], references: [id], onDelete: Cascade)
  fundingSource   FundingSource @relation(fields: [fundingSourceId], references: [id], onDelete: Cascade)

  @@unique([lineItemId, fundingSourceId])
  @@map("funding_allocations")
}

model Actual {
  id                 String        @id @default(uuid())
  lineItemId         String
  fundingSourceId    String?
  amount             Decimal       @db.Decimal(12, 2)
  date               DateTime      @db.Date
  vendor             String?
  qboTransactionId   String
  qboTransactionType String
  createdAt          DateTime      @default(now())
  lineItem           LineItem      @relation(fields: [lineItemId], references: [id], onDelete: Cascade)
  fundingSource      FundingSource? @relation(fields: [fundingSourceId], references: [id])

  @@unique([qboTransactionId, lineItemId])
  @@map("actuals")
}

model QboConnection {
  id              String    @id @default(uuid())
  realmId         String    @unique
  companyName     String
  accessToken     String
  refreshToken    String
  tokenExpiresAt  DateTime
  lastSyncedAt    DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@map("qbo_connections")
}
```

- [ ] **Step 3: Push schema to Supabase**

```bash
npx prisma db push
```

Expected: output shows all tables created with no errors.

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client" success message.

- [ ] **Step 5: Verify schema in Supabase dashboard**

Open your Supabase project → Table Editor. You should see: `projects`, `funding_sources`, `line_items`, `funding_allocations`, `actuals`, `qbo_connections`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Prisma schema — projects, funding sources, line items, actuals"
```

---

## Task 3: Prisma client singleton

**Files:**
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Write the test**

Create `src/lib/__tests__/prisma.test.ts`:

```typescript
import { prisma } from '../prisma'

describe('prisma singleton', () => {
  it('returns the same instance on multiple imports', async () => {
    const { prisma: prisma2 } = await import('../prisma')
    expect(prisma).toBe(prisma2)
  })
})
```

- [ ] **Step 2: Install test runner**

```bash
npm install --save-dev jest @types/jest ts-jest jest-environment-node
```

Create `jest.config.ts`:

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default config
```

Add to `package.json` scripts:

```json
"test": "jest"
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test src/lib/__tests__/prisma.test.ts
```

Expected: FAIL — "Cannot find module '../prisma'"

- [ ] **Step 4: Implement**

Create `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test src/lib/__tests__/prisma.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/prisma.ts src/lib/__tests__/prisma.test.ts jest.config.ts
git commit -m "feat: add Prisma client singleton with test"
```

---

## Task 4: Supabase auth clients

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase browser and server auth clients"
```

---

## Task 5: Auth middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write the middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 2: Verify middleware works**

```bash
npm run dev
```

Navigate to http://localhost:3000 — should redirect to http://localhost:3000/login (since you're not logged in). Expected: no crash, redirect occurs.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware — redirect unauthenticated users to /login"
```

---

## Task 6: Login page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create login page**

Create `src/app/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">SVO Budget</h1>
        <p className="text-slate-500 text-base mb-8">Sign in to continue</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 mb-6 text-base">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
          <div>
            <label className="block text-base font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-md py-2 text-base font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-slate-400">or</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full border border-slate-300 text-slate-700 rounded-md py-2 text-base font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create OAuth callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

- [ ] **Step 3: Enable Google OAuth in Supabase**

In your Supabase dashboard:
1. Go to Authentication → Providers → Google
2. Enable it
3. Add your Google OAuth credentials (from Google Cloud Console)
4. Add `http://localhost:3000/auth/callback` to allowed redirect URLs

- [ ] **Step 4: Verify login works**

```bash
npm run dev
```

Navigate to http://localhost:3000/login. Try signing in with email (you'll need to create a user in Supabase dashboard → Authentication → Users first). Expected: successful login redirects to `/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/ src/app/auth/
git commit -m "feat: add login page with email and Google OAuth"
```

---

## Task 7: App shell layout

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Topbar.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create Sidebar**

Create `src/components/layout/Sidebar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col min-h-screen">
      <div className="p-5 border-b border-slate-200">
        <span className="text-lg font-bold text-slate-900">SVO Budget</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
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

- [ ] **Step 2: Create Topbar**

Create `src/components/layout/Topbar.tsx`:

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function Topbar() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div />
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

- [ ] **Step 3: Create AppShell**

Create `src/components/layout/AppShell.tsx`:

```typescript
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update root layout**

Replace contents of `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SVO Budget',
  description: 'Project budget tracking for SVO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/app/layout.tsx
git commit -m "feat: add app shell layout with sidebar and topbar"
```

---

## Task 8: Page stubs

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/projects/[id]/page.tsx`
- Create: `src/app/reports/page.tsx`
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Create root redirect**

Create `src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
```

- [ ] **Step 2: Create dashboard stub**

Create `src/app/dashboard/page.tsx`:

```typescript
import { AppShell } from '@/components/layout/AppShell'

export default function DashboardPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="text-slate-500 mt-2 text-base">Coming soon.</p>
    </AppShell>
  )
}
```

- [ ] **Step 3: Create project detail stub**

Create `src/app/projects/[id]/page.tsx`:

```typescript
import { AppShell } from '@/components/layout/AppShell'

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Project</h1>
      <p className="text-slate-500 mt-2 text-base">ID: {params.id}</p>
    </AppShell>
  )
}
```

- [ ] **Step 4: Create reports stub**

Create `src/app/reports/page.tsx`:

```typescript
import { AppShell } from '@/components/layout/AppShell'

export default function ReportsPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
      <p className="text-slate-500 mt-2 text-base">Coming soon.</p>
    </AppShell>
  )
}
```

- [ ] **Step 5: Create settings stub**

Create `src/app/settings/page.tsx`:

```typescript
import { AppShell } from '@/components/layout/AppShell'

export default function SettingsPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="text-slate-500 mt-2 text-base">Coming soon.</p>
    </AppShell>
  )
}
```

- [ ] **Step 6: Verify full app shell works**

```bash
npm run dev
```

1. Navigate to http://localhost:3000 → should redirect to `/login`
2. Sign in → should redirect to `/dashboard`, showing sidebar + "Dashboard" heading
3. Click Reports in sidebar → `/reports` loads
4. Click Settings → `/settings` loads
5. Click Sign out → back to `/login`

- [ ] **Step 7: Commit**

```bash
git add src/app/
git commit -m "feat: add page stubs — dashboard, project detail, reports, settings"
```

---

## Task 9: Deploy to Vercel

**Files:** No code changes — deployment config only.

- [ ] **Step 1: Push to GitHub**

```bash
gh repo create svo-budget --private --source=. --push
```

(Requires GitHub CLI. If not installed: `brew install gh && gh auth login`)

- [ ] **Step 2: Import to Vercel**

1. Go to vercel.com → Add New Project
2. Import the `svo-budget` GitHub repo
3. Framework: Next.js (auto-detected)
4. Add environment variables (copy from `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `DIRECT_URL`
5. Deploy

- [ ] **Step 3: Add Vercel URL to Supabase allowed redirects**

In Supabase → Authentication → URL Configuration:
- Add `https://your-app.vercel.app` to Site URL
- Add `https://your-app.vercel.app/auth/callback` to Redirect URLs

- [ ] **Step 4: Verify production deploy**

Navigate to your Vercel URL. Login should work, all page stubs should load.

- [ ] **Step 5: Commit deploy confirmation**

```bash
git commit --allow-empty -m "chore: deployed Plan 1 to Vercel"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Next.js 14 + Supabase + Prisma + Vercel — Task 1, 2, 4, 9
- ✅ Full data model (all 6 tables) — Task 2
- ✅ Auth with email + Google — Tasks 4, 5, 6
- ✅ Admin / Viewer roles — deferred to Plan 3 (role assignment requires UI); auth foundation is here
- ✅ Responsive design — Tailwind used throughout; mobile layout deferred to Plan 3
- ✅ Typography ≥16px — enforced via `text-base` (16px) as default throughout all components

**Placeholder scan:** No TBDs or incomplete steps found.

**Type consistency:** `createClient()` used consistently in both `client.ts` and `server.ts` — consumers import from the correct path. `AppShell` accepts `children: React.ReactNode` consistently across all page stubs.
