import { supabase } from './supabase';

export const DEFAULT_BODIES: Record<string, string> = {
  lor_adverse: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]

Re: Notice of Representation
Claimant: {{client_name}}
Date of Loss: {{date_of_loss}}
Claim: {{claim}}
Jurisdiction: {{jurisdiction}}

Dear {{recipient}},

Please be advised that this firm represents {{client_name}} in connection with the above-referenced matter involving your insured. All further communications regarding this claim should be directed to our office.

Please confirm claim number, adjuster contact, and policy limits at your earliest convenience.

[FIRM — Replace this skeleton with your reviewed LOR template before releasing.]

Sincerely,
{{attorney_name}}
{{firm_name}}`,

  lor_own_carrier: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]

Re: Notice of Representation / UM-UIM / PIP Claim
Claimant: {{client_name}}
Date of Loss: {{date_of_loss}}
Claim: {{claim}}

Dear {{recipient}},

Please be advised that this firm represents {{client_name}} in connection with a claim under the above-referenced policy. All further communications should be directed to our office.

Please confirm coverage, claim number, and adjuster contact information.

[FIRM — Replace this skeleton with your reviewed LOR template before releasing.]

Sincerely,
{{attorney_name}}
{{firm_name}}`,

  lor_provider: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]

Re: Notice of Representation / Authorization to Correspond
Patient: {{client_name}}
Date of Loss: {{date_of_loss}}

Dear {{provider_name}},

Please be advised that this firm represents {{client_name}} in connection with injuries arising from the above-referenced incident. You are hereby authorized to correspond with our office regarding treatment, records, and billing.

Please forward all records and bills to our office at your earliest convenience.

[FIRM — Replace this skeleton with your reviewed LOR template before releasing.]

Sincerely,
{{attorney_name}}
{{firm_name}}`,

  declination: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]

Re: Regarding Your Potential Claim
Date of Loss: {{date_of_loss}}

Dear {{client_name}},

Thank you for allowing our firm to review the details of your potential claim arising from the incident on {{date_of_loss}}.

After careful review, we are unable to accept representation in this matter at this time. This determination is not a reflection on the merit of your claim, and we encourage you to consult with other qualified counsel.

Please be aware of any applicable statute of limitations deadlines that may affect your rights.

[FIRM — Replace this skeleton with your reviewed declination template before releasing.]

Sincerely,
{{attorney_name}}
{{firm_name}}`,
};

export function renderTemplate(body: string, ctx: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] ?? '');
}

export async function getFirmTemplate(firmId: string, type: string): Promise<string | null> {
  const { data } = await supabase
    .from('templates')
    .select('body')
    .eq('firm_id', firmId)
    .eq('type', type)
    .limit(1);
  return data?.[0]?.body ?? null;
}

export async function draftLetter({
  caseId,
  firmId,
  type,
  subject,
  ctx,
  fallbackBody,
}: {
  caseId: string;
  firmId: string;
  type: string;
  subject: string;
  ctx: Record<string, string>;
  fallbackBody: string;
}): Promise<void> {
  const templateBody = await getFirmTemplate(firmId, type);
  const body = renderTemplate(templateBody ?? fallbackBody, ctx);
  await supabase.from('communications').insert({
    case_id: caseId,
    channel: 'email',
    requires_approval: true,
    status: 'queued',
    drafted_by: 'agent',
    subject,
    body,
  });
}
