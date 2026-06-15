import { Outlet } from 'react-router-dom';
import JourneyBar from '../journey/JourneyBar';
import { useAuth } from '../App';

// Shared chrome for the Client Journey Framework: a top header strip, the
// routed stage page (<Outlet />), and the fixed bottom JourneyBar. Every
// /journey/* stage inherits this layout.
export default function AppShell() {
  // Reuse the shared signOut (supabase.auth.signOut() + redirect) exactly like
  // FirmShell — gives the logged-in client a clear way out of the portal.
  const { profile, signOut } = useAuth();

  return (
    <div className="journey-shell">
      <header className="journey-header">
        <div className="brand">
          Accident<span style={{ color: 'var(--color-electric-blue)' }}>Lawyer.ai</span>
          <small>Client Journey</small>
        </div>
        <div className="journey-user" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {profile?.full_name && (
            <span style={{ color: 'rgba(240,250,242,.85)', fontSize: 13, lineHeight: 1.1 }}>
              <b style={{ fontWeight: 600 }}>{profile.full_name}</b>
              <span style={{ opacity: .7, marginLeft: 6 }}>Client</span>
            </span>
          )}
          <button
            className="btn ghost sm"
            style={{ color: 'rgba(240,250,242,.8)', borderColor: 'rgba(255,255,255,.18)' }}
            onClick={signOut}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="journey-main">
        <Outlet />
      </main>

      <JourneyBar />
    </div>
  );
}
