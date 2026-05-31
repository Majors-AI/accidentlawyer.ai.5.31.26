-- ============================================================================
-- 03_billing_docs.sql — firm billing, access control, documents & approvals
-- Run AFTER 02_platform.sql.
--
-- NOTE: the four "alter type ... add value" lines must commit before the new
-- values are used. If your SQL editor complains about using a new enum value
-- in the same transaction, run those four lines on their own first, then the
-- rest. (No statement in this file uses the new values, so normally it's fine.)
-- ============================================================================

alter type doc_category add value if not exists 'fee_agreement';
alter type doc_category add value if not exists 'accident_photos';
alter type doc_category add value if not exists 'subrogation';
alter type doc_category add value if not exists 'case_documents';

-- ---- Firm account / SaaS billing state -------------------------------------
alter table firms add column if not exists account_status text default 'active'; -- active|past_due|suspended|cancelled
alter table firms add column if not exists plan text default 'standard';
alter table firms add column if not exists billing_email text;
alter table firms add column if not exists cancel_notice_at timestamptz;          -- start of 30-day notice
alter table firms add column if not exists access_ends_at timestamptz;            -- when cancellation takes effect

-- ---- Two firm-id helpers: RAW (any status) vs ACTIVE-ONLY ------------------
-- RAW: used for billing/account pages so a suspended firm can still log in & pay.
create or replace function my_firm_id_raw() returns uuid
  language sql stable security definer set search_path = public as $$
  select firm_id from profiles where id = auth.uid();
$$;
-- ACTIVE-ONLY: returns the firm only while the account is active/past_due.
-- A suspended/cancelled firm gets NULL here, so every "firm_id = my_firm_id()"
-- policy stops matching → the firm loses access to case files. Pay to restore.
create or replace function my_firm_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select p.firm_id from profiles p join firms f on f.id = p.firm_id
  where p.id = auth.uid() and f.account_status in ('active','past_due');
$$;

-- firms self-read uses RAW so billing stays visible even when suspended
drop policy if exists "firm self read" on firms;
create policy "firm self read" on firms for select
  using (id = my_firm_id_raw() or is_super_admin());

-- ---- Invoices & line items (subscription + document orders + late fees) -----
create table if not exists invoices (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid references firms(id) on delete cascade,
  period_label text,
  amount      numeric default 0,
  late_fee    numeric default 0,
  status      text default 'open',     -- open | paid | overdue
  issued_at   timestamptz default now(),
  due_at      timestamptz default (now() + interval '30 days'),
  paid_at     timestamptz
);
create table if not exists invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid references invoices(id) on delete cascade,
  kind        text not null,           -- subscription | document_order | late_fee
  description text,
  amount      numeric default 0
);
create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid references firms(id) on delete cascade,
  invoice_id  uuid references invoices(id),
  amount      numeric,
  method      text default 'card',
  status      text default 'succeeded', -- wired to Stripe later
  created_at  timestamptz default now()
);

-- ---- Document orders (e.g., police reports) billed on next cycle -----------
create table if not exists document_orders (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid references firms(id) on delete cascade,
  case_id     uuid references cases(id) on delete set null,
  type        text not null,           -- police_report | medical_records | other
  vendor      text,
  cost        numeric default 0,
  status      text default 'ordered',  -- ordered | received | cancelled
  billed      boolean default false,
  ordered_at  timestamptz default now()
);

-- ---- Legacy import flag on clients -----------------------------------------
alter table clients add column if not exists legacy boolean default false;

-- ---- Approvals & e-signatures (gate case progress) -------------------------
-- A case cannot advance while a required approval is pending. Settlements and
-- releases require the client's signature, captured in-app (timestamp + name).
create table if not exists approvals (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid references cases(id) on delete cascade,
  kind          text not null,         -- case_acceptance | settlement | release | document
  title         text,
  requires_signature boolean default false,
  status        text default 'requested', -- requested | approved | signed | declined
  document_id   uuid references documents(id),
  requested_by  uuid references profiles(id),
  signature_name text,
  signed_at     timestamptz,
  created_at    timestamptz default now()
);

-- ---- RLS for the new tables ------------------------------------------------
alter table invoices        enable row level security;
alter table invoice_items   enable row level security;
alter table payments        enable row level security;
alter table document_orders enable row level security;
alter table approvals       enable row level security;

-- billing visible/payable even when suspended (RAW); super admin can read all
drop policy if exists "invoices firm" on invoices;
create policy "invoices firm" on invoices for all
  using (firm_id = my_firm_id_raw() or is_super_admin())
  with check (firm_id = my_firm_id_raw());
drop policy if exists "invoice_items firm" on invoice_items;
create policy "invoice_items firm" on invoice_items for all
  using (invoice_id in (select id from invoices where firm_id = my_firm_id_raw()) or is_super_admin())
  with check (invoice_id in (select id from invoices where firm_id = my_firm_id_raw()));
drop policy if exists "payments firm" on payments;
create policy "payments firm" on payments for all
  using (firm_id = my_firm_id_raw()) with check (firm_id = my_firm_id_raw());

-- document orders are "files/work" → active-only access
drop policy if exists "doc_orders firm" on document_orders;
create policy "doc_orders firm" on document_orders for all
  using (firm_id = my_firm_id() and is_firm_user())
  with check (firm_id = my_firm_id() and is_firm_user());

-- approvals: firm (active) manages; client reads & signs on their own case
drop policy if exists "approvals firm"        on approvals;
drop policy if exists "approvals client read" on approvals;
drop policy if exists "approvals client sign" on approvals;
create policy "approvals firm" on approvals for all
  using (is_firm_user() and case_id in (select id from cases where firm_id = my_firm_id()))
  with check (is_firm_user() and case_id in (select id from cases where firm_id = my_firm_id()));
create policy "approvals client read" on approvals for select
  using (case_id in (select c.id from cases c join clients cl on cl.id=c.client_id where cl.profile_id=auth.uid()));
create policy "approvals client sign" on approvals for update
  using (case_id in (select c.id from cases c join clients cl on cl.id=c.client_id where cl.profile_id=auth.uid()))
  with check (case_id in (select c.id from cases c join clients cl on cl.id=c.client_id where cl.profile_id=auth.uid()));

-- ---- Storage bucket for client files (private) -----------------------------
-- Path convention: {firm_id}/{case_id}/{category}/{filename}
insert into storage.buckets (id, name, public)
  values ('case-files','case-files', false)
  on conflict (id) do nothing;

-- Firm users access objects under their own firm's folder; clients access
-- their own case's folder. (Review in Supabase before production.)
drop policy if exists "case-files firm" on storage.objects;
create policy "case-files firm" on storage.objects for all to authenticated
  using (bucket_id='case-files' and (storage.foldername(name))[1] = my_firm_id()::text)
  with check (bucket_id='case-files' and (storage.foldername(name))[1] = my_firm_id()::text);
drop policy if exists "case-files client read" on storage.objects;
create policy "case-files client read" on storage.objects for select to authenticated
  using (bucket_id='case-files'
    and (storage.foldername(name))[2] in (
      select c.id::text from cases c join clients cl on cl.id=c.client_id where cl.profile_id=auth.uid()));

-- ---- Helper: does a case have a blocking (pending) approval? ----------------
create or replace function case_can_advance(p_case uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select not exists (select 1 from approvals
                     where case_id = p_case and status in ('requested') );
$$;
