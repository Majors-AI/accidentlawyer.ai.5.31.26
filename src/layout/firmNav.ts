// Single source of truth for the firm WORKING-NAV (the day-to-day app pages,
// distinct from the journey stages). Shared by the firm bottom bar (FirmBar)
// and the legacy sidebar grouping in Layout.tsx so labels/paths/order live in
// exactly one place.

export type FirmNavItem = { to: string; label: string; end?: boolean };

// Grouped for a sidebar-style render; the group headers are ignored by the
// flat bottom bar (see FIRM_NAV below).
export const FIRM_NAV_GROUPS: { group: string; items: FirmNavItem[] }[] = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard', end: true }] },
  { group: 'Caseload', items: [
    { to: '/cases', label: 'All cases' },
    { to: '/approvals', label: 'Approval inbox' },
    { to: '/legacy', label: 'Legacy import' },
  ] },
  { group: 'Firm', items: [
    { to: '/account', label: 'Account & billing' },
    { to: '/calendar', label: 'Calendar & deadlines' },
    { to: '/templates', label: 'Letter templates' },
    { to: '/reporting', label: 'Reporting' },
    // 'Firm settings' (/settings → <FirmSettings />) removed: it duplicates the
    // bottom journey bar's stage 9 "Law Firm Settings", which opens the same
    // <FirmSettings /> hub. The working-nav keeps only items the journey bar
    // does not already cover.
  ] },
];

// Flattened, in order — what the bottom bar renders as plain pills.
export const FIRM_NAV: FirmNavItem[] = FIRM_NAV_GROUPS.flatMap((g) => g.items);

// "Coming online" — scaffolded, no route yet. Shown as non-clickable pills.
export const FIRM_NAV_SOON: string[] = ['Dropbox backups', 'Trust accounting'];
