-- ============================================================================
-- 11_tenant_isolation.sql — close cross-tenant RLS gaps. Run AFTER 10_final_payments.sql.
-- Idempotent. profiles + templates were never re-scoped to the firm, so any
-- attorney/staff/admin at ANY firm could read across the tenant boundary.
-- ============================================================================

-- profiles: own + same-firm staff + same-firm clients + super admin
drop policy if exists "own profile readable" on profiles;
create policy "own profile readable" on profiles for select using (
  id = auth.uid()
  or is_super_admin()
  or (is_firm_user() and firm_id = my_firm_id())
  or (is_firm_user() and id in (select profile_id from clients where firm_id = my_firm_id()))
);

-- templates: scope to the firm (was: any firm user, any firm)
drop policy if exists "templates firm" on templates;
create policy "templates firm" on templates for all
  using (is_firm_user() and firm_id = my_firm_id())
  with check (is_firm_user() and firm_id = my_firm_id());

-- ROLLBACK (only if a regression shows up):
-- drop policy if exists "own profile readable" on profiles;
-- create policy "own profile readable" on profiles for select using (id = auth.uid() or is_firm_user());
-- drop policy if exists "templates firm" on templates;
-- create policy "templates firm" on templates for all using (is_firm_user()) with check (is_firm_user());
