import { Link, useLocation } from 'react-router-dom';
import { JOURNEY_STAGES } from './stages';

// Fixed full-width bottom bar. Maps over JOURNEY_STAGES into numbered pills.
// The active stage is derived from the current route (not local state) so the
// highlight always reflects where you actually are. Scrolls horizontally on
// narrow widths.
export default function JourneyBar() {
  const { pathname } = useLocation();

  return (
    <nav className="journey-bar" aria-label="Client journey">
      <div className="journey-bar-track">
        {JOURNEY_STAGES.map((stage) => {
          const active = pathname === stage.path || pathname.startsWith(stage.path + '/');
          return (
            <Link
              key={stage.id}
              to={stage.path}
              className={'journey-pill' + (active ? ' active' : '')}
              aria-current={active ? 'page' : undefined}
              title={stage.label}
            >
              <span className="journey-pill-num">{stage.id}</span>
              <span className="journey-pill-icon" aria-hidden="true">{stage.icon}</span>
              <span className="journey-pill-label">{stage.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
