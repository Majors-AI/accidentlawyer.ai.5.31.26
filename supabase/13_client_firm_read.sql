-- ============================================================================
-- 13_client_firm_read.sql — clients may READ (only) the firm representing them
-- Fixes: signed-in clients couldn't read their firm row ("firm self read"
-- checks profiles.firm_id, null for client profiles), so the Stage 2 fee
-- summary rendered "--". Applied to live 2026-06-12.
-- ============================================================================
drop policy if exists "client reads own firm" on firms;
create policy "client reads own firm" on firms for select
  using (id in (select firm_id from clients where profile_id = auth.uid()));
