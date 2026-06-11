-- ============================================================================
-- 12_staff_training.sql — Staff Training (stage 8) real schema.
-- Run AFTER 11_tenant_isolation.sql. Idempotent; safe to re-run.
--
-- ⚠️  NOT APPLIED BY THE APP. This file is for Dom to REVIEW and apply manually
--     in Supabase. The stage-8 UI runs on an in-memory scaffold until this is
--     applied and a follow-up wires real persistence (see
--     src/lawFirmSettings/staffTraining/store.ts swap seam). The app does NOT
--     query these tables yet.
--
-- Three tables: training modules (per firm), assignments (module → trainee),
-- and competency sign-offs (supervisor signs a completed assignment). RLS
-- mirrors the existing tenant-isolation pattern: firm-scoped via my_firm_id()
-- + is_firm_user(), exactly like the "firm_id = my_firm_id() and is_firm_user()"
-- policies on document_orders/templates in 02_platform.sql. Helpers
-- my_firm_id(), is_firm_user(), is_super_admin() already exist (02_platform.sql).
-- ============================================================================

-- ---- Training modules (firm-owned catalog) ---------------------------------
create table if not exists training_modules (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  title       text not null,
  description text,
  -- who the module targets. 'all' = every staff role. Kept as text (not a new
  -- enum) to stay flexible + avoid an enum migration; app validates the value.
  target_role text not null default 'all',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists training_modules_firm_idx on training_modules(firm_id);

-- ---- Assignments (one module → one trainee) --------------------------------
-- assignee_id → profiles(id): the REAL staff member (the scaffold used an
-- in-memory Employee.id in its place). firm_id is denormalized onto the row so
-- RLS is a direct firm check (no join), matching the firm_id-bearing tables.
create table if not exists training_assignments (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references firms(id) on delete cascade,
  module_id    uuid not null references training_modules(id) on delete cascade,
  assignee_id  uuid not null references profiles(id) on delete cascade,
  status       text not null default 'assigned',  -- assigned | in_progress | completed
  assigned_at  timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz,
  -- a trainee gets a given module once
  unique (module_id, assignee_id)
);
create index if not exists training_assignments_firm_idx     on training_assignments(firm_id);
create index if not exists training_assignments_assignee_idx on training_assignments(assignee_id);

-- ---- Competency sign-offs (supervisor signs a completed assignment) --------
-- Split into its own table (the scaffold folded it onto the assignment). One
-- sign-off per assignment; supervisor_id → profiles(id).
create table if not exists training_signoffs (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  assignment_id uuid not null unique references training_assignments(id) on delete cascade,
  supervisor_id uuid not null references profiles(id) on delete cascade,
  note          text,
  signed_at     timestamptz not null default now()
);
create index if not exists training_signoffs_firm_idx on training_signoffs(firm_id);

-- ---- RLS: firm-scoped, mirroring the tenant-isolation pattern --------------
alter table training_modules     enable row level security;
alter table training_assignments enable row level security;
alter table training_signoffs    enable row level security;

drop policy if exists "training_modules firm" on training_modules;
create policy "training_modules firm" on training_modules for all
  using (firm_id = my_firm_id() and is_firm_user())
  with check (firm_id = my_firm_id() and is_firm_user());

drop policy if exists "training_assignments firm" on training_assignments;
create policy "training_assignments firm" on training_assignments for all
  using (firm_id = my_firm_id() and is_firm_user())
  with check (firm_id = my_firm_id() and is_firm_user());

drop policy if exists "training_signoffs firm" on training_signoffs;
create policy "training_signoffs firm" on training_signoffs for all
  using (firm_id = my_firm_id() and is_firm_user())
  with check (firm_id = my_firm_id() and is_firm_user());

-- ROLLBACK (if needed):
-- drop table if exists training_signoffs;
-- drop table if exists training_assignments;
-- drop table if exists training_modules;
