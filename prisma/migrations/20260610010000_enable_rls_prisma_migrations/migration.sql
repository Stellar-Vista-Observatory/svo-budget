-- Enable Row-Level Security on Prisma's internal migration-tracking table.
--
-- `_prisma_migrations` lives in the public schema and is therefore exposed by
-- the Supabase Data API (PostgREST), so the security advisor flags it like any
-- other table. Prisma manages this table over the direct `postgres` connection,
-- which bypasses RLS, so enabling RLS here does not affect migrations; it only
-- hides the migration history from the public `anon` / `authenticated` roles.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
