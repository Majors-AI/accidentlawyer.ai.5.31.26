// SEAM — the single governance helper every settings surface calls. Mirrors the
// commsSender.ts seam style: typed predicates, derived from what we can read off
// the current profile today, with explicit TODO markers where the real backing
// data lands. NO destructive ops; this only ANSWERS questions, never mutates.

import type { DeptId } from './firmSettings';

// Structurally-typed subset of App.tsx's Profile — kept local so this helper
// has no import cycle with App.tsx. Anything matching this shape works.
export interface PermissionProfile {
  role: string;                 // 'attorney' | 'staff' | 'admin'
  is_platform_admin: boolean;
  // TODO(real backing data): is_firm_owner flag, title, department supervisor
  // mappings — none of these exist on `profiles` yet. They are stubbed below.
}

export type FuncKey = string;   // e.g. 'intake.accept', 'accounting.disburse'

export interface Permissions {
  isOwner: boolean;
  isSuperAdmin: boolean;
  isLawyer: boolean;
  isSupervisorOf: (deptId: DeptId) => boolean;
  canEditLawyerTasks: boolean;
  canApprove: (funcKey: FuncKey) => boolean;
  // Firm Directory (step 2): firm-wide management of employees.
  canManageDirectory: boolean;
  // White Label (step 3): firm-wide branding (logo + global/per-dept schemes).
  canManageBranding: boolean;
  // Department (step 4): may edit THIS department's settings. True for a
  // supervisor of that department, the firm owner, or a super-admin.
  canManageDepartment: (deptId: DeptId) => boolean;
  // Whether this user may edit a specific employee. Firm-wide today; the
  // department-supervisor path (edit only your own dept's members) is stubbed.
  canEditEmployee: (employeeDeptIds: DeptId[]) => boolean;
}

export function derivePermissions(profile: PermissionProfile | null): Permissions {
  const isSuperAdmin = !!profile?.is_platform_admin;

  // TODO(real backing data): firm owner is a distinct flag (e.g. profiles.is_firm_owner
  // or a firm_members.role = 'owner' row). For now we approximate: a super admin or
  // the firm 'admin' role is treated as owner-capable.
  const isOwner = isSuperAdmin || profile?.role === 'admin';

  // 'attorney' role -> lawyer today.
  // TODO(real backing data): also derive from title (e.g. "Of Counsel", "Partner")
  // once Employee.title-based lawyer detection is wired in the Directory step.
  const isLawyer = profile?.role === 'attorney';

  // TODO(real backing data): per-department supervisor mapping
  // (firm_members / department_supervisors). No source yet, so nobody is a
  // supervisor except owners (who supervise everything).
  const isSupervisorOf = (_deptId: DeptId): boolean => isOwner;

  // Only lawyers (or owners) may edit lawyer-owned tasks.
  const canEditLawyerTasks = isLawyer || isOwner;

  // Attorneys and owners may approve gated functions (e.g. 'disbursement');
  // non-lawyers cannot. Whether approval actually APPLIES to a given action is a
  // separate decision the caller makes by reading the firm's approvalGate slice.
  // TODO(real backing data): a per-function approval matrix could refine this
  // (e.g. some funcKeys restricted to owners), keyed by FuncKey.
  const canApprove = (_funcKey: FuncKey): boolean => isLawyer || isOwner;

  // Firm-wide directory management is owner/super-admin only today.
  const canManageDirectory = isOwner;

  // TODO(real backing data): branding is firm-wide and owner/super-admin only.
  // A dedicated firm-owner flag would replace the isOwner approximation here.
  const canManageBranding = isOwner;

  // A department's settings are editable by its supervisor, the owner, or a
  // super-admin. isSupervisorOf is still stubbed (see its TODO): the real check
  // needs the profile -> employee -> DepartmentConfig.supervisorId mapping, which
  // doesn't exist yet. Supervisors remain scoped to their own department.
  const canManageDepartment = (deptId: DeptId): boolean => isSupervisorOf(deptId) || isOwner;

  // TODO(real backing data): department supervisors should be able to edit only
  // the members of the department(s) they supervise. Once the supervisor mapping
  // exists, allow when employeeDeptIds intersects the supervisor's departments:
  //   employeeDeptIds.some(d => isSupervisorOf(d))
  // For now, only firm-wide managers may edit, regardless of department.
  const canEditEmployee = (_employeeDeptIds: DeptId[]): boolean => canManageDirectory;

  return {
    isOwner, isSuperAdmin, isLawyer, isSupervisorOf, canEditLawyerTasks, canApprove,
    canManageDirectory, canEditEmployee, canManageBranding, canManageDepartment,
  };
}
