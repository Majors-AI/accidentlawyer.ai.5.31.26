-- ============================================================================
-- 02_platform.sql — multi-tenant platform layer
-- Run AFTER schema.sql. Adds: super-admin tier, firm data isolation,
-- client registration/engagement, in-app messaging, integration config,
-- calendar events, Dropbox backup log, and firm metrics for the super admin.
-- ============================================================================

-- ---- Super-admin flag (boolean instead of enum change, to avoid txn issues) -
alter table profiles add column if not exists is_platform_admin boolean default false;

-- ---- Firm registration / consent / metrics opt-in / marketing --------------
alter table firms add column if not exists status text default 'active';
alter table firms add column if not exists data_security_agreed   boolean default false;
alter table firms add column if not exists clients_informed_agreed boolean default false;
alter table firms add column if not exists allow_platform_metrics  boolean default false;
alter table firms add column if not exists marketing_source text;
alter table firms add column if not exists created_at timestamptz default now();

-- ---- Client tenancy + registration/engagement ------------------------------
alter table clients add column if not exists firm_id uuid references firms(id);
alter table clients add column if not exists registered boolean default false;
alter table clients add column if not exists agreed_to_hire boolean default false;
alter table clients add column if not exists engagement_signed_at timestamptz;
update clients c set firm_id = (select k.firm_id from cases k where k.client_id = c.id limit 1)
  where firm_id is null;

-- ---- Marketing / lead source per case --------------------------------------
alter table cases add column if not exists lead_source text;

-- ---- Tenancy helpers (security definer = RLS-safe, no recursion) -----------
create or replace function my_firm_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select firm_id from profiles where id = auth.uid();
$$;
create or replace function is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false);
$$;

-- ---- Firms RLS: firm reads itself; super admin manages all -----------------
alter table firms enable row level security;
drop policy if exists "firm self read"   on firms;
drop policy if exists "firm self update" on firms;
drop policy if exists "firm super manage" on firms;
create policy "firm self read" on firms for select
  using (id = my_firm_id() or is_super_admin());
create policy "firm self update" on firms for update
  using (id = my_firm_id() and is_firm_user()) with check (id = my_firm_id());
create policy "firm super manage" on firms for all
  using (is_super_admin()) with check (is_super_admin());

-- ---- Re-scope CASES to the firm (was: any firm user saw everything) --------
drop policy if exists "cases visible"          on cases;
drop policy if exists "cases writable by firm" on cases;
create policy "cases read" on cases for select using (
  (is_firm_user() and firm_id = my_firm_id())
  or client_id in (select id from clients where profile_id = auth.uid())
);
create policy "cases write" on cases for all
  using (is_firm_user() and firm_id = my_firm_id())
  with check (is_firm_user() and firm_id = my_firm_id());
-- client self-insert at intake (firm assigned by the intake portal)
drop policy if exists "client creates own case" on cases;
create policy "client creates own case" on cases for insert
  with check (client_id in (select id from clients where profile_id = auth.uid()));

-- ---- Re-scope CLIENTS to the firm (super admin does NOT see client PII) -----
drop policy if exists "clients visible"        on clients;
drop policy if exists "clients writable by firm" on clients;
create policy "clients read" on clients for select using (
  (is_firm_user() and firm_id = my_firm_id()) or profile_id = auth.uid()
);
create policy "clients write firm" on clients for all
  using (is_firm_user() and firm_id = my_firm_id())
  with check (is_firm_user() and firm_id = my_firm_id());
drop policy if exists "client self update" on clients;
create policy "client self update" on clients for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
-- (the "client creates own client row" insert policy from schema.sql stays)

-- ---- Re-scope the per-case lifecycle tables to the firm --------------------
do $$ declare t text; begin
  foreach t in array array[
    'parties','insurance_policies','conflicts_checks','treatments','journal_entries',
    'documents','communications','follow_ups','demands','settlements','reductions',
    'liens','trust_ledger','disbursements','litigation','pleadings','mediations',
    'tasks','deadlines'
  ] loop
    execute format('drop policy if exists "%1$s firm access" on %1$I;', t);
    execute format($f$create policy "%1$s firm access" on %1$I for all
      using (case_id in (select id from cases where firm_id = my_firm_id()) and is_firm_user())
      with check (case_id in (select id from cases where firm_id = my_firm_id()) and is_firm_user());$f$, t);
  end loop;
end $$;

-- ---- In-app messaging ------------------------------------------------------
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid references cases(id) on delete cascade,
  sender_id   uuid references profiles(id),
  sender_role text,
  body        text not null,
  created_at  timestamptz default now(),
  read_at     timestamptz
);
alter table messages enable row level security;
drop policy if exists "messages firm"        on messages;
drop policy if exists "messages client read" on messages;
drop policy if exists "messages client send" on messages;
create policy "messages firm" on messages for all
  using (is_firm_user() and case_id in (select id from cases where firm_id = my_firm_id()))
  with check (is_firm_user() and case_id in (select id from cases where firm_id = my_firm_id()));
create policy "messages client read" on messages for select
  using (case_id in (select c.id from cases c join clients cl on cl.id=c.client_id where cl.profile_id=auth.uid()));
create policy "messages client send" on messages for insert
  with check (sender_id = auth.uid()
    and case_id in (select c.id from cases c join clients cl on cl.id=c.client_id where cl.profile_id=auth.uid()));

-- ---- Integration config (NON-secret only; secrets live in edge-fn env) -----
create table if not exists integrations (
  id        uuid primary key default gen_random_uuid(),
  firm_id   uuid references firms(id) on delete cascade,
  provider  text not null,            -- twilio | sendgrid | google | dropbox
  connected boolean default false,
  config    jsonb default '{}',
  updated_at timestamptz default now(),
  unique (firm_id, provider)
);
alter table integrations enable row level security;
drop policy if exists "integrations firm" on integrations;
create policy "integrations firm" on integrations for all
  using (firm_id = my_firm_id() and is_firm_user())
  with check (firm_id = my_firm_id() and is_firm_user());

-- ---- Calendar events (Google Calendar / Meet mirror) -----------------------
create table if not exists calendar_events (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid references firms(id) on delete cascade,
  case_id       uuid references cases(id) on delete set null,
  title         text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  google_event_id text,
  meet_link     text,
  synced        boolean default false,
  created_at    timestamptz default now()
);
alter table calendar_events enable row level security;
drop policy if exists "cal firm" on calendar_events;
create policy "cal firm" on calendar_events for all
  using (firm_id = my_firm_id() and is_firm_user())
  with check (firm_id = my_firm_id() and is_firm_user());

-- ---- Dropbox backup log (client files, client list, deadlines) -------------
create table if not exists backup_runs (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid references firms(id) on delete cascade,
  target     text default 'dropbox',
  scope      text,                     -- client_files | client_list | deadlines
  status     text default 'pending',
  file_count int default 0,
  ran_at     timestamptz default now()
);
alter table backup_runs enable row level security;
drop policy if exists "backup firm" on backup_runs;
create policy "backup firm" on backup_runs for all
  using (firm_id = my_firm_id() and is_firm_user())
  with check (firm_id = my_firm_id() and is_firm_user());

-- ---- Super-admin metrics (aggregates only; no client PII leaves the firm) --
-- Only firms that opted in (allow_platform_metrics) appear, and only a super
-- admin can read it. Raw client/case rows remain isolated by the policies above.
create or replace function platform_metrics()
returns table(firm_id uuid, firm_name text, caseload bigint, open_cases bigint,
              total_settled numeric, avg_settled numeric, marketing_source text)
language sql stable security definer set search_path = public as $$
  select f.id, f.name,
    count(k.id) as caseload,
    count(k.id) filter (where k.status not in ('closed','denied')) as open_cases,
    coalesce(sum(s.offer_amount) filter (where s.status='funded'), 0) as total_settled,
    coalesce(round(avg(s.offer_amount) filter (where s.status='funded'), 0), 0) as avg_settled,
    f.marketing_source
  from firms f
  left join cases k on k.firm_id = f.id
  left join settlements s on s.case_id = k.id
  where f.allow_platform_metrics = true and is_super_admin()
  group by f.id, f.name, f.marketing_source;
$$;
