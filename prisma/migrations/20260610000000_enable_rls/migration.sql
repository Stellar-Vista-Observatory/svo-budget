-- Enable Row-Level Security on every public table.
--
-- The application accesses the database exclusively through Prisma over a
-- direct Postgres connection (DATABASE_URL / DIRECT_URL as the `postgres`
-- role), which bypasses RLS. Enabling RLS therefore does not affect app
-- behaviour; it closes off the auto-generated Supabase Data API (PostgREST),
-- which would otherwise let the public `anon` / `authenticated` roles read and
-- write these tables. With RLS enabled and no policies defined, those roles
-- are denied all access.

ALTER TABLE "projects"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "funding_sources"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_entries"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "funding_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "actuals"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qbo_connections"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_preferences"    ENABLE ROW LEVEL SECURITY;
