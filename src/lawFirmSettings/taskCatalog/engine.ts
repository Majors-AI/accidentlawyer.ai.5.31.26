// Law Firm Settings § Task Management — automation engine (SCAFFOLD / pure).
//
// No live execution this pass. resolveMode/modeOptions/evaluateTriggers/routeTask
// are pure; the action handlers are no-ops that return a human-readable line
// describing what WOULD happen. Real sends/executions wire in later (the same
// seam pattern as commsSender.ts).

import type {
  AutomationMode,
  Department,
  FirmTask,
  FirmTaskConfig,
  MatterState,
  ModeOption,
  RouteDecision,
} from './types';

const MODES: AutomationMode[] = ['auto', 'queued', 'manual'];

// ---- mode resolution (the cascade + the hard rules) ---------------------
//
// Effective mode = task.modeOverride ?? department.defaultMode ?? firmDefaultMode,
// then clamped by the hard rules a setting must never be able to break:
//   1. money movement  -> always 'manual'
//   2. attorney-gated   -> never 'auto' (clamped up to 'queued')
//   3. external action  -> 'auto' only if the firm opted that action type in;
//                          otherwise clamped up to 'queued'
export function resolveMode(task: FirmTask, dept: Department, firm: FirmTaskConfig): AutomationMode {
  // Hard rule 1 — non-negotiable, ignores every default and override.
  if (task.moneyMovement) return 'manual';

  let mode: AutomationMode = task.modeOverride ?? dept.defaultMode ?? firm.firmDefaultMode;

  // Hard rule 2.
  if (task.attorneyGated && mode === 'auto') mode = 'queued';

  // Hard rule 3.
  if (
    task.externalAction &&
    mode === 'auto' &&
    !firm.autoApprovedActions.includes(task.action)
  ) {
    mode = 'queued';
  }

  return mode;
}

// Is a task currently running on its inherited default (no explicit override)?
export function isInherited(task: FirmTask): boolean {
  return task.modeOverride == null;
}

// The three selector options for a task, each flagged disabled (with a reason)
// when a hard rule forbids it. Drives the greyed-out + tooltip UI.
export function modeOptions(task: FirmTask, _firm: FirmTaskConfig): ModeOption[] {
  return MODES.map((mode): ModeOption => {
    if (task.moneyMovement && mode !== 'manual') {
      return { mode, disabled: true, reason: 'Money movement is always manual — never automated.' };
    }
    if (task.attorneyGated && mode === 'auto') {
      return { mode, disabled: true, reason: 'Attorney-gated task — cannot run fully automatic.' };
    }
    if (task.externalAction && mode === 'auto' && !_firm.autoApprovedActions.includes(task.action)) {
      return {
        mode,
        disabled: true,
        reason: 'External action — the firm has not enabled auto for this action type.',
      };
    }
    return { mode, disabled: false };
  });
}

// ---- trigger evaluation -------------------------------------------------
//
// NOTE — signature differs from the spec's evaluateTriggers(matterState): the
// catalog is needed to know WHICH tasks exist, so the firm config is the first
// argument. Returns the tasks whose trigger condition is met by this matter
// state right now. Pure: no execution, no routing — that's routeTask's job.
export function evaluateTriggers(firm: FirmTaskConfig, matter: MatterState): FirmTask[] {
  const fired: FirmTask[] = [];
  for (const dept of firm.departments) {
    for (const task of dept.tasks) {
      if (triggerMet(task, matter)) fired.push(task);
    }
  }
  return fired;
}

function triggerMet(task: FirmTask, matter: MatterState): boolean {
  const t = task.trigger;
  switch (t.type) {
    case 'manual':
      return false; // manual tasks never fire on their own
    case 'status_change':
      return t.on != null && matter.status === t.on;
    case 'dependency':
      return t.on != null && matter.completedTaskIds.includes(t.on);
    case 'scheduled': {
      if (t.on == null || t.delayDays == null) return false;
      const elapsed = matter.daysSinceAnchor?.[t.on];
      return elapsed != null && elapsed >= t.delayDays;
    }
    default:
      return false;
  }
}

// ---- routing ------------------------------------------------------------
//
// Given a task whose automationMode is already RESOLVED, decide how the work is
// handled: fire it, stage it for one-click release, or assign it to a person.
export function routeTask(task: FirmTask): RouteDecision {
  switch (task.automationMode) {
    case 'auto':
      return 'execute';
    case 'queued':
      return 'queue';
    case 'manual':
    default:
      return 'assign';
  }
}

// ---- action handlers (STUBS) --------------------------------------------
//
// No-ops that return what WOULD happen. Real implementations replace these
// (send_lor -> generate + send the letter, request_records -> fire the request,
// send_sms -> Twilio, etc.). Kept as a Record so the set is exhaustive over
// ActionType — adding an ActionType without a handler is a compile error.
export type ActionHandler = (task: FirmTask) => string;

export const ACTION_HANDLERS: Record<FirmTask['action'], ActionHandler> = {
  none: (t) => `No outbound action for "${t.label}" (internal step).`,
  send_lor: (t) => `WOULD send Letter of Representation for "${t.label}".`,
  request_records: (t) => `WOULD request medical records for "${t.label}".`,
  request_bills: (t) => `WOULD request itemized bills for "${t.label}".`,
  send_demand: (t) => `WOULD transmit the demand package for "${t.label}".`,
  generate_doc: (t) => `WOULD generate the document/draft for "${t.label}".`,
  send_email: (t) => `WOULD send the email for "${t.label}".`,
  send_sms: (t) => `WOULD send the SMS for "${t.label}".`,
  assign_task: (t) => `WOULD assign "${t.label}" to ${t.defaultOwnerRole}.`,
  calendar_event: (t) => `WOULD create a calendar event for "${t.label}".`,
};

// Convenience: describe what running a task would do (handler + route), without
// doing anything. Useful for the engine's eventual dry-run/preview.
export function previewTask(task: FirmTask): { route: RouteDecision; effect: string } {
  return { route: routeTask(task), effect: ACTION_HANDLERS[task.action](task) };
}
