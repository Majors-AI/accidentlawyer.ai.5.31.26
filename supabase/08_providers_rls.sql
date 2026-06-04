-- ============================================================================
-- 08_providers_rls.sql -- row-level security for the providers table
-- Run AFTER 07_client_uploads.sql.
-- Idempotent: safe to re-run.
--
-- providers is a global directory (no firm_id / case_id column), so the read
-- policy is open to any authenticated user -- clients need it for the
-- Treatment page join. Writes are restricted to firm users only; the
-- AccidentDoctor bridge and the treatment tab both run as firm sessions.
-- ============================================================================

alter table providers enable row level security;

-- Any authenticated user may read (clients need the name via the providers join)
drop policy if exists "providers read" on providers;
create policy "providers read" on providers
  for select to authenticated
  using (true);

-- Only firm users (attorney / staff / admin) may insert, update, or delete
drop policy if exists "providers write firm" on providers;
create policy "providers write firm" on providers
  for all to authenticated
  using (is_firm_user())
  with check (is_firm_user());
