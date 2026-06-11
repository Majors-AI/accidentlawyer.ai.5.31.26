// Staff Training — in-memory seed (SCAFFOLD, for display).
//
// Modules + a few assignments so the tracker shows real-looking state on first
// load. Assignee/supervisor ids match the firmSettings SEED employees
// (emp-1 Dana Whitfield · emp-2 Marcus Lee · emp-3 Priya Nair), which the view
// reads via useFirmSettings() — so names resolve without a parallel staff list.
// TODO(real persistence: Supabase) — replace with a fetch from the
// 12_staff_training.sql tables, scoped by firm_id (see store.ts seam note).

import type { TrainingAssignment, TrainingModule } from './types';

export const SEED_MODULES: TrainingModule[] = [
  { id: 'mod.orientation', title: 'Firm orientation & policies',
    description: 'Handbook, security, and confidentiality basics every hire completes.',
    targetRole: 'all', sortOrder: 1, active: true },
  { id: 'mod.client_comms', title: 'Client communication standards',
    description: 'Tone, response SLAs, and what may not be said without attorney review.',
    targetRole: 'all', sortOrder: 2, active: true },
  { id: 'mod.intake', title: 'Intake & conflict checks',
    description: 'Lead qualification, conflict screening, and matter opening.',
    targetRole: 'intake_specialist', sortOrder: 3, active: true },
  { id: 'mod.case_mgmt', title: 'Case management system',
    description: 'Working the matter lifecycle: records, bills, treatment tracking.',
    targetRole: 'case_manager', sortOrder: 4, active: true },
  { id: 'mod.trust_accounting', title: 'Trust accounting & compliance',
    description: 'Three-way reconciliation and disbursement controls.',
    targetRole: 'accounting', sortOrder: 5, active: true },
  { id: 'mod.litigation', title: 'Litigation procedures',
    description: 'Filing, service, discovery calendaring, and mediation prep.',
    targetRole: 'attorney', sortOrder: 6, active: true },
];

// Fixed ISO timestamps (not Date.now()) so the seed is deterministic.
export const SEED_ASSIGNMENTS: TrainingAssignment[] = [
  // emp-3 Priya (paralegal/legal) — completed orientation, supervisor-signed.
  { id: 'asn-1', moduleId: 'mod.orientation', assigneeId: 'emp-3', status: 'completed',
    assignedAt: '2026-05-01T16:00:00.000Z', startedAt: '2026-05-02T16:00:00.000Z',
    completedAt: '2026-05-04T16:00:00.000Z',
    signoff: { supervisorId: 'emp-1', signedAt: '2026-05-05T16:00:00.000Z',
      note: 'Confident on confidentiality + handbook. Cleared.' } },
  // emp-2 Marcus (intake) — completed intake module, awaiting sign-off.
  { id: 'asn-2', moduleId: 'mod.intake', assigneeId: 'emp-2', status: 'completed',
    assignedAt: '2026-05-10T16:00:00.000Z', startedAt: '2026-05-11T16:00:00.000Z',
    completedAt: '2026-05-15T16:00:00.000Z' },
  // emp-2 Marcus — orientation in progress.
  { id: 'asn-3', moduleId: 'mod.orientation', assigneeId: 'emp-2', status: 'in_progress',
    assignedAt: '2026-05-10T16:00:00.000Z', startedAt: '2026-05-12T16:00:00.000Z' },
  // emp-3 Priya — case management just assigned.
  { id: 'asn-4', moduleId: 'mod.case_mgmt', assigneeId: 'emp-3', status: 'assigned',
    assignedAt: '2026-05-20T16:00:00.000Z' },
];
