// SEAM — change audit trail for the Law Firm Settings portal. Mirrors the
// commsSender.ts seam style: in-memory + console now, real persistence swaps in
// without changing call sites. Every settings mutation should call logChange so
// the trail is complete the moment persistence is wired.
// TODO(persist to an audit_log table) — insert one row per change, scoped by
// firm_id, via a server-side path so the writer can't be spoofed client-side.

export interface ChangeEntry {
  actor: string;              // who made the change (profile id or name)
  action: string;             // e.g. 'update', 'create', 'delete'
  target: string;             // what changed, e.g. 'whiteLabel.deptScheme:intake'
  before: unknown;            // prior value (for reversibility / diffing)
  after: unknown;             // new value
  at: string;                 // ISO timestamp, stamped here
}

const log: ChangeEntry[] = [];

export function logChange(entry: Omit<ChangeEntry, 'at'>): ChangeEntry {
  const full: ChangeEntry = { ...entry, at: new Date().toISOString() };
  log.push(full);
  // ---- SEAM: when wired, persist instead of (or in addition to) console, e.g.
  // await supabase.from('audit_log').insert({ ...full, firm_id });
  // eslint-disable-next-line no-console
  console.info('[audit]', full.action, full.target, 'by', full.actor, full);
  return full;
}

// Read-only view of the in-memory trail (newest last). For later UI / debugging.
export function getAuditLog(): ReadonlyArray<ChangeEntry> {
  return log;
}
