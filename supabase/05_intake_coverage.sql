-- ============================================================================
-- 05_intake_coverage.sql — client INSERT RLS for intake coverage fields
-- Run AFTER 04_client_portal.sql.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---- RLS: client INSERT on parties ------------------------------------------
-- Intake.tsx always inserts a fresh case row on submit (never re-edits existing
-- rows), so UPDATE is not needed — INSERT only.
-- "parties client read" from the schema.sql bulk loop already grants SELECT.
drop policy if exists "parties client insert" on parties;
create policy "parties client insert" on parties
  for insert
  with check (
    case_id in (
      select c.id from cases c
      join clients cl on cl.id = c.client_id
      where cl.profile_id = auth.uid()
    )
  );

-- ---- RLS: client INSERT on insurance_policies --------------------------------
-- Same reasoning. "insurance_policies client read" from the bulk loop grants SELECT.
-- No UPDATE: intake is insert-only on these rows.
drop policy if exists "insurance_policies client insert" on insurance_policies;
create policy "insurance_policies client insert" on insurance_policies
  for insert
  with check (
    case_id in (
      select c.id from cases c
      join clients cl on cl.id = c.client_id
      where cl.profile_id = auth.uid()
    )
  );

-- ---- clients.health_insurer is already updateable ---------------------------
-- "client self update" (added in 02_platform.sql) covers UPDATE on the clients
-- row scoped to profile_id = auth.uid(). No new policy needed here.
