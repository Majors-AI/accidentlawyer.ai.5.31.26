-- ============================================================================
-- 10_final_payments.sql — SOP Phase 11: final payments columns
-- Run AFTER 09_invite_onboarding.sql.
-- Idempotent: safe to re-run.  No new RLS — columns inherit table policies.
-- ============================================================================

alter table liens
  add column if not exists satisfied    boolean default false,
  add column if not exists satisfied_at date;

alter table treatments
  add column if not exists zero_balance_confirmed boolean default false;
