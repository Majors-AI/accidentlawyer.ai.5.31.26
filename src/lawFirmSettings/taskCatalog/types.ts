// Law Firm Settings § Task Management — core typed model (SCAFFOLD).
//
// This is a self-contained module: it deliberately defines its OWN broader
// department set (nine departments across the full PI lifecycle) rather than
// reusing the three-department `DeptId` in src/lib/firmSettings.tsx, which
// models the staffing/hours config — a different concern. Keeping them separate
// avoids coupling the automation catalog to the org chart.
//
// No persistence this pass: the catalog lives in React state seeded from
// seed.ts. TODO(real persistence: Supabase) — load/save this shape from a
// `firm_task_config` slice scoped by firm_id, behind RLS, with each mode change
// written to the audit log.

// How much of a task the firm lets the system do on its own.
export type AutomationMode = 'auto' | 'queued' | 'manual';
// auto   = action fires with no human step
// queued = bot generates/stages the action; a human releases it with one click
// manual = a human performs the whole task

// What starts a task.
export type TriggerType =
  | 'manual'        // started by a person
  | 'status_change' // fires when the matter hits a journey stage/status
  | 'scheduled'     // fires on a delay relative to an anchor event
  | 'dependency';   // fires when another task/condition completes

// What a task DOES when it runs. 'none' = an internal step with no outbound
// action (a review, a decision, a calculation).
export type ActionType =
  | 'none'
  | 'send_lor'
  | 'request_records'
  | 'request_bills'
  | 'send_demand'
  | 'generate_doc'
  | 'send_email'
  | 'send_sms'
  | 'assign_task'
  | 'calendar_event';

// The nine departments of the PI matter lifecycle, in journey order.
export type DepartmentId =
  | 'intake'
  | 'case_mgmt'
  | 'liens'
  | 'demand_nego'
  | 'litigation'
  | 'settlement'
  | 'accounting'
  | 'legal_review'
  | 'staff_training';

export type Priority = 'low' | 'med' | 'high';

export interface TaskTrigger {
  type: TriggerType;
  on?: string;        // status/stage id (status_change) or anchor event (scheduled/dependency)
  delayDays?: number; // for 'scheduled': days after the anchor event
}

export interface FirmTask {
  id: string;
  department: DepartmentId;
  label: string;
  description?: string;
  defaultOwnerRole: string;        // e.g. 'case_manager', 'attorney'
  trigger: TaskTrigger;
  action: ActionType;
  automationMode: AutomationMode;  // RESOLVED value (after the cascade + hard rules)
  modeOverride?: AutomationMode;   // set when a task overrides its dept/firm default
  attorneyGated: boolean;          // true = can NEVER be 'auto' (coerced to 'queued')
  externalAction: boolean;         // touches the outside world (LOR, records, SMS, e-sign...)
  // NOTE — extension beyond the spec's FirmTask: the spec lists "money movement
  // (fund transfers/disbursements): always 'manual', never selectable" as a hard
  // rule, but the interface had no way to MARK such a task. This flag is that
  // marker; resolveMode() coerces any flagged task to 'manual' and the UI locks
  // its selector. Only true fund movements carry it (trust deposit, client
  // disbursement) — not internal calcs or accounting allocations.
  moneyMovement?: boolean;
  slaDays?: number;
  priority: Priority;
}

export interface Department {
  id: DepartmentId;
  label: string;
  defaultMode: AutomationMode;     // department-level default (under the firm default)
  tasks: FirmTask[];
}

export interface FirmTaskConfig {
  firmId: string;
  firmDefaultMode: AutomationMode; // top of the cascade
  departments: Department[];
  // NOTE — extension beyond the spec's FirmTaskConfig: the external-action hard
  // rule says 'auto' is allowed for an external action "only if the firm
  // explicitly opted that action type in." This is where that opt-in lives.
  // Empty (the seed default) means no external action may run 'auto' — every
  // external task coerces to 'queued' at most.
  autoApprovedActions: ActionType[];
}

// Minimal matter state the trigger evaluator reads. Real matter state is far
// richer; this is only what evaluateTriggers() needs this pass.
export interface MatterState {
  status: string;                          // current journey status/stage id
  completedTaskIds: string[];              // for 'dependency' triggers
  daysSinceAnchor?: Record<string, number>;// anchor event id -> days elapsed ('scheduled')
}

// How routeTask classifies a resolved task for downstream handling.
export type RouteDecision = 'execute' | 'queue' | 'assign';

// One option in a task's 3-way mode selector, with whether it's locked and why.
export interface ModeOption {
  mode: AutomationMode;
  disabled: boolean;
  reason?: string; // populated when disabled — shown as the tooltip
}
