// Single source of truth for the Client Journey Framework.
// The bottom bar (JourneyBar) and the /journey route subtree both map over
// this array — so adding, removing, or reordering a stage is a one-line edit
// here, and the navigation and routes stay in sync automatically.
//
// Each stage also records which role CATEGORY may access it. The bar shows only
// the stages visible to the current profile, and the routes redirect away from
// stages the profile may not access — both driven entirely by this file.

// The three categories mirror the checks the existing App.tsx routing uses:
//   admin  → is_platform_admin === true
//   client → role === 'client'
//   firm   → otherwise (firm staff: attorney / staff / admin role)
export type RoleCategory = 'client' | 'firm' | 'admin';

export type JourneyStage = {
  id: number;
  label: string;
  path: string;
  // Lightweight inline SVG glyph (no icon library). Rendered inside the pill.
  icon: string;
  // Role categories permitted to view/open this stage. Empty = no owner yet.
  roles: RoleCategory[];
};

export const JOURNEY_STAGES: JourneyStage[] = [
  { id: 1, label: 'Firm Registration', path: '/journey/firm-registration', icon: '🏢', roles: ['admin'] },
  { id: 2, label: 'Client Registration', path: '/journey/client-registration', icon: '📝', roles: [] },
  { id: 3, label: 'Client Intake', path: '/journey/client-intake', icon: '📥', roles: ['client'] },
  { id: 4, label: 'Client Portal', path: '/journey/client-portal', icon: '👤', roles: ['client'] },
  { id: 5, label: 'Accounting Portal', path: '/journey/accounting-portal', icon: '💵', roles: ['firm'] },
  { id: 6, label: 'Legal Department Portal', path: '/journey/legal-portal', icon: '⚖️', roles: ['firm'] },
  { id: 7, label: 'File Cabinet', path: '/journey/file-cabinet', icon: '🗄️', roles: ['firm'] },
  { id: 8, label: 'Staff Training', path: '/journey/staff-training', icon: '🎓', roles: ['firm'] },
  { id: 9, label: 'Law Firm Settings', path: '/journey/law-firm-settings', icon: '⚙️', roles: ['firm'] },
  { id: 10, label: 'AccidentLawyer.AI Admin', path: '/journey/admin', icon: '🛡️', roles: ['admin'] },
];

// Per-category landing stage (where /journey and same-category redirects send
// the user): client → Client Portal (4), firm → Accounting (5), admin → Firm
// Registration (1). Each home is itself visible to that category above.
const HOME_STAGE_ID: Record<RoleCategory, number> = {
  client: 4,
  firm: 5,
  admin: 1,
};

// Structurally-typed subset of App.tsx's Profile — kept local so this module
// has no import cycle with App.tsx. Anything matching this shape works.
export interface JourneyProfile {
  role: string;
  is_platform_admin: boolean;
}

// The single mapping from a profile to its role category — the same precedence
// the app uses elsewhere: platform admin first, then client, else firm staff.
export function roleCategory(profile: JourneyProfile | null): RoleCategory | null {
  if (!profile) return null;
  if (profile.is_platform_admin) return 'admin';
  if (profile.role === 'client') return 'client';
  return 'firm';
}

// Stages the given profile is allowed to see/open (hidden, not locked).
export function visibleStages(profile: JourneyProfile | null): JourneyStage[] {
  const cat = roleCategory(profile);
  if (!cat) return [];
  return JOURNEY_STAGES.filter((s) => s.roles.includes(cat));
}

// The stage this profile lands on at /journey. Falls back to the firm home if
// the category is somehow unknown (the journey requires auth, so this is just a
// safety net).
export function homeStage(profile: JourneyProfile | null): JourneyStage {
  const cat = roleCategory(profile) ?? 'firm';
  const id = HOME_STAGE_ID[cat];
  return JOURNEY_STAGES.find((s) => s.id === id)!;
}

// Whether a profile may access a specific stage.
export function canAccessStage(profile: JourneyProfile | null, stage: JourneyStage): boolean {
  const cat = roleCategory(profile);
  return cat != null && stage.roles.includes(cat);
}
