// MOCK -- to be replaced by the real AccidentDoctor.AI API.
// The function signatures below are the seam: swap in a real implementation
// without changing any call sites in ProviderBridge.tsx.

export interface ProviderVisit {
  providerName: string;
  specialty: string;
  visitDate: string;     // YYYY-MM-DD
  cptCode: string;
  charge: number;
  summary: string;
}

export interface DischargeEvent {
  providerName: string;
  dischargeDate: string; // YYYY-MM-DD
}

export async function syncProviderUpdates(_caseId: string): Promise<ProviderVisit[]> {
  return [
    {
      providerName: 'Desert Spine & Rehab (DEMO)',
      specialty: 'Chiropractic',
      visitDate: '2025-03-12',
      cptCode: '98941',
      charge: 185,
      summary: 'Initial chiropractic eval. Cervical and lumbar pain following MVA. Adjustment at C4-C6 and L3-L5.',
    },
    {
      providerName: 'Valley Imaging Center (DEMO)',
      specialty: 'Radiology',
      visitDate: '2025-03-15',
      cptCode: '72148',
      charge: 420,
      summary: 'MRI lumbar spine without contrast. Mild disc bulge at L4-L5. No cord compression. Conservative management recommended.',
    },
  ];
}

export async function detectDischarge(_caseId: string): Promise<DischargeEvent> {
  return {
    providerName: 'Desert Spine & Rehab (DEMO)',
    dischargeDate: '2025-05-01',
  };
}

// -- Scene 13: reduction portal --

export interface ReductionResponse {
  decision: 'countered';
  agreed: number;
  note: string;
}

export async function requestReduction(input: {
  original: number;
  requested: number;
  providerName: string;
}): Promise<ReductionResponse> {
  const midpoint = Math.round((input.original + input.requested) / 2);
  return {
    decision: 'countered',
    agreed: midpoint,
    note: input.providerName + ' (DEMO) counters at $' + midpoint.toLocaleString() +
      ' -- midpoint between original and requested. Accept or negotiate further via the edit form.',
  };
}

// -- Scene 14: subpoena records --

export interface SubpoenaRecord {
  providerName: string;
  recordType: string;
  name: string;
}

export async function subpoenaRecords(_caseId: string): Promise<SubpoenaRecord[]> {
  return [
    {
      providerName: 'Desert Spine & Rehab (DEMO)',
      recordType: 'Treatment notes',
      name: 'Desert Spine Rehab -- treatment notes (subpoena) (DEMO).pdf',
    },
    {
      providerName: 'Valley Imaging Center (DEMO)',
      recordType: 'Imaging report',
      name: 'Valley Imaging Center -- MRI report (subpoena) (DEMO).pdf',
    },
  ];
}
