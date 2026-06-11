// Staff Training — types (SCAFFOLD).
//
// Department concepts transcribed from the Task Management catalog's
// "Staff Training" department (src/lawFirmSettings/taskCatalog/seed.ts):
//   • assign onboarding by role   (owner: hr)
//   • track module completion     (owner: hr)
//   • competency sign-off         (owner: supervisor — releases; NOT attorney-gated)
//
// Assignee referencing seam: in this in-memory pass an assignee/supervisor id is
// a firmSettings Employee.id (e.g. 'emp-1'), good enough for display. The future
// real schema (supabase/12_staff_training.sql) keys these to profiles.id. Both
// are opaque string ids here, so the swap is a data-source change, not a type
// change.

// A trainee's progress on one module.
export type TrainingStatus = 'assigned' | 'in_progress' | 'completed';

// Onboarding/training unit, targeted at a role (who should take it).
export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  targetRole: TrainingRole;  // who it's assigned to ('all' = every staff role)
  sortOrder: number;
  active: boolean;           // inactive modules aren't assigned by "assign by role"
}

// One module assigned to one person. Supervisor competency sign-off is folded
// onto the assignment (the spec's "or fold sign-off onto the assignment"
// option) — kept as an optional CompetencySignoff so the migration can still
// split it into its own table without reshaping the rest.
export interface TrainingAssignment {
  id: string;
  moduleId: string;
  assigneeId: string;        // SCAFFOLD: Employee.id · REAL: profiles.id
  status: TrainingStatus;
  assignedAt: string;        // ISO
  startedAt?: string;        // ISO, stamped on assigned -> in_progress
  completedAt?: string;      // ISO, stamped on -> completed
  signoff?: CompetencySignoff;
}

// Supervisor competency sign-off. Only valid once the assignment is completed.
export interface CompetencySignoff {
  supervisorId: string;      // SCAFFOLD: Employee.id · REAL: profiles.id
  signedAt: string;          // ISO
  note: string;
}

// Training role keys. Aligned with the taskCatalog owner-role strings (HR
// assigns; supervisors sign off; the rest are trainee targets). 'all' targets
// every staff role.
export type TrainingRole =
  | 'all'
  | 'attorney'
  | 'paralegal'
  | 'case_manager'
  | 'intake_specialist'
  | 'accounting';

export const TRAINING_ROLES: { value: TrainingRole; label: string }[] = [
  { value: 'all',               label: 'All staff' },
  { value: 'attorney',          label: 'Attorney' },
  { value: 'paralegal',         label: 'Paralegal' },
  { value: 'case_manager',      label: 'Case manager' },
  { value: 'intake_specialist', label: 'Intake specialist' },
  { value: 'accounting',        label: 'Accounting' },
];

export const ROLE_LABEL: Record<TrainingRole, string> =
  Object.fromEntries(TRAINING_ROLES.map(r => [r.value, r.label])) as Record<TrainingRole, string>;
