// Single source of truth for the Client Journey Framework.
// The bottom bar (JourneyBar) and the /journey route subtree both map over
// this array — so adding, removing, or reordering a stage is a one-line edit
// here, and the navigation and routes stay in sync automatically.

export type JourneyStage = {
  id: number;
  label: string;
  path: string;
  // Lightweight inline SVG glyph (no icon library). Rendered inside the pill.
  icon: string;
};

export const JOURNEY_STAGES: JourneyStage[] = [
  { id: 1, label: 'Firm Registration', path: '/journey/firm-registration', icon: '🏢' },
  { id: 2, label: 'Client Registration', path: '/journey/client-registration', icon: '📝' },
  { id: 3, label: 'Client Intake', path: '/journey/client-intake', icon: '📥' },
  { id: 4, label: 'Client Portal', path: '/journey/client-portal', icon: '👤' },
  { id: 5, label: 'Accounting Portal', path: '/journey/accounting-portal', icon: '💵' },
  { id: 6, label: 'Legal Department Portal', path: '/journey/legal-portal', icon: '⚖️' },
  { id: 7, label: 'File Cabinet', path: '/journey/file-cabinet', icon: '🗄️' },
  { id: 8, label: 'Staff Training', path: '/journey/staff-training', icon: '🎓' },
  { id: 9, label: 'Law Firm Settings', path: '/journey/law-firm-settings', icon: '⚙️' },
  { id: 10, label: 'AccidentLawyer.AI Admin', path: '/journey/admin', icon: '🛡️' },
];
