// Pure auto-assignment engine. Input -> decision; it does NOT mutate or call the
// store. Kept dependency-free and side-effect-free so it is directly testable and
// reusable from both the settings simulator and (later) real routing.
//
// TODO(real reassignment seam): in production, assignment also runs — and can be
// overridden — from the client file in the File Cabinet (a separate page). That
// wiring (and persistence of the chosen assignee) is a later/back-end touch; this
// function is the single decision authority both call sites should share.

import type { CaseTypeAssignment, DepartmentTask } from './firmSettings';

export interface CaseContext {
  state: string;       // US state code, e.g. 'AZ'
  caseType: string;    // claim_type enum value, e.g. 'mva'
}

export interface AutoAssignInput {
  task: DepartmentTask;
  caseContext: CaseContext;
  members: { id: string }[];                                // this department's members
  scores: Record<string, number>;                          // employeeId -> 0..100 strength
  caseTypeAssignments: Record<string, CaseTypeAssignment>;  // employeeId -> coverage
  // Scaffold inputs — TODO(real workload + real availability from schedule/PTO).
  workloads: Record<string, number>;                        // employeeId -> open-task count
  available: Record<string, boolean>;                       // employeeId -> available now
  initialContactId?: string | null;                         // who first handled this case
  manualOverrideId?: string | null;                         // supervisor/super-admin override
}

export interface AutoAssignResult {
  assigneeId: string | null;
  reason: string;
}

export function autoAssign(input: AutoAssignInput): AutoAssignResult {
  const {
    task, caseContext, members, scores, caseTypeAssignments,
    workloads, available, initialContactId, manualOverrideId,
  } = input;

  const isMember = (id: string) => members.some(m => m.id === id);
  // Missing availability defaults to available (scaffold-friendly).
  const isAvailable = (id: string) => available[id] !== false;

  // Covers the (state × caseType) of this case for this department.
  const covers = (id: string) => {
    const a = caseTypeAssignments[id];
    if (!a) return false;
    if (!a.caseTypes.includes(caseContext.caseType)) return false;
    return a.allStates || a.states.includes(caseContext.state);
  };

  const eligible = (id: string) => isMember(id) && covers(id) && isAvailable(id);

  // 1. Manual override wins outright (no eligibility re-check — it's deliberate).
  if (manualOverrideId) {
    return { assigneeId: manualOverrideId, reason: 'manual override' };
  }

  // 2. Follow-up tasks route back to the initial contact when still eligible.
  if (task.isFollowUp && initialContactId && eligible(initialContactId)) {
    return { assigneeId: initialContactId, reason: 'follow-up routed to initial contact' };
  }

  // 3. Highest strength score among eligible; ties broken by lighter workload.
  const candidates = members.filter(m => eligible(m.id));
  if (candidates.length === 0) {
    return { assigneeId: null, reason: 'no eligible staff' };
  }

  const ranked = candidates.slice().sort((a, b) => {
    const sa = scores[a.id] ?? 0, sb = scores[b.id] ?? 0;
    if (sb !== sa) return sb - sa;                          // higher strength first
    const wa = workloads[a.id] ?? 0, wb = workloads[b.id] ?? 0;
    return wa - wb;                                         // then lighter workload
  });

  const winner = ranked[0];
  const score = scores[winner.id] ?? 0;
  const workload = workloads[winner.id] ?? 0;
  const tieBroken = ranked.length > 1 && (scores[ranked[1].id] ?? 0) === score;
  const reason = tieBroken
    ? `highest strength score (${score}), won workload tiebreak (${workload} open)`
    : `highest strength score (${score})`;

  return { assigneeId: winner.id, reason };
}
