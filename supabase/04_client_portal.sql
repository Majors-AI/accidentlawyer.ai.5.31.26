-- ============================================================================
-- 04_client_portal.sql — client portal mid-section schema additions
-- Run AFTER 03_billing_docs.sql.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---- Journal entries: add pain_level column ---------------------------------
alter table journal_entries
  add column if not exists pain_level int2 check (pain_level between 0 and 10);

-- ---- Clients: add wage-rate columns -----------------------------------------
-- hourly_rate and salary_annual are mutually exclusive; app stores whichever the
-- client declares. Derived hourly = salary_annual / 2080 when only salary is set.
alter table clients add column if not exists hourly_rate   numeric;
alter table clients add column if not exists salary_annual numeric;

-- ---- RLS: client INSERT on journal_entries ----------------------------------
-- Clients can already SELECT their own journal entries (policy "journal_entries
-- client read" was created in the schema.sql bulk loop and has never been dropped).
-- What was missing: clients could not INSERT their own entries.
-- Scoped identically to the existing SELECT policy.
drop policy if exists "journal_entries client insert" on journal_entries;
create policy "journal_entries client insert" on journal_entries
  for insert
  with check (
    case_id in (
      select c.id from cases c
      join clients cl on cl.id = c.client_id
      where cl.profile_id = auth.uid()
    )
  );

