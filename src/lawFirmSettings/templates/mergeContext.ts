// Action Templates — merge context + renderer (SCAFFOLD).

import type { Carrier, FirmProfile, Matter, Provider } from '../seedMatter';
import type { DocTemplate } from './types';

const today = () => new Date().toISOString().slice(0, 10);

// Base context shared by every document for a matter (firm + client + matter).
// Recipient-specific keys (carrier.* / provider.*) are layered on per document
// by carrierContext / providerContext below.
export function buildMergeContext(matter: Matter, firm: FirmProfile): Record<string, string> {
  return {
    'firm.name': firm.name,
    'firm.letterhead': firm.letterhead,
    'attorney.name': firm.attorney.name,
    'attorney.barNo': firm.attorney.barNo,
    'client.fullName': matter.client.fullName,
    'client.dob': matter.client.dob,
    'patient.fullName': matter.client.fullName, // records/bills address the client as patient
    'patient.dob': matter.client.dob,
    'matter.number': matter.number,
    'matter.dateOfIncident': matter.dateOfIncident,
    'records.dateRange': matter.recordsDateRange,
    'hipaa.authRef': matter.hipaaAuthRef,
    'billing.itemizedRequest': 'Yes — itemized statement requested',
    'today': today(),
  };
}

export function carrierContext(c: Carrier): Record<string, string> {
  return {
    'carrier.name': c.name,
    'carrier.address': c.address,
    'carrier.claimNo': c.claimNo,
    'carrier.adjuster': c.adjuster,
    'insured.name': c.insuredName,
  };
}

export function providerContext(p: Provider): Record<string, string> {
  return {
    'provider.name': p.name,
    'provider.address': p.address,
  };
}

const TOKEN = /\{\{\s*([\w.]+)\s*\}\}/g;

export interface RenderResult {
  subject?: string;
  body: string;
  missingFields: string[]; // required fields with no value in context
}

// Replace {{dotted.key}} tokens from ctx. A required field (per the template's
// `fields`) with no value lands in missingFields; its token is left visible as
// {{key}} so the gap is obvious in the preview.
export function renderTemplate(tpl: DocTemplate, ctx: Record<string, string>): RenderResult {
  const missing = new Set<string>();

  // Required fields absent from context, regardless of whether they're tokened.
  for (const f of tpl.fields) {
    if (f.required && !ctx[f.key]) missing.add(f.key);
  }

  const sub = (text: string) =>
    text.replace(TOKEN, (_m, key: string) => {
      const v = ctx[key];
      return v != null && v !== '' ? v : `{{${key}}}`;
    });

  return {
    subject: tpl.subject ? sub(tpl.subject) : undefined,
    body: sub(tpl.body),
    missingFields: [...missing],
  };
}
