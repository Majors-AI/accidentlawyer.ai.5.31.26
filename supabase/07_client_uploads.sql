-- ============================================================================
-- 07_client_uploads.sql -- client photo upload RLS
-- Run AFTER 06_enum_extensions.sql.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---- Storage: client INSERT on case-files bucket ----------------------------
-- Mirrors the existing "case-files client read" SELECT policy exactly, but for
-- INSERT. Clients may only write into their own case's folder
-- (path segment [2] = case_id).
drop policy if exists "case-files client insert" on storage.objects;
create policy "case-files client insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'case-files'
    and (storage.foldername(name))[2] in (
      select c.id::text from cases c
      join clients cl on cl.id = c.client_id
      where cl.profile_id = auth.uid()
    )
  );

-- ---- Documents: client INSERT -----------------------------------------------
-- Scoped identically to the parties/insurance_policies/journal_entries client-
-- insert policies. INSERT only -- no UPDATE or DELETE granted to clients.
drop policy if exists "documents client insert" on documents;
create policy "documents client insert" on documents
  for insert
  with check (
    case_id in (
      select c.id from cases c
      join clients cl on cl.id = c.client_id
      where cl.profile_id = auth.uid()
    )
  );
