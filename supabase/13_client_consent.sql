-- ============================================================================
-- 13_client_consent.sql — Client Registration consent capture (stage 2).
-- Run AFTER 12_staff_training.sql. Idempotent; safe to re-run.
--
-- ⚠️  REVIEW + APPLY MANUALLY (Dom). NOT APPLIED BY THE APP. The stage-2 consent
--     step (src/pages/client/Setup.tsx) captures A–F acknowledgements through an
--     in-memory STUB (src/clientConsent/store.ts) until this is applied and a
--     follow-up wires real persistence. The app does NOT query this table yet.
--
-- One table: client_consents — APPEND-ONLY, one row per signed agreement_version
-- per client. Re-consent to a new version = a NEW row (history is preserved;
-- rows are never updated or deleted).
--
-- Helpers my_firm_id(), is_firm_user(), is_super_admin() already exist
-- (02_platform.sql).
-- ============================================================================

-- ---- Consent records (append-only) -----------------------------------------
create table if not exists client_consents (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  -- firm_id denormalized onto the row so firm-staff RLS is a direct check
  -- (no join), matching the other firm_id-bearing tables.
  firm_id           uuid not null references firms(id) on delete cascade,
  -- which A–F slot this row is for (see src/clientConsent/blocks.ts).
  agreement_kind    text not null,
  -- per-jurisdiction version of the verbatim text the client signed. The app
  -- sends a placeholder ('PLACEHOLDER-vX') until Dom's verbatim swap.
  agreement_version text not null,
  signer_name       text not null,
  signer_title      text,
  signed_at         timestamptz not null default now(),
  -- signer_ip is captured SERVER-SIDE (edge function / request context), never
  -- self-reported by the browser. Nullable; the app leaves it null this pass.
  signer_ip         text,
  jurisdiction      text,
  created_at        timestamptz not null default now()
);
create index if not exists client_consents_client_idx on client_consents(client_id);
create index if not exists client_consents_firm_idx   on client_consents(firm_id);

-- ---- RLS --------------------------------------------------------------------
alter table client_consents enable row level security;

-- (a) FIRM STAFF — existing tenant-isolation pattern (my_firm_id() +
--     is_firm_user()), but READ-ONLY: staff review a client's consents, they do
--     not sign on the client's behalf. Read-only also preserves append-only
--     (no staff UPDATE/DELETE path).
drop policy if exists "client_consents firm read" on client_consents;
create policy "client_consents firm read" on client_consents for select
  using (firm_id = my_firm_id() and is_firm_user());

-- (b) CLIENT-SELF — ⚠️ NEW RLS SHAPE FOR DOM'S REVIEW. Every prior firm-scoped
--     policy keys off my_firm_id() (a STAFF identity). A signing client is NOT
--     firm staff, so this maps the authenticated client to their own rows via
--     clients.profile_id = auth.uid(). A client may INSERT and READ only their
--     OWN consent rows — nothing else.
drop policy if exists "client_consents self insert" on client_consents;
create policy "client_consents self insert" on client_consents for insert
  with check (client_id in (select id from clients where profile_id = auth.uid()));

drop policy if exists "client_consents self read" on client_consents;
create policy "client_consents self read" on client_consents for select
  using (client_id in (select id from clients where profile_id = auth.uid()));

-- APPEND-ONLY BY DESIGN: there is intentionally NO update or delete policy on
-- client_consents for any role. Under RLS, unlisted commands are denied, so
-- rows can be inserted and read but never mutated or removed. Corrections are
-- made by inserting a new row (e.g. a new agreement_version).

-- ROLLBACK (if needed):
-- drop table if exists client_consents;
