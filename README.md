# Accident Lawyer AI — v1 foundation

A personal-injury case-management platform: clients submit intake, attorneys review/accept,
and the case moves through the lifecycle. Built on **Vite + React + TypeScript + Supabase**,
ready to run inside Bolt.

---

## Test logins (after seeding)

Password for all: **`TestPass123!`**

| Role     | Email                          | Lands on |
|----------|--------------------------------|----------|
| Super admin | super@accidentlawyer.ai     | Platform console: firms + metrics |
| Attorney | attorney@accidentlawyer.ai     | Caseload + Approval inbox + per-case messaging |
| Staff    | staff@accidentlawyer.ai        | Caseload + Approval inbox |
| Client   | client1@example.com            | Client dashboard — hits the engagement gate first, then messaging unlocks |
| Client   | client2@example.com            | Client dashboard (minor, case still under review) |

---

## Setup (≈10 minutes)

1. **Open in Bolt.** Import this project into your Bolt workspace.
2. **Connect Supabase.** In Bolt, click *Connect Supabase* (or create a project at supabase.com).
   Bolt wires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for you. If doing it by hand,
   copy `.env.example` to `.env` and fill both from Supabase → Project Settings → API.
3. **Create the database.** In Supabase → SQL Editor, paste all of `supabase/schema.sql` and Run.
   Then paste `supabase/02_platform.sql` and Run (multi-tenant platform layer).
   Then paste `supabase/03_billing_docs.sql` and Run (firm billing & access control,
   document orders, file-cabinet folders + Storage bucket, legacy import, approvals/signatures).
4. **Seed test data + logins.** From a terminal:
   ```bash
   npm install
   SUPABASE_URL=<your-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node supabase/seed.mjs
   ```
   (Service-role key is in the same API settings page — keep it secret; it’s only used locally.)
5. **Run.** `npm run dev`, open the app, sign in with a test login above.

---

## What works right now (the spine)

- **Real Supabase auth** — persistent logins, role-based routing (client vs firm).
- **Client intake** — submit accident details; creates a case and queues a conflicts review.
- **Conflicts check at intake** — name-collision + driver-at-fault rule; a `conflict` result
  **blocks** acceptance.
- **Attorney review** — accept/deny. On accept, an agent **drafts** the acceptance email +
  fee-agreement message and **queues it in the Approval inbox** — nothing sends without an
  attorney clicking *Approve & release*.
- **Case file** — stage tracker, overview, conflicts, liability & coverage (policies, limits,
  disputed-fault %), plus a **drop-recommendation signal** when liability/limits flags fire.
- **Client dashboard** — case timeline, “what to expect next,” the 24h/5d/2w/30d check-ins,
  and the personal-injury-vs-property-damage scope note.

## What’s scaffolded (tables live, UI next pass)

Treatment & follow-up automation, file cabinet + Storage uploads, journal, demand builder,
settlement/reductions/liens, trust accounting + disbursement projection, litigation + pleading
drafter, mediation, and reporting. **Every one of these already has its table in
`schema.sql`**, so deepening them adds UI only — no migration.

---

## Two important notes

- **Email/SMS aren’t wired to send yet.** “Approve & release” marks a message sent in the
  database. Hooking SendGrid/Twilio is a deliberate later step so we don’t send live mail from
  a test build.
- **The SOL citations in the seed are placeholders to verify.** Treat the jurisdiction/SOL
  table as a config you confirm against current AZ/WA law before relying on any date.
