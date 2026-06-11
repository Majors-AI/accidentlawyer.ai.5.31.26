// Staff Training — in-memory store + operations (SCAFFOLD).
//
// Same observable-store shape as sendQueue/queue.ts: a tiny store the UI
// subscribes to via useSyncExternalStore. Two snapshots (modules, assignments)
// share one listener set; each mutation swaps the affected array's identity so
// getSnapshot stays cached between mutations (required by useSyncExternalStore).
//
// No persistence. TODO(real: Supabase) — load modules/assignments/sign-offs
// from the 12_staff_training.sql tables (firm-scoped by RLS + my_firm_id()) and
// write each operation through. The function surface below is the swap seam:
// keep these signatures, change the bodies to await Supabase.

import type { CompetencySignoff, TrainingAssignment, TrainingModule, TrainingRole } from './types';
import { SEED_ASSIGNMENTS, SEED_MODULES } from './seed';

// Module-level state, seeded once on import (survives view navigation within a
// session). Arrays get a new identity only on mutation — never per read.
let modules: TrainingModule[] = [...SEED_MODULES];
let assignments: TrainingAssignment[] = [...SEED_ASSIGNMENTS];
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }
function bumpAssignments() { assignments = [...assignments]; notify(); }

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getModules(): TrainingModule[] { return modules; }
export function getAssignments(): TrainingAssignment[] { return assignments; }

// Monotonic local id (no Date.now()/random needed — a counter is enough and
// keeps ids stable/inspectable in the scaffold).
let seq = 0;
function newId(): string { seq += 1; return `asn-new-${seq}`; }

function hasAssignment(moduleId: string, assigneeId: string): boolean {
  return assignments.some((a) => a.moduleId === moduleId && a.assigneeId === assigneeId);
}

// Assign one module to one assignee (no-op if already assigned). Returns the
// new (or existing) assignment id.
export function assignModule(moduleId: string, assigneeId: string): string {
  const existing = assignments.find((a) => a.moduleId === moduleId && a.assigneeId === assigneeId);
  if (existing) return existing.id;
  const id = newId();
  assignments.push({ id, moduleId, assigneeId, status: 'assigned',
    assignedAt: new Date().toISOString() });
  bumpAssignments();
  return id;
}

// "Assign onboarding by role": assign every ACTIVE module whose targetRole is
// the chosen role (or 'all') to the assignee. Returns how many were newly added.
export function assignOnboardingByRole(role: TrainingRole, assigneeId: string): number {
  const due = modules.filter(
    (m) => m.active && (m.targetRole === role || m.targetRole === 'all'),
  );
  let added = 0;
  for (const m of due) {
    if (!hasAssignment(m.id, assigneeId)) { assignModule(m.id, assigneeId); added += 1; }
  }
  return added;
}

// Advance assigned -> in_progress -> completed, stamping timestamps. Completed
// is terminal (sign-off is the next, separate step).
export function advanceStatus(assignmentId: string): void {
  const a = assignments.find((x) => x.id === assignmentId);
  if (!a) return;
  const now = new Date().toISOString();
  if (a.status === 'assigned') { a.status = 'in_progress'; a.startedAt = now; }
  else if (a.status === 'in_progress') { a.status = 'completed'; a.completedAt = now; }
  bumpAssignments();
}

// Supervisor competency sign-off — only on a completed assignment.
export function signOff(assignmentId: string, supervisorId: string, note: string): boolean {
  const a = assignments.find((x) => x.id === assignmentId);
  if (!a || a.status !== 'completed') return false;
  a.signoff = { supervisorId, signedAt: new Date().toISOString(), note };
  bumpAssignments();
  return true;
}

export function resetTraining(
  seedModules: TrainingModule[] = SEED_MODULES,
  seedAssignments: TrainingAssignment[] = SEED_ASSIGNMENTS,
): void {
  modules = [...seedModules];
  assignments = [...seedAssignments];
  notify();
}

// Re-export the CompetencySignoff type for callers that only import the store.
export type { CompetencySignoff };
