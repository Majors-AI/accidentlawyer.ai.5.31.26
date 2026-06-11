// Action Templates — seeded default templates (SCAFFOLD).
//
// Plain, professional letter copy with {{merge.key}} tokens. These are the
// isFirmDefault originals; "Reset to firm default" in the editor restores them.

import type { DocTemplate } from './types';
import { MERGE_FIELDS } from './registry';

export const DEFAULT_TEMPLATES: DocTemplate[] = [
  {
    id: 'tpl-lor-default',
    actionType: 'send_lor',
    name: 'Letter of Representation (default)',
    subject: 'Letter of Representation — {{client.fullName}} / Claim {{carrier.claimNo}}',
    isFirmDefault: true,
    fields: MERGE_FIELDS.send_lor,
    body: `{{firm.letterhead}}

{{today}}

{{carrier.name}}
{{carrier.address}}

Re:  Letter of Representation
     Claimant:        {{client.fullName}}
     Your insured:    {{insured.name}}
     Claim No.:       {{carrier.claimNo}}
     Date of loss:    {{matter.dateOfIncident}}
     Our file:        {{matter.number}}

Dear {{carrier.adjuster}}:

Please be advised that this firm represents {{client.fullName}} in connection with
injuries and damages arising out of the incident referenced above. Kindly direct
all further communication regarding this claim to my office and refrain from
contacting our client directly.

Please confirm coverage and applicable policy limits, and acknowledge receipt of
this letter at your earliest convenience. A request for preservation of all
relevant evidence is hereby made.

Thank you for your prompt attention to this matter.

Sincerely,

{{attorney.name}}
{{firm.name}}
State Bar No. {{attorney.barNo}}`,
  },
  {
    id: 'tpl-records-default',
    actionType: 'request_records',
    name: 'Medical Records Request (default)',
    subject: 'Records request — {{patient.fullName}} / Auth {{hipaa.authRef}}',
    isFirmDefault: true,
    fields: MERGE_FIELDS.request_records,
    body: `{{firm.name}}

{{today}}

{{provider.name}}
Attn: Medical Records
{{provider.address}}

Re:  Request for Medical Records
     Patient:    {{patient.fullName}}
     DOB:        {{patient.dob}}
     Our file:   {{matter.number}}
     Auth ref:   {{hipaa.authRef}}

To the Custodian of Records:

This office represents the above-named patient. Enclosed is a signed HIPAA
authorization (reference {{hipaa.authRef}}) permitting release of records.

Please provide complete medical records for the date range {{records.dateRange}},
including office notes, imaging reports, operative reports, and discharge
summaries. If records are maintained electronically, an electronic copy is
acceptable and preferred.

Please direct the records and any associated invoice to my attention.

Sincerely,

{{attorney.name}}
{{firm.name}}`,
  },
  {
    id: 'tpl-bills-default',
    actionType: 'request_bills',
    name: 'Medical Bills Request (default)',
    subject: 'Itemized billing request — {{patient.fullName}} / Auth {{hipaa.authRef}}',
    isFirmDefault: true,
    fields: MERGE_FIELDS.request_bills,
    body: `{{firm.name}}

{{today}}

{{provider.name}}
Attn: Billing Department
{{provider.address}}

Re:  Request for Itemized Billing
     Patient:    {{patient.fullName}}
     DOB:        {{patient.dob}}
     Our file:   {{matter.number}}
     Auth ref:   {{hipaa.authRef}}

To the Billing Department:

This office represents the above-named patient. Enclosed is a signed HIPAA
authorization (reference {{hipaa.authRef}}).

Please provide a complete itemized statement of all charges for the date range
{{records.dateRange}} ({{billing.itemizedRequest}}), including CPT/HCPCS codes,
date of service, charge amount, payments/adjustments, and current balance.

Please direct the itemized statement to my attention.

Sincerely,

{{attorney.name}}
{{firm.name}}`,
  },
];
