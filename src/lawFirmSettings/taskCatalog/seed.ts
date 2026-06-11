// Law Firm Settings § Task Management — seed catalog (SCAFFOLD, in-memory).
//
// Nine departments and their tasks, transcribed from the build spec. Flags
// (attorneyGated / externalAction / moneyMovement) are set per the catalog's
// annotations. Firm default = 'queued'.
//
// Convention used here so the UI's "inherited" vs "override" distinction is
// real and visible: each department's defaultMode is 'queued' (matching the
// firm default), and a task carries modeOverride ONLY when its catalog hint
// differs from that — i.e. tasks marked (auto) or (manual) get an explicit
// override; tasks that are naturally queued inherit and render the "inherited"
// tag. Resolved automationMode is then computed through the engine so the hard
// rules (money movement, attorney-gated, external) are already reflected.

import type { Department, FirmTask, FirmTaskConfig } from './types';
import { resolveMode } from './engine';

// Terse task builder. automationMode is a placeholder here; it's recomputed via
// resolveMode in the finalize pass below.
function mk(t: Omit<FirmTask, 'automationMode'>): FirmTask {
  return { automationMode: 'manual', ...t };
}

const intake: Department = {
  id: 'intake',
  label: 'Intake',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'intake.capture_lead', department: 'intake', label: 'Capture & qualify lead',
      defaultOwnerRole: 'intake_specialist', trigger: { type: 'status_change', on: 'lead_received' },
      action: 'none', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'high' }),
    mk({ id: 'intake.conflict_check', department: 'intake', label: 'Conflict check',
      defaultOwnerRole: 'paralegal', trigger: { type: 'dependency', on: 'intake.capture_lead' },
      action: 'none', attorneyGated: true, externalAction: false, priority: 'high' }),
    mk({ id: 'intake.fee_agreement', department: 'intake', label: 'Send fee agreement (e-sign)',
      defaultOwnerRole: 'case_manager', trigger: { type: 'status_change', on: 'qualified' },
      action: 'generate_doc', attorneyGated: false, externalAction: true, priority: 'high' }),
    mk({ id: 'intake.open_matter', department: 'intake', label: 'Open matter',
      defaultOwnerRole: 'case_manager', trigger: { type: 'dependency', on: 'intake.fee_agreement' },
      action: 'none', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'med' }),
    mk({ id: 'intake.send_lors', department: 'intake', label: 'Send LORs',
      defaultOwnerRole: 'case_manager', trigger: { type: 'status_change', on: 'matter_opened' },
      action: 'send_lor', attorneyGated: false, externalAction: true, priority: 'high' }),
    mk({ id: 'intake.welcome_invite', department: 'intake', label: 'Welcome + portal invite',
      defaultOwnerRole: 'case_manager', trigger: { type: 'dependency', on: 'intake.open_matter' },
      action: 'send_email', attorneyGated: false, externalAction: true, priority: 'med' }),
    mk({ id: 'intake.assign_cm', department: 'intake', label: 'Assign to case manager',
      defaultOwnerRole: 'intake_specialist', trigger: { type: 'dependency', on: 'intake.open_matter' },
      action: 'assign_task', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'med' }),
  ],
};

const caseMgmt: Department = {
  id: 'case_mgmt',
  label: 'Case Management',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'cm.police_report', department: 'case_mgmt', label: 'Request police report',
      defaultOwnerRole: 'case_manager', trigger: { type: 'status_change', on: 'matter_opened' },
      action: 'request_records', attorneyGated: false, externalAction: true, priority: 'med' }),
    mk({ id: 'cm.verify_liability', department: 'case_mgmt', label: 'Verify liability / UM-UIM',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'cm.police_report' },
      action: 'none', attorneyGated: true, externalAction: false, priority: 'high' }),
    mk({ id: 'cm.log_providers', department: 'case_mgmt', label: 'Log providers',
      defaultOwnerRole: 'case_manager', trigger: { type: 'manual' },
      action: 'none', modeOverride: 'manual', attorneyGated: false, externalAction: false, priority: 'med' }),
    mk({ id: 'cm.request_records', department: 'case_mgmt', label: 'Request records',
      defaultOwnerRole: 'case_manager', trigger: { type: 'dependency', on: 'cm.log_providers' },
      action: 'request_records', attorneyGated: false, externalAction: true, priority: 'med' }),
    mk({ id: 'cm.request_bills', department: 'case_mgmt', label: 'Request bills',
      defaultOwnerRole: 'case_manager', trigger: { type: 'dependency', on: 'cm.log_providers' },
      action: 'request_bills', attorneyGated: false, externalAction: true, priority: 'med' }),
    mk({ id: 'cm.records_followup', department: 'case_mgmt', label: 'Records / bills follow-up',
      defaultOwnerRole: 'case_manager', trigger: { type: 'scheduled', on: 'records_requested', delayDays: 14 },
      action: 'request_records', attorneyGated: false, externalAction: true, priority: 'low' }),
    mk({ id: 'cm.treatment_checkin', department: 'case_mgmt', label: 'Treatment check-in SMS',
      defaultOwnerRole: 'case_manager', trigger: { type: 'scheduled', on: 'treatment_started', delayDays: 7 },
      action: 'send_sms', attorneyGated: false, externalAction: true, priority: 'low' }),
    mk({ id: 'cm.confirm_mmi', department: 'case_mgmt', label: 'Confirm MMI',
      defaultOwnerRole: 'attorney', trigger: { type: 'manual' },
      action: 'none', modeOverride: 'manual', attorneyGated: true, externalAction: false, priority: 'med',
      description: 'Maximum medical improvement — requires attorney note.' }),
    mk({ id: 'cm.specials_summary', department: 'case_mgmt', label: 'Build specials summary',
      defaultOwnerRole: 'case_manager', trigger: { type: 'dependency', on: 'records_complete' },
      action: 'generate_doc', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'med',
      description: 'Auto-drafted internal summary of damages/specials.' }),
  ],
};

const liens: Department = {
  id: 'liens',
  label: 'Liens & Records',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'liens.identify', department: 'liens', label: 'Identify lienholders',
      defaultOwnerRole: 'lien_specialist', trigger: { type: 'status_change', on: 'records_received' },
      action: 'none', attorneyGated: false, externalAction: false, priority: 'med' }),
    mk({ id: 'liens.request_statements', department: 'liens', label: 'Request lien statements',
      defaultOwnerRole: 'lien_specialist', trigger: { type: 'dependency', on: 'liens.identify' },
      action: 'request_records', attorneyGated: false, externalAction: true, priority: 'med' }),
    mk({ id: 'liens.track_balances', department: 'liens', label: 'Track balances',
      defaultOwnerRole: 'lien_specialist', trigger: { type: 'status_change', on: 'lien_statements_received' },
      action: 'none', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'low' }),
    mk({ id: 'liens.negotiate', department: 'liens', label: 'Negotiate reductions',
      defaultOwnerRole: 'attorney', trigger: { type: 'manual' },
      action: 'none', modeOverride: 'manual', attorneyGated: true, externalAction: false, priority: 'high' }),
  ],
};

const demandNego: Department = {
  id: 'demand_nego',
  label: 'Demand & Negotiation',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'demand.assemble', department: 'demand_nego', label: 'Assemble demand package',
      defaultOwnerRole: 'case_manager', trigger: { type: 'dependency', on: 'mmi_confirmed' },
      action: 'generate_doc', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'high',
      description: 'Auto-drafted; reviewed before it goes out.' }),
    mk({ id: 'demand.review', department: 'demand_nego', label: 'Demand review',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'demand.assemble' },
      action: 'none', attorneyGated: true, externalAction: false, priority: 'high' }),
    mk({ id: 'demand.send', department: 'demand_nego', label: 'Send demand',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'demand.review' },
      action: 'send_demand', attorneyGated: false, externalAction: true, priority: 'high' }),
    mk({ id: 'demand.log_offers', department: 'demand_nego', label: 'Log offers',
      defaultOwnerRole: 'case_manager', trigger: { type: 'manual' },
      action: 'none', modeOverride: 'manual', attorneyGated: false, externalAction: false, priority: 'med' }),
    mk({ id: 'demand.authority', department: 'demand_nego', label: 'Get settlement authority',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'demand.log_offers' },
      action: 'send_email', attorneyGated: false, externalAction: true, priority: 'high' }),
    mk({ id: 'demand.deadlines', department: 'demand_nego', label: 'Deadline tracking',
      defaultOwnerRole: 'case_manager', trigger: { type: 'scheduled', on: 'demand_sent', delayDays: 30 },
      action: 'calendar_event', attorneyGated: false, externalAction: false, priority: 'med' }),
  ],
};

const litigation: Department = {
  id: 'litigation',
  label: 'Litigation',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'lit.complaint', department: 'litigation', label: 'Draft / file complaint',
      defaultOwnerRole: 'attorney', trigger: { type: 'manual' },
      action: 'generate_doc', modeOverride: 'manual', attorneyGated: true, externalAction: false, priority: 'high' }),
    mk({ id: 'lit.track_service', department: 'litigation', label: 'Track service',
      defaultOwnerRole: 'paralegal', trigger: { type: 'status_change', on: 'complaint_filed' },
      action: 'none', attorneyGated: false, externalAction: false, priority: 'med' }),
    mk({ id: 'lit.calendar', department: 'litigation', label: 'Calendar discovery / depos / hearings',
      defaultOwnerRole: 'paralegal', trigger: { type: 'status_change', on: 'suit_filed' },
      action: 'calendar_event', attorneyGated: false, externalAction: false, priority: 'med' }),
    mk({ id: 'lit.discovery_reminders', department: 'litigation', label: 'Discovery reminders',
      defaultOwnerRole: 'paralegal', trigger: { type: 'scheduled', on: 'discovery_opened', delayDays: 7 },
      action: 'calendar_event', attorneyGated: false, externalAction: false, priority: 'low' }),
    mk({ id: 'lit.mediation_prep', department: 'litigation', label: 'Mediation prep',
      defaultOwnerRole: 'attorney', trigger: { type: 'status_change', on: 'mediation_scheduled' },
      action: 'generate_doc', attorneyGated: false, externalAction: false, priority: 'med' }),
  ],
};

const settlement: Department = {
  id: 'settlement',
  label: 'Settlement',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'settle.deposit_trust', department: 'settlement', label: 'Deposit funds to trust',
      defaultOwnerRole: 'accounting', trigger: { type: 'manual' },
      action: 'none', modeOverride: 'manual', attorneyGated: true, externalAction: false,
      moneyMovement: true, priority: 'high' }),
    mk({ id: 'settle.confirm_liens', department: 'settlement', label: 'Confirm liens resolved',
      defaultOwnerRole: 'lien_specialist', trigger: { type: 'dependency', on: 'settle.deposit_trust' },
      action: 'none', attorneyGated: false, externalAction: false, priority: 'high',
      description: 'Gate — disbursement blocked until liens are confirmed resolved.' }),
    mk({ id: 'settle.statement', department: 'settlement', label: 'Generate settlement statement',
      defaultOwnerRole: 'accounting', trigger: { type: 'dependency', on: 'funds_in_trust' },
      action: 'generate_doc', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'high',
      description: 'Auto-drafted disbursement worksheet.' }),
    mk({ id: 'settle.client_signs', department: 'settlement', label: 'Client signs statement / release',
      defaultOwnerRole: 'case_manager', trigger: { type: 'dependency', on: 'settle.statement' },
      action: 'generate_doc', attorneyGated: false, externalAction: true, priority: 'high' }),
    mk({ id: 'settle.disburse', department: 'settlement', label: 'Disburse to client',
      defaultOwnerRole: 'accounting', trigger: { type: 'dependency', on: 'settle.client_signs' },
      action: 'none', modeOverride: 'manual', attorneyGated: true, externalAction: false,
      moneyMovement: true, priority: 'high',
      description: 'Money movement — locked to manual, never selectable.' }),
  ],
};

const accounting: Department = {
  id: 'accounting',
  label: 'Accounting / Trust',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'acct.record_costs', department: 'accounting', label: 'Record case costs',
      defaultOwnerRole: 'accounting', trigger: { type: 'manual' },
      action: 'none', modeOverride: 'manual', attorneyGated: false, externalAction: false, priority: 'low' }),
    mk({ id: 'acct.reconciliation', department: 'accounting', label: 'Trust reconciliation',
      defaultOwnerRole: 'accounting', trigger: { type: 'scheduled', on: 'month_end', delayDays: 0 },
      action: 'none', attorneyGated: false, externalAction: false, priority: 'high',
      description: 'Periodic three-way trust reconciliation (review, not a transfer).' }),
    mk({ id: 'acct.cost_reimbursement', department: 'accounting', label: 'Cost reimbursement',
      defaultOwnerRole: 'accounting', trigger: { type: 'dependency', on: 'settlement_disbursed' },
      action: 'none', attorneyGated: false, externalAction: false, priority: 'med',
      description: 'Catalog-marked queued (release with approval); treated as an internal allocation, not a locked disbursement.' }),
    mk({ id: 'acct.fee_calc', department: 'accounting', label: 'Fee calculation',
      defaultOwnerRole: 'accounting', trigger: { type: 'dependency', on: 'settlement_reached' },
      action: 'none', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'med' }),
  ],
};

// Legal Review — every task is queued + attorney-gated (sign-offs).
const legalReview: Department = {
  id: 'legal_review',
  label: 'Legal Review',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'lr.liability_decision', department: 'legal_review', label: 'Liability decision',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'liability_verified' },
      action: 'none', attorneyGated: true, externalAction: false, priority: 'high' }),
    mk({ id: 'lr.demand_approval', department: 'legal_review', label: 'Demand approval',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'demand_assembled' },
      action: 'none', attorneyGated: true, externalAction: false, priority: 'high' }),
    mk({ id: 'lr.settlement_authority', department: 'legal_review', label: 'Settlement authority sign-off',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'offer_logged' },
      action: 'none', attorneyGated: true, externalAction: false, priority: 'high' }),
    mk({ id: 'lr.lien_reduction_approval', department: 'legal_review', label: 'Lien-reduction approval',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'reduction_negotiated' },
      action: 'none', attorneyGated: true, externalAction: false, priority: 'high' }),
    mk({ id: 'lr.final_disbursement_approval', department: 'legal_review', label: 'Final disbursement approval',
      defaultOwnerRole: 'attorney', trigger: { type: 'dependency', on: 'statement_generated' },
      action: 'none', attorneyGated: true, externalAction: false, priority: 'high' }),
  ],
};

const staffTraining: Department = {
  id: 'staff_training',
  label: 'Staff Training',
  defaultMode: 'queued',
  tasks: [
    mk({ id: 'train.assign_onboarding', department: 'staff_training', label: 'Assign onboarding by role',
      defaultOwnerRole: 'hr', trigger: { type: 'status_change', on: 'employee_added' },
      action: 'assign_task', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'med' }),
    mk({ id: 'train.track_completion', department: 'staff_training', label: 'Track module completion',
      defaultOwnerRole: 'hr', trigger: { type: 'scheduled', on: 'onboarding_assigned', delayDays: 7 },
      action: 'none', modeOverride: 'auto', attorneyGated: false, externalAction: false, priority: 'low' }),
    mk({ id: 'train.competency_signoff', department: 'staff_training', label: 'Competency sign-off',
      defaultOwnerRole: 'supervisor', trigger: { type: 'dependency', on: 'train.track_completion' },
      action: 'none', attorneyGated: false, externalAction: false, priority: 'med',
      description: 'Supervisor releases (not attorney-gated).' }),
  ],
};

// Assemble, then resolve every task's automationMode through the engine so the
// seed already reflects the cascade + hard rules (e.g. money-movement tasks read
// 'manual' regardless of the queued default).
const departments: Department[] = [
  intake, caseMgmt, liens, demandNego, litigation, settlement, accounting, legalReview, staffTraining,
];

export const SEED_FIRM_CONFIG: FirmTaskConfig = (() => {
  const firm: FirmTaskConfig = {
    firmId: 'seed-firm',
    firmDefaultMode: 'queued',
    departments,
    autoApprovedActions: [], // nothing opted in → external actions cap at 'queued'
  };
  for (const dept of firm.departments) {
    for (const task of dept.tasks) {
      task.automationMode = resolveMode(task, dept, firm);
    }
  }
  return firm;
})();
