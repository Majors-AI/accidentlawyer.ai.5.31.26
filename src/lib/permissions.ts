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

  // TODO(real backing data): per-function approval matrix keyed by FuncKey and
  // department supervisor mapping. For now owners can approve anything; lawyers
  // can approve their own legal functions; everyone else cannot approve.
  const canApprove = (funcKey: FuncKey): boolean => {
    if (isOwner) return true;
    if (isLawyer && funcKey.startsWith('legal.')) return true;
    return false;
  };

  return { isOwner, isSuperAdmin, isLawyer, isSupervisorOf, canEditLawyerTasks, canApprove };
}
