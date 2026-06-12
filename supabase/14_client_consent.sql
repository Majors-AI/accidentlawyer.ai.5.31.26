-- ============================================================================
-- 14_client_consent.sql — Client Registration consent capture (stage 2).
-- Run AFTER 13_client_firm_read.sql. Idempotent; safe to re-run.
--
-- ⚠️  REVIEW + APPLY MANUALLY (Dom). NOT APPLIED BY THE APP. Consent rows are
--     written by the `record-consent` edge function (supabase/functions/
--     record-consent), which must be DEPLOYED DELIBERATELY (held, like
--     invite-user was). Until both this migration is applied AND the function is
--     deployed, the stage-2 consent step cannot persist. The browser NEVER
--     inserts directly — see the RLS note below.
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
  -- All four fields below are STAMPED SERVER-SIDE by the record-consent edge
  -- function from the request context — never self-reported by the browser.
  signed_at         timestamptz not null default now(),
  signer_ip         text,        -- from x-forwarded-for at insert time
  user_agent        text,        -- from the User-Agent header at insert time
  -- consent_text = the exact rendered wording the client was shown and signed;
  -- consent_hash = sha256(consent_text), computed server-side. Together they let
  -- the firm prove WHAT was agreed to, tamper-evidently.
  consent_text      text,
  consent_hash      text,
  jurisdiction      text,
  created_at        timestamptz not null default now()
);
create index if not exists client_consents_client_idx on client_consents(client_id);
create index if not exists client_consents_firm_idx   on client_consents(firm_id);

-- ---- RLS --------------------------------------------------------------------
-- INSERT is performed ONLY by the record-consent edge function using the
-- service_role key, which BYPASSES RLS entirely. There is therefore NO insert
-- policy for any client or staff role — clients and staff are SELECT-only, and
-- nobody can UPDATE or DELETE. This keeps the table append-only AND keeps the
-- server the sole writer (so signed_at / signer_ip / user_agent / consent_hash
-- cannot be forged by a browser).
alter table client_consents enable row level security;

-- (a) CLIENT-SELF READ — ⚠️ NEW RLS SHAPE FOR DOM'S REVIEW. Every prior
--     firm-scoped policy keys off my_firm_id() (a STAFF identity). A client is
--     NOT firm staff, so this maps the authenticated client to their own rows
--     via clients.profile_id = auth.uid(). A client may READ only their OWN
--     consent rows — and nothing else (no insert/update/delete).
drop policy if exists "client_consents self read" on client_consents;
create policy "client_consents self read" on client_consents for select
  using (client_id in (select id from clients where profile_id = auth.uid()));

-- (b) FIRM STAFF READ — existing tenant-isolation pattern (my_firm_id() +
--     is_firm_user()), READ-ONLY: staff review a client's consents, they never
--     sign on the client's behalf.
drop policy if exists "client_consents firm read" on client_consents;
create policy "client_consents firm read" on client_consents for select
  using (firm_id = my_firm_id() and is_firm_user());

-- Note: a prior draft of this file had a "client_consents self insert" policy.
-- It has been REMOVED — inserts are server-side (service_role) only.
drop policy if exists "client_consents self insert" on client_consents;

-- APPEND-ONLY BY DESIGN: there is intentionally NO update or delete policy on
-- client_consents for any role. Under RLS, unlisted commands are denied, so
-- rows can be read (per the SELECT policies above) and inserted (only by the
-- service_role edge function) but never mutated or removed. Corrections are
-- made by inserting a new row (e.g. a new agreement_version).

-- ROLLBACK (if needed):
-- drop table if exists client_consents;
