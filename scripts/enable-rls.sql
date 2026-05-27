-- Enable Row Level Security on all public tables.
-- Prisma accesses the DB directly (bypasses RLS), so this does not affect
-- app behaviour. It closes off accidental PostgREST exposure.

ALTER TABLE public.projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_sources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_allocations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actuals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_connections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            ENABLE ROW LEVEL SECURITY;
