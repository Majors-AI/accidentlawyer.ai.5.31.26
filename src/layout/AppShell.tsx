import { Outlet } from 'react-router-dom';
import JourneyBar from '../journey/JourneyBar';

// Shared chrome for the Client Journey Framework: a top header strip, the
// routed stage page (<Outlet />), and the fixed bottom JourneyBar. Every
// /journey/* stage inherits this layout.
export default function AppShell() {
  return (
    <div className="journey-shell">
      <header className="journey-header">
        <div className="brand">
          Accident<span style={{ color: 'var(--color-electric-blue)' }}>Lawyer.ai</span>
          <small>Client Journey</small>
        </div>
      </header>

      <main className="journey-main">
        <Outlet />
      </main>

      <JourneyBar />
    </div>
  );
}
