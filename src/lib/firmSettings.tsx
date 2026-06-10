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
import { logChange } from './auditLog';

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

export interface Contact {
  phone: string;
  email: string;
  address: string;
}

// Compensation scaffold. TODO(real persistence: Supabase) — this is sensitive
// payroll data; the real shape lives in a restricted table behind RLS, not the
// general settings blob, and may sync from a payroll provider.
export interface Compensation {
  type: 'salary' | 'hourly';
  rate: number;               // annual salary or hourly rate
  currency: string;           // e.g. 'USD'
  notes: string;
}

// Benefits flags + free-form notes (scaffold).
export interface Benefits {
  health: boolean;
  dental: boolean;
  vision: boolean;
  retirement401k: boolean;
  notes: string;
}

export type FmlaStatus = 'none' | 'eligible' | 'active' | 'exhausted';

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Per-day start/end as 'HH:MM' strings; empty start AND end = day off. Simple,
// directly editable in the UI without a date library.
export interface WorkHours {
  days: Record<Weekday, { start: string; end: string }>;
}

export interface LunchHours {
  start: string;              // 'HH:MM'
  minutes: number;            // length of lunch
}

// PTO / STO balance scaffold (hours-based). TODO(real reporting/accrual data).
export interface TimeOffBalance {
  balanceHours: number;
  notes: string;
}

// Extended in step 2 (Firm Directory). title drives department team-by-title
// grouping in later steps.
export interface Employee {
  id: string;
  fullName: string;
  title: string;
  contact: Contact;
  employmentType: EmploymentType;
  compensation: Compensation;
  benefits: Benefits;
  fmlaStatus: FmlaStatus;
  workHours: WorkHours;
  lunchHours: LunchHours;
  pto: TimeOffBalance;
  sto: TimeOffBalance;
  departmentIds: DeptId[];
}

// ---- factories ----------------------------------------------------------

function blankWorkHours(): WorkHours {
  const days = {} as WorkHours['days'];
  for (const d of WEEKDAYS) {
    // Mon–Fri default 09:00–17:00; weekend off.
    days[d] = (d === 'sat' || d === 'sun') ? { start: '', end: '' } : { start: '09:00', end: '17:00' };
  }
  return { days };
}

function blankEmployee(id: string): Employee {
  return {
    id,
    fullName: '',
    title: '',
    contact: { phone: '', email: '', address: '' },
    employmentType: 'FT',
    compensation: { type: 'salary', rate: 0, currency: 'USD', notes: '' },
    benefits: { health: false, dental: false, vision: false, retirement401k: false, notes: '' },
    fmlaStatus: 'none',
    workHours: blankWorkHours(),
    lunchHours: { start: '12:00', minutes: 60 },
    pto: { balanceHours: 0, notes: '' },
    sto: { balanceHours: 0, notes: '' },
    departmentIds: [],
  };
}

// A brandable theme-token set — enough to actually theme the UI. All hex.
// schemeToVars() (see theme.ts) maps these to CSS custom properties.
export interface ColorScheme {
  primary: string;            // primary action / brand color, e.g. '#0F77FF'
  accent: string;            // secondary highlight
  background: string;        // page background
  surface: string;           // card / panel background
  text: string;              // body text
  mutedText: string;         // secondary / muted text
}

// Keys of ColorScheme, in display order — drives the per-token input lists.
export const SCHEME_TOKENS: { key: keyof ColorScheme; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'mutedText', label: 'Muted text' },
];

export interface WhiteLabel {
  logoUrl: string | null;
  globalScheme: ColorScheme;
  // null for a dept = inherit the global scheme. Single source for dept colors.
  deptSchemes: Record<DeptId, ColorScheme | null>;
}

export interface ResponseTemplate {
  type: string;               // e.g. 'Case Update'; custom types allowed
  body: string;
}

// Scaffold — real upload/storage + AI sourcing is backend TODO.
export interface KnowledgeBaseEntry {
  id: string;
  name: string;
}

// The three named response-template types every department starts with.
export const DEFAULT_RESPONSE_TEMPLATE_TYPES = [
  'Case Update',
  'Request for Information',
  'Treatment Check-in',
] as const;

// Department-defined task type. isFollowUp routes back to the initial contact.
export interface DepartmentTask {
  id: string;
  name: string;
  isFollowUp: boolean;
}

// Which (state × case-type) combinations a member handles for THIS department.
// allStates = true means every state (members aren't forced to tick all 50).
export interface CaseTypeAssignment {
  allStates: boolean;
  states: string[];        // US state codes, used only when allStates is false
  caseTypes: string[];     // claim_type enum values (see CASE_TYPES)
}

// Case types sourced from the project's claim_type enum (supabase/schema.sql) —
// not a parallel invented list. Keep value strings in sync with that enum.
export const CASE_TYPES: { value: string; label: string }[] = [
  { value: 'mva', label: 'Motor vehicle accident' },
  { value: 'slip_and_fall', label: 'Slip and fall' },
  { value: 'negligence', label: 'Negligence' },
  { value: 'dog_bite', label: 'Dog bite' },
  { value: 'wrongful_death', label: 'Wrongful death' },
  { value: 'premises', label: 'Premises' },
  { value: 'other', label: 'Other' },
];

// US states + DC, for the state dimension of case-type assignment.
export const US_STATES: string[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export interface DepartmentConfig {
  id: DeptId;
  label: string;
  enabled: boolean;
  supervisorId: string | null;          // an employee id
  hoursOfOperation: WorkHours;           // reuses the per-weekday WorkHours shape
  lunch: LunchHours;
  responseTemplates: ResponseTemplate[];
  knowledgeBase: KnowledgeBaseEntry[];
  // Step 5 — auto-assign engine inputs. All scoped to THIS department (keyed by
  // employee id), so there is no cross-department bleed: a member's score and
  // case-type coverage in Legal are independent of the same member in Accounting.
  tasks: DepartmentTask[];
  strengthScores: Record<string, number>;                  // employeeId -> 0..100
  caseTypeAssignments: Record<string, CaseTypeAssignment>;  // employeeId -> coverage
}

function blankDepartment(id: DeptId): DepartmentConfig {
  return {
    id,
    label: DEPT_LABELS[id],
    enabled: true,
    supervisorId: null,
    hoursOfOperation: blankWorkHours(),
    lunch: { start: '12:00', minutes: 60 },
    responseTemplates: DEFAULT_RESPONSE_TEMPLATE_TYPES.map(type => ({ type, body: '' })),
    knowledgeBase: [],
    tasks: [
      { id: 'task-update', name: 'Case update', isFollowUp: false },
      { id: 'task-followup', name: 'Follow-up call', isFollowUp: true },
    ],
    strengthScores: {},
    caseTypeAssignments: {},
  };
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
    {
      ...blankEmployee('emp-1'),
      fullName: 'Dana Whitfield', title: 'Managing Partner', employmentType: 'FT',
      contact: { phone: '602-555-0101', email: 'dana@firm.example', address: '1 Firm Plaza, Phoenix AZ' },
      compensation: { type: 'salary', rate: 220000, currency: 'USD', notes: 'Equity partner' },
      departmentIds: ['legal', 'accounting'],
    },
    {
      ...blankEmployee('emp-2'),
      fullName: 'Marcus Lee', title: 'Intake Coordinator', employmentType: 'FT',
      contact: { phone: '602-555-0102', email: 'marcus@firm.example', address: '' },
      compensation: { type: 'hourly', rate: 28, currency: 'USD', notes: '' },
      departmentIds: ['intake'],
    },
    {
      ...blankEmployee('emp-3'),
      fullName: 'Priya Nair', title: 'Paralegal', employmentType: 'PT',
      contact: { phone: '602-555-0103', email: 'priya@firm.example', address: '' },
      compensation: { type: 'hourly', rate: 34, currency: 'USD', notes: '20 hrs/week' },
      departmentIds: ['legal'],
    },
  ],
  whiteLabel: {
    logoUrl: null,
    // Defaults mirror the existing app palette (midnight + electric blue + forest).
    globalScheme: {
      primary: '#0F77FF',
      accent: '#1A6B3A',
      background: '#F4F6FB',
      surface: '#FFFFFF',
      text: '#0B1F33',
      mutedText: '#5B6B7F',
    },
    deptSchemes: { intake: null, accounting: null, legal: null },
  },
  departments: {
    intake: {
      ...blankDepartment('intake'),
      supervisorId: 'emp-2',
      strengthScores: { 'emp-2': 70 },
      caseTypeAssignments: {
        'emp-2': { allStates: true, states: [], caseTypes: ['mva', 'slip_and_fall'] },
      },
    },
    accounting: blankDepartment('accounting'),
    legal: {
      ...blankDepartment('legal'),
      supervisorId: 'emp-1',
      strengthScores: { 'emp-1': 90, 'emp-3': 60 },
      caseTypeAssignments: {
        'emp-1': { allStates: true, states: [], caseTypes: ['mva', 'wrongful_death', 'negligence'] },
        'emp-3': { allStates: false, states: ['AZ'], caseTypes: ['mva', 'slip_and_fall'] },
      },
    },
  },
};

// ---- context + hook -----------------------------------------------------

export interface FirmSettingsApi {
  state: FirmSettingsState;

  // getters
  getEmployees: () => Employee[];
  getEmployee: (id: string) => Employee | undefined;
  getWhiteLabel: () => WhiteLabel;
  getDepartment: (id: DeptId) => DepartmentConfig;
  // Resolves a dept's effective scheme (its own, or the global it inherits).
  getDeptScheme: (id: DeptId) => ColorScheme;

  // employee updaters — each calls logChange. TODO(real persistence: Supabase).
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  addEmployee: () => string;                 // returns the new employee's id
  removeEmployee: (id: string) => void;
  addEmployeeToDept: (id: string, deptId: DeptId) => void;
  removeEmployeeFromDept: (id: string, deptId: DeptId) => void;

  // other updaters — TODO(real persistence: Supabase) each should write through.
  setEmployees: (next: Employee[]) => void;
  setLogoUrl: (url: string | null) => void;
  setGlobalScheme: (scheme: ColorScheme) => void;
  // null = inherit global. Single write-path for per-department colors.
  setDeptScheme: (id: DeptId, scheme: ColorScheme | null) => void;
  setDepartment: (id: DeptId, patch: Partial<DepartmentConfig>) => void;
}

const FirmSettingsCtx = createContext<FirmSettingsApi | null>(null);

// `actor` identifies who is making changes, so every logChange is attributable.
// FirmSettings passes the current profile; defaults to 'unknown' if absent.
export function FirmSettingsProvider({ actor = 'unknown', children }: { actor?: string; children: React.ReactNode }) {
  const [state, setState] = useState<FirmSettingsState>(SEED);

  const api = useMemo<FirmSettingsApi>(() => ({
    state,

    getEmployees: () => state.employees,
    getEmployee: (id) => state.employees.find(e => e.id === id),
    getWhiteLabel: () => state.whiteLabel,
    getDepartment: (id) => state.departments[id],
    getDeptScheme: (id) => state.whiteLabel.deptSchemes[id] ?? state.whiteLabel.globalScheme,

    updateEmployee: (id, patch) =>
      setState(s => {
        const before = s.employees.find(e => e.id === id);
        if (!before) return s;
        const after = { ...before, ...patch };
        logChange({ actor, action: 'update', target: `employee:${id}`, before, after });
        return { ...s, employees: s.employees.map(e => (e.id === id ? after : e)) };
      }),

    addEmployee: () => {
      // TODO(real persistence: Supabase) — server assigns the id; this is local.
      const id = `emp-${Date.now()}`;
      const fresh = blankEmployee(id);
      setState(s => {
        logChange({ actor, action: 'create', target: `employee:${id}`, before: null, after: fresh });
        return { ...s, employees: [...s.employees, fresh] };
      });
      return id;
    },

    removeEmployee: (id) =>
      setState(s => {
        const before = s.employees.find(e => e.id === id);
        if (!before) return s;
        logChange({ actor, action: 'delete', target: `employee:${id}`, before, after: null });
        return { ...s, employees: s.employees.filter(e => e.id !== id) };
      }),

    addEmployeeToDept: (id, deptId) =>
      setState(s => {
        const before = s.employees.find(e => e.id === id);
        if (!before || before.departmentIds.includes(deptId)) return s;
        const after = { ...before, departmentIds: [...before.departmentIds, deptId] };
        logChange({ actor, action: 'update', target: `employee:${id}.departments`, before: before.departmentIds, after: after.departmentIds });
        return { ...s, employees: s.employees.map(e => (e.id === id ? after : e)) };
      }),

    removeEmployeeFromDept: (id, deptId) =>
      setState(s => {
        const before = s.employees.find(e => e.id === id);
        if (!before || !before.departmentIds.includes(deptId)) return s;
        const after = { ...before, departmentIds: before.departmentIds.filter(d => d !== deptId) };
        logChange({ actor, action: 'update', target: `employee:${id}.departments`, before: before.departmentIds, after: after.departmentIds });
        return { ...s, employees: s.employees.map(e => (e.id === id ? after : e)) };
      }),

    setEmployees: (next) =>
      setState(s => ({ ...s, employees: next })),
    setLogoUrl: (url) =>
      setState(s => {
        // Log presence, not the (potentially huge) data URL itself.
        const desc = (u: string | null) => (u ? 'set' : 'cleared');
        logChange({ actor, action: 'update', target: 'whiteLabel.logoUrl', before: desc(s.whiteLabel.logoUrl), after: desc(url) });
        return { ...s, whiteLabel: { ...s.whiteLabel, logoUrl: url } };
      }),
    setGlobalScheme: (scheme) =>
      setState(s => {
        logChange({ actor, action: 'update', target: 'whiteLabel.globalScheme', before: s.whiteLabel.globalScheme, after: scheme });
        return { ...s, whiteLabel: { ...s.whiteLabel, globalScheme: scheme } };
      }),
    setDeptScheme: (id, scheme) =>
      setState(s => {
        logChange({ actor, action: 'update', target: `whiteLabel.deptScheme:${id}`, before: s.whiteLabel.deptSchemes[id], after: scheme });
        return {
          ...s,
          whiteLabel: { ...s.whiteLabel, deptSchemes: { ...s.whiteLabel.deptSchemes, [id]: scheme } },
        };
      }),
    setDepartment: (id, patch) =>
      setState(s => {
        const before = s.departments[id];
        const after = { ...before, ...patch };
        logChange({ actor, action: 'update', target: `department:${id}`, before, after });
        return { ...s, departments: { ...s.departments, [id]: after } };
      }),
  }), [state, actor]);

  return <FirmSettingsCtx.Provider value={api}>{children}</FirmSettingsCtx.Provider>;
}

export function useFirmSettings(): FirmSettingsApi {
  const ctx = useContext(FirmSettingsCtx);
  if (!ctx) throw new Error('useFirmSettings must be used within <FirmSettingsProvider>');
  return ctx;
}
