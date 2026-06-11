import { useAuth } from '../App';
import FirmBar from './FirmBar';

// Sidebar-less shell for firm users (modeled on AppShell / .journey-shell): a
// top header strip carrying the brand plus the signed-in user and Sign out, a
// WIDE content area for the routed firm page, and the single full-width bottom
// bar (FirmBar) that holds all firm navigation.
export default function FirmShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div className="firm-shell">
      <header className="firm-header">
        <div className="brand">
          Accident<span style={{ color: 'var(--color-electric-blue)' }}>Lawyer.ai</span>
        </div>
        <div className="firm-header-right">
          <div className="firm-who">
            <b>{profile?.full_name}</b>
            <span className="role">{profile?.role}</span>
          </div>
          <button
            className="btn ghost sm"
            style={{ color: 'rgba(240,250,242,.8)', borderColor: 'rgba(255,255,255,.18)' }}
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="firm-main">{children}</main>

      <FirmBar />
    </div>
  );
}
