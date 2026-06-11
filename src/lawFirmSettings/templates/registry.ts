// Action Templates — merge-field registry (SCAFFOLD).
//
// The canonical set of merge fields available per action type. The template
// editor reads this to render the insert-field picker, and the seed templates'
// `fields` lists are taken from here.

import type { MergeField, TemplateActionType } from './types';

const LOR_FIELDS: MergeField[] = [
  { key: 'firm.letterhead', label: 'Firm letterhead', required: false },
  { key: 'firm.name', label: 'Firm name', required: true },
  { key: 'attorney.name', label: 'Attorney name', required: true },
  { key: 'attorney.barNo', label: 'Attorney bar #', required: false },
  { key: 'client.fullName', label: 'Client full name', required: true },
  { key: 'client.dob', label: 'Client DOB', required: false },
  { key: 'matter.number', label: 'Matter #', required: true },
  { key: 'matter.dateOfIncident', label: 'Date of incident', required: true },
  { key: 'carrier.name', label: 'Carrier name', required: true },
  { key: 'carrier.address', label: 'Carrier address', required: false },
  { key: 'carrier.claimNo', label: 'Claim #', required: true },
  { key: 'carrier.adjuster', label: 'Adjuster', required: false },
  { key: 'insured.name', label: 'Insured name', required: false },
  { key: 'today', label: "Today's date", required: false },
];

const RECORDS_FIELDS: MergeField[] = [
  { key: 'provider.name', label: 'Provider name', required: true },
  { key: 'provider.address', label: 'Provider address', required: false },
  { key: 'patient.fullName', label: 'Patient full name', required: true },
  { key: 'patient.dob', label: 'Patient DOB', required: true },
  { key: 'records.dateRange', label: 'Records date range', required: false },
  { key: 'hipaa.authRef', label: 'HIPAA authorization ref', required: true },
  { key: 'matter.number', label: 'Matter #', required: true },
  { key: 'firm.name', label: 'Firm name', required: true },
  { key: 'attorney.name', label: 'Attorney name', required: true },
  { key: 'today', label: "Today's date", required: false },
];

// Bills = records fields plus the itemized-request flag.
const BILLS_FIELDS: MergeField[] = [
  ...RECORDS_FIELDS,
  { key: 'billing.itemizedRequest', label: 'Itemized request', required: false },
];

export const MERGE_FIELDS: Record<TemplateActionType, MergeField[]> = {
  send_lor: LOR_FIELDS,
  request_records: RECORDS_FIELDS,
  request_bills: BILLS_FIELDS,
};
