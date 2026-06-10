// Law Firm Settings hub. A persistent LEFT SUB-NAV (separate from the main app
// sidebar in Layout.tsx) plus nested routes under /settings. Wrapped in the
// firmSettings provider so every section reads/writes one source of truth.
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../../App';
import { FirmSettingsProvider } from '../../../lib/firmSettings';
import { derivePermissions } from '../../../lib/permissions';
import FirmDirectory from './sections/FirmDirectory';
import WhiteLabel from './sections/WhiteLabel';
import Intake from './sections/Intake';
import Accounting from './sections/Accounting';
import Legal from './sections/Legal';
import ApprovalGates from './sections/owner/ApprovalGates';
import AccountingReporting from './sections/owner/AccountingReporting';
import ProductivityReporting from './sections/owner/ProductivityReporting';
import SuperAdminGrants from './sections/owner/SuperAdminGrants';

// Top-to-bottom order is the spec'd order.
const SUB_NAV: { to: string; label: string }[] = [
  { to: 'directory', label: 'Firm Directory' },
  { to: 'white-label', label: 'White Label' },
  { to: 'intake', label: 'Intake' },
  { to: 'accounting', label: 'Accounting' },
  { to: 'legal', label: 'Legal' },
];

// Owner-only sections — shown in the same hub nav, gated by isOwner.
const OWNER_NAV: { to: string; label: string }[] = [
  { to: 'approval-gates', label: 'Approval gates' },
  { to: 'accounting-reporting', label: 'Accounting reporting' },
  { to: 'productivity', label: 'Productivity reporting' },
  { to: 'super-admin-grants', label: 'Super-admin grants' },
];

export default function FirmSettings() {
  const { profile } = useAuth();
  const actor = profile?.full_name || profile?.id || 'unknown';
  const isOwner = derivePermissions(profile).isOwner;
  return (
    <FirmSettingsProvider actor={actor}>
      <div className="page-h">
        <div className="page-h-left">
          <h1>Firm settings</h1>
          <div className="sub">Directory, white label & department configuration</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Persistent sub-nav — housed in a midnight panel so the reused .nav /
            .group classes (styled for a dark background) render correctly. */}
        <aside
          style={{
            flex: '0 0 200px',
            background: 'linear-gradient(170deg,var(--color-midnight-ink) 0%,var(--color-midnight-deep) 100%)',
            borderRadius: 'var(--radius-cards)',
            padding: '14px 12px',
            position: 'sticky',
            top: 24,
          }}
        >
          <nav className="nav">
            <div className="group">Settings</div>
            {SUB_NAV.map(item => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
            {/* Owner Portal — same hub nav, only when isOwner */}
            {isOwner && (
              <>
                <div className="group">Owner</div>
                {OWNER_NAV.map(item => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Routes>
            <Route index element={<Navigate to="directory" replace />} />
            <Route path="directory" element={<FirmDirectory />} />
            <Route path="white-label" element={<WhiteLabel />} />
            <Route path="intake" element={<Intake />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="legal" element={<Legal />} />
            {/* Owner-only routes — guarded; non-owners fall through to redirect */}
            {isOwner && (
              <>
                <Route path="approval-gates" element={<ApprovalGates />} />
                <Route path="accounting-reporting" element={<AccountingReporting />} />
                <Route path="productivity" element={<ProductivityReporting />} />
                <Route path="super-admin-grants" element={<SuperAdminGrants />} />
              </>
            )}
            <Route path="*" element={<Navigate to="directory" replace />} />
          </Routes>
        </div>
      </div>
    </FirmSettingsProvider>
  );
}
