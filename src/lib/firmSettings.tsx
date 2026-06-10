// SEAM — the single in-memory source of truth for the Law Firm Settings portal.
// Mirrors the seam style of commsSender.ts / accidentDoctorBridge.ts: clear
// interfaces + a mock implementation now, with explicit swap-in points.
// TODO(real persistence: Supabase) — load/save this shape from `firm_settings`
// (and related) tables, scoped by firm_id, instead of the seeded mock below.
//
// Why one provider holds the WHOLE shape: every later settings step (Directory,
// White Label, Intake/Accounting/Legal) writes into the same slice. In
// particular the per-department color scheme lives HERE so White Label and each
// Department view read/write the same data — not two competing copies.

import { createContext, useContext, useMemo, useState } from 'react';

// ---- shared identifiers -------------------------------------------------

export type DeptId = 'intake' | 'accounting' | 'legal';
export const DEPT_IDS: DeptId[] = ['intake', 'accounting', 'legal'];
export const DEPT_LABELS: Record<DeptId, string> = {
  intake: 'Intake',
  accounting: 'Accounting',
  legal: 'Legal',
};

// ---- top-level shape ----------------------------------------------------

export type EmploymentType = 'FT' | 'PT';

// Minimal field set now — the Directory step (step 2) extends this.
export interface Employee {
  id: string;
  fullName: string;
  title: string;
  contact: string;            // email or phone, free-form for now
  employmentType: EmploymentType;
  // TODO(Directory step): departments, supervisorOf, startDate, status, etc.
}

// A brandable palette. Kept deliberately small; the White Label step refines it.
export interface ColorScheme {
  primary: string;            // hex, e.g. '#0F77FF'
  accent: string;
  text: string;
}

export interface WhiteLabel {
  logoUrl: string | null;
  globalScheme: ColorScheme;
  // null for a dept = inherit the global scheme. Single source for dept colors.
  deptSchemes: Record<DeptId, ColorScheme | null>;
}

// Stub config now — each Department step fleshes out its own fields.
export interface DepartmentConfig {
  id: DeptId;
  label: string;
  enabled: boolean;
  // TODO(Department steps): supervisorIds, queues, SLAs, function toggles, etc.
}

export interface FirmSettingsState {
  employees: Employee[];
  whiteLabel: WhiteLabel;
  departments: Record<DeptId, DepartmentConfig>;
}

// ---- seeded mock data ---------------------------------------------------
// TODO(real persistence: Supabase) — replace with a fetch on mount.

const SEED: FirmSettingsState = {
  employees: [
    { id: 'emp-1', fullName: 'Dana Whitfield', title: 'Managing Partner', contact: 'dana@firm.example', employmentType: 'FT' },
    { id: 'emp-2', fullName: 'Marcus Lee', title: 'Intake Coordinator', contact: 'marcus@firm.example', employmentType: 'FT' },
    { id: 'emp-3', fullName: 'Priya Nair', title: 'Paralegal', contact: 'priya@firm.example', employmentType: 'PT' },
  ],
  whiteLabel: {
    logoUrl: null,
    globalScheme: { primary: '#0F77FF', accent: '#1A6B3A', text: '#0B1F33' },
    deptSchemes: { intake: null, accounting: null, legal: null },
  },
  departments: {
    intake: { id: 'intake', label: DEPT_LABELS.intake, enabled: true },
    accounting: { id: 'accounting', label: DEPT_LABELS.accounting, enabled: true },
    legal: { id: 'legal', label: DEPT_LABELS.legal, enabled: true },
  },
};

// ---- context + hook -----------------------------------------------------

export interface FirmSettingsApi {
  state: FirmSettingsState;

  // getters
  getEmployees: () => Employee[];
  getWhiteLabel: () => WhiteLabel;
  getDepartment: (id: DeptId) => DepartmentConfig;
  // Resolves a dept's effective scheme (its own, or the global it inherits).
  getDeptScheme: (id: DeptId) => ColorScheme;

  // updaters — TODO(real persistence: Supabase) each should also write through.
  setEmployees: (next: Employee[]) => void;
  setLogoUrl: (url: string | null) => void;
  setGlobalScheme: (scheme: ColorScheme) => void;
  // null = inherit global. Single write-path for per-department colors.
  setDeptScheme: (id: DeptId, scheme: ColorScheme | null) => void;
  setDepartment: (id: DeptId, patch: Partial<DepartmentConfig>) => void;
}

const FirmSettingsCtx = createContext<FirmSettingsApi | null>(null);

export function FirmSettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FirmSettingsState>(SEED);

  const api = useMemo<FirmSettingsApi>(() => ({
    state,

    getEmployees: () => state.employees,
    getWhiteLabel: () => state.whiteLabel,
    getDepartment: (id) => state.departments[id],
    getDeptScheme: (id) => state.whiteLabel.deptSchemes[id] ?? state.whiteLabel.globalScheme,

    setEmployees: (next) =>
      setState(s => ({ ...s, employees: next })),
    setLogoUrl: (url) =>
      setState(s => ({ ...s, whiteLabel: { ...s.whiteLabel, logoUrl: url } })),
    setGlobalScheme: (scheme) =>
      setState(s => ({ ...s, whiteLabel: { ...s.whiteLabel, globalScheme: scheme } })),
    setDeptScheme: (id, scheme) =>
      setState(s => ({
        ...s,
        whiteLabel: { ...s.whiteLabel, deptSchemes: { ...s.whiteLabel.deptSchemes, [id]: scheme } },
      })),
    setDepartment: (id, patch) =>
      setState(s => ({
        ...s,
        departments: { ...s.departments, [id]: { ...s.departments[id], ...patch } },
      })),
  }), [state]);

  return <FirmSettingsCtx.Provider value={api}>{children}</FirmSettingsCtx.Provider>;
}

export function useFirmSettings(): FirmSettingsApi {
  const ctx = useContext(FirmSettingsCtx);
  if (!ctx) throw new Error('useFirmSettings must be used within <FirmSettingsProvider>');
  return ctx;
}
