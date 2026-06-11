// Action Templates / Send Queue — seed matter + firm profile (SCAFFOLD).
//
// No DB this pass: the merge context is built from this seeded matter. Carriers
// and providers are arrays so document generation fans out one doc per carrier
// (LOR) and per provider (records/bills). TODO(real data: Supabase) — replace
// with a real matter loaded by id and the firm's profile row.

export interface MatterClient {
  fullName: string;
  dob: string;
}

export interface Carrier {
  id: string;
  kind: 'liability' | 'um';
  name: string;
  address: string;
  claimNo: string;
  adjuster: string;
  insuredName: string;
}

export interface Provider {
  id: string;
  name: string;
  address: string;
  kind: string; // ER, ortho, PT, ...
}

export interface Matter {
  id: string;
  number: string;
  dateOfIncident: string;
  client: MatterClient;
  carriers: Carrier[];
  providers: Provider[];
  hipaaAuthRef: string;
  recordsDateRange: string;
}

// Firm-level merge inputs (name/letterhead/attorney). Distinct from
// FirmTaskConfig (automation), which carries no letterhead/attorney identity.
export interface FirmProfile {
  name: string;
  letterhead: string;
  attorney: { name: string; barNo: string };
}

export const SEED_FIRM_PROFILE: FirmProfile = {
  name: 'Majors Law Group',
  letterhead: 'Majors Law Group · 100 N Central Ave, Suite 1200 · Phoenix, AZ 85004',
  attorney: { name: 'Dominic Majors', barNo: 'AZ-034512' },
};

export const SEED_MATTER: Matter = {
  id: 'matter-seed-001',
  number: 'MLG-2026-0142',
  dateOfIncident: '2026-02-18',
  client: { fullName: 'Maria Delgado', dob: '1991-07-03' },
  hipaaAuthRef: 'HIPAA-AUTH-0142-A',
  recordsDateRange: '2026-02-18 to present',
  carriers: [
    {
      id: 'car-liab', kind: 'liability', name: 'Statewide Mutual Insurance',
      address: 'Claims Dept, PO Box 4410, Tempe, AZ 85280',
      claimNo: 'SM-99431187', adjuster: 'R. Halloran', insuredName: 'Gregory Pike',
    },
    {
      id: 'car-um', kind: 'um', name: 'Desert Sun Casualty (UM/UIM)',
      address: 'UM Claims, 2200 E Camelback Rd, Phoenix, AZ 85016',
      claimNo: 'DSC-UM-55218', adjuster: 'T. Okafor', insuredName: 'Maria Delgado',
    },
  ],
  providers: [
    { id: 'prov-er', name: 'Banner Desert Emergency Dept', address: '1400 S Dobson Rd, Mesa, AZ 85202', kind: 'ER' },
    { id: 'prov-ortho', name: 'Valley Orthopedic Associates', address: '3800 N 3rd St, Phoenix, AZ 85012', kind: 'Orthopedics' },
    { id: 'prov-pt', name: 'Sonoran Physical Therapy', address: '910 E Indian School Rd, Phoenix, AZ 85014', kind: 'Physical Therapy' },
  ],
};
