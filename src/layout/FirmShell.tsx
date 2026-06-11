import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../App';
import FirmBar from './FirmBar';
import { FIRM_NAV } from './firmNav';

// Sidebar-less shell for firm users: a top header strip carrying the brand,
// the day-to-day WORKING NAV (Dashboard, cases, etc. — distinct from the
// journey stages), and the signed-in user + Sign out; a WIDE content area for
// the routed firm page; and the single full-width bottom bar (FirmBar) that
// holds the client-journey stages.
export default function FirmShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div className="firm-shell">
      <header className="firm-header">
        <div className="firm-header-top">
          <Link to="/" className="brand">
            Accident<span style={{ color: 'var(--color-electric-blue)' }}>Lawyer.ai</span>
          </Link>
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
        </div>

        {/* Day-to-day working nav — the pages that lost their home when the
            sidebar was replaced by this shell. Journey stages live in FirmBar. */}
        <nav className="firm-nav" aria-label="Firm navigation">
          {FIRM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'firm-nav-link' + (isActive ? ' active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="firm-main">{children}</main>

      <FirmBar />
    </div>
  );
}
