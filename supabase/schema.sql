-- ============================================================================
-- Accident Lawyer AI — full-platform schema (v1 foundation)
-- Run this in Supabase: SQL Editor → paste → Run.
-- Covers the entire lifecycle data model. Some modules are scaffolded at v1
-- depth in the app UI, but the tables exist now so nothing has to be migrated
-- later.
-- ============================================================================

-- ---- Enums -----------------------------------------------------------------
create type user_role        as enum ('client','attorney','staff','provider','admin');
create type case_status       as enum ('lead','under_review','info_requested','accepted','denied',
                                       'treating','demand','settlement','litigation','closed');
create type claim_type        as enum ('mva','slip_and_fall','negligence','dog_bite','wrongful_death','premises','other');
create type fee_phase         as enum ('pre_lit','litigation');
create type party_role        as enum ('client','adverse','witness','driver','passenger');
create type policy_kind       as enum ('adverse_liability','client_um_uim','health','pip_medpay');
create type comm_channel      as enum ('email','message','sms');
create type comm_status       as enum ('draft','queued','approved','sent','failed');
create type doc_category      as enum ('intake','medical','billing','police_report','correspondence',
                                       'pleading','agreement','exchange_info','other');
create type lien_type         as enum ('medicare','medicaid','erisa','hospital','pip_medpay','other');
create type task_status       as enum ('open','done','snoozed');
create type deadline_type     as enum ('sol','notice_of_claim','demand_reply','litigation_response','hearing','other');
create type conflict_result   as enum ('clear','needs_review','conflict');

-- ---- Reference: jurisdictions & SOL rules ----------------------------------
create table jurisdictions (
  code        text primary key,            -- 'AZ', 'WA'
  name        text not null,
  comparative_scheme text                  -- e.g. 'pure_comparative', 'modified_50'
);

create table sol_rules (
  id            uuid primary key default gen_random_uuid(),
  jurisdiction  text references jurisdictions(code),
  claim         claim_type not null,
  years         numeric not null,           -- statute length
  citation      text not null,              -- statutory cite
  notice_days   int,                         -- govt notice-of-claim window, null if n/a
  notes         text,
  unique (jurisdiction, claim)
);

-- ---- Firms & people --------------------------------------------------------
create table firms (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  default_jurisdiction text references jurisdictions(code) default 'AZ',
  fee_pre_lit numeric default 0.3333,
  fee_lit     numeric default 0.40
);

-- profiles mirror auth.users 1:1 (created by trigger below)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        user_role not null default 'client',
  firm_id     uuid references firms(id),
  phone       text,
  created_at  timestamptz default now()
);

create table clients (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete set null,
  full_name   text not null,
  email       text,
  phone       text,
  dob         date,
  is_minor    boolean default false,  -- set at intake / by staff (generated cols can't use now())
  address     text,
  health_insurer text,
  created_at  timestamptz default now()
);

create table providers (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  specialty text,
  city      text,
  state     text,
  phone     text,
  -- providers live on the sister portal; this flags portal linkage
  doctor_portal_linked boolean default false
);

-- ---- The case --------------------------------------------------------------
create table cases (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid references firms(id),
  client_id     uuid references clients(id),
  attorney_id   uuid references profiles(id),
  status        case_status not null default 'lead',
  claim         claim_type,
  jurisdiction  text references jurisdictions(code),
  date_of_loss  date,
  location      text,
  narrative     text,                       -- documented facts
  sol_date      date,
  sol_citation  text,
  fee_phase     fee_phase default 'pre_lit',
  fee_pct       numeric,
  amount_sought numeric,
  -- the "should we drop?" signal is computed in-app from the flags below
  liability_disputed   boolean default false,
  accepted_fault_pct   numeric,             -- % adverse accepts
  limits_issue         boolean default false,
  pd_track_only        boolean default false, -- property damage informational track
  doctor_portal_optin  boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table parties (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid references cases(id) on delete cascade,
  role      party_role not null,
  name      text,
  details   jsonb default '{}'
);

create table insurance_policies (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  kind        policy_kind not null,
  carrier     text,
  policy_number text,
  limits      numeric,
  verified    boolean default false,
  notes       text
);

create table conflicts_checks (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid references cases(id) on delete cascade,
  result    conflict_result not null default 'needs_review',
  details   jsonb default '{}',     -- matched names, driver-at-fault flag, etc.
  ran_at    timestamptz default now(),
  ran_by    uuid references profiles(id)
);

create table treatments (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  provider_id uuid references providers(id),
  status      text default 'recommended',  -- recommended|scheduled|ongoing|complete
  scheduled_at date,
  total_billed numeric default 0,
  records_received boolean default false,
  bills_received   boolean default false
);

create table journal_entries (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid references cases(id) on delete cascade,
  kind      text not null,        -- pain | lost_wages | treatment | note
  entry_date date default now(),
  content   text,
  amount    numeric               -- e.g. lost wages amount
);

create table documents (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  name        text not null,
  category    doc_category default 'other',
  storage_path text,
  uploaded_by uuid references profiles(id),
  created_at  timestamptz default now()
);

create table communications (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  channel     comm_channel not null default 'email',
  direction   text default 'outbound',
  subject     text,
  body        text,
  status      comm_status not null default 'draft',
  requires_approval boolean default true,    -- agent drafts; attorney releases
  drafted_by  text default 'agent',
  approved_by uuid references profiles(id),
  created_at  timestamptz default now(),
  sent_at     timestamptz
);

create table follow_ups (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid references cases(id) on delete cascade,
  label     text not null,        -- '24h confirm', '5 day', '2 week', '30 day'
  due_at    timestamptz,
  done      boolean default false
);

create table demands (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  status      text default 'draft',  -- draft|attorney_review|client_review|approved|sent
  amount      numeric,
  body        text,
  sol_noted   boolean default false,
  created_at  timestamptz default now()
);

create table settlements (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid references cases(id) on delete cascade,
  offer_amount  numeric,
  status        text default 'offered',  -- offered|approved|rejected|funded
  client_approved boolean default false,
  created_at    timestamptz default now()
);

create table reductions (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  provider_id uuid references providers(id),
  original    numeric,
  requested   numeric,
  agreed      numeric,
  status      text default 'pending',
  last_contact date
);

create table liens (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  type        lien_type not null,
  holder      text,
  amount      numeric,
  recorded    boolean default false,
  acknowledged boolean default false
);

create table trust_ledger (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  entry_type  text not null,        -- deposit|fee|medical|lien|disbursement
  amount      numeric not null,
  in_trust    boolean default true,
  memo        text,
  created_at  timestamptz default now()
);

create table disbursements (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid references cases(id) on delete cascade,
  settlement_amount numeric,
  fees            numeric,
  medical         numeric,
  liens_total     numeric,
  net_to_client   numeric,
  phase           fee_phase default 'pre_lit',
  client_approved boolean default false,
  created_at      timestamptz default now()
);

create table litigation (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid references cases(id) on delete cascade,
  filing_date   date,
  court         text,
  cause_number  text
);

create table pleadings (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid references cases(id) on delete cascade,
  type      text,
  status    text default 'draft',
  body      text
);

create table mediations (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid references cases(id) on delete cascade,
  scheduled date,
  offers    jsonb default '[]',
  resolution text,
  client_approved boolean default false
);

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  title       text not null,
  assignee    uuid references profiles(id),
  due_at      timestamptz,
  status      task_status default 'open',
  auto_generated boolean default false
);

create table deadlines (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid references cases(id) on delete cascade,
  type      deadline_type not null,
  due_at    date not null,
  label     text,
  satisfied boolean default false
);

create table templates (
  id        uuid primary key default gen_random_uuid(),
  firm_id   uuid references firms(id),
  type      text not null,           -- lor | demand | fee_agreement
  name      text,
  body      text                      -- merge fields like {{client_name}}, {{date_of_loss}}
);

-- ---- Auto-create a profile when an auth user signs up ----------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.email),
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'client'));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---- Row Level Security ----------------------------------------------------
-- Helper: is the current user firm staff (attorney/staff/admin)?
create or replace function is_firm_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles
                where id = auth.uid() and role in ('attorney','staff','admin'));
$$;

alter table profiles  enable row level security;
alter table cases     enable row level security;
alter table clients   enable row level security;

create policy "own profile readable" on profiles
  for select using (id = auth.uid() or is_firm_user());
create policy "own profile editable" on profiles
  for update using (id = auth.uid());

-- Firm users see all cases; clients see only cases tied to their client record.
create policy "cases visible" on cases for select using (
  is_firm_user()
  or client_id in (select id from clients where profile_id = auth.uid())
);
create policy "cases writable by firm" on cases for all using (is_firm_user()) with check (is_firm_user());

create policy "clients visible" on clients for select using (
  is_firm_user() or profile_id = auth.uid()
);
create policy "clients writable by firm" on clients for all using (is_firm_user()) with check (is_firm_user());

-- A client may create their own client record + case during intake.
create policy "client creates own client row" on clients for insert
  with check (profile_id = auth.uid());
create policy "client creates own case" on cases for insert
  with check (client_id in (select id from clients where profile_id = auth.uid()));

-- Every new case automatically gets a "needs_review" conflicts entry.
-- Runs as definer so it works regardless of who created the case (RLS-safe).
create or replace function seed_conflicts_check()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into conflicts_checks(case_id, result, details)
  values (new.id, 'needs_review', jsonb_build_object('source','case_created'));
  return new;
end; $$;
drop trigger if exists on_case_created on cases;
create trigger on_case_created after insert on cases
  for each row execute function seed_conflicts_check();

-- For the remaining lifecycle tables, gate by case visibility. (v1: firm-user
-- full access; client read on their own case is added per-table as we deepen.)
do $$
declare t text;
begin
  foreach t in array array[
    'parties','insurance_policies','conflicts_checks','treatments','journal_entries',
    'documents','communications','follow_ups','demands','settlements','reductions',
    'liens','trust_ledger','disbursements','litigation','pleadings','mediations',
    'tasks','deadlines'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$create policy "%1$s firm access" on %1$I for all
                     using (is_firm_user()) with check (is_firm_user());$f$, t);
    execute format($f$create policy "%1$s client read" on %1$I for select
                     using (case_id in (select c.id from cases c
                            join clients cl on cl.id = c.client_id
                            where cl.profile_id = auth.uid()));$f$, t);
  end loop;
end $$;

-- templates / reference readable by firm users
alter table templates enable row level security;
create policy "templates firm" on templates for all using (is_firm_user()) with check (is_firm_user());
