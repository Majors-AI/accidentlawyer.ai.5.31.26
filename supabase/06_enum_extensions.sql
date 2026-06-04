-- ============================================================================
-- 06_enum_extensions.sql — enum additions for Phase 2a (coverage & liens)
-- Run BEFORE any migration that uses these new values. Postgres requires enum
-- additions to commit before the new values can be referenced in the same
-- transaction, so this file is standalone — nothing else belongs here.
-- Idempotent: safe to re-run.
-- ============================================================================

alter type policy_kind add value if not exists 'umbrella';
alter type lien_type   add value if not exists 'ahcccs';
alter type lien_type   add value if not exists 'provider';
