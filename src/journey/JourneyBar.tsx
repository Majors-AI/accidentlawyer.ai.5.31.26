import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { visibleStages } from './stages';

// Fixed full-width bottom bar. Renders only the stages visible to the current
// profile (others are hidden, not locked). No leading stage number is shown
// here: a role sees only a subset of stages, so numbers like "3"/"4" read as
// "stages missing". Icon + label + active highlight only. (FirmBar keeps its
// numbering — it shows the full sequence.) The active stage is derived from the
// current route (not local state). Scrolls horizontally on narrow widths.
export default function JourneyBar() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const stages = visibleStages(profile);

  return (
    <nav className="journey-bar" aria-label="Client journey">
      <div className="journey-bar-track">
        {stages.map((stage) => {
          const active = pathname === stage.path || pathname.startsWith(stage.path + '/');
          return (
            <Link
              key={stage.id}
              to={stage.path}
              className={'journey-pill' + (active ? ' active' : '')}
              aria-current={active ? 'page' : undefined}
              title={stage.label}
            >
              <span className="journey-pill-icon" aria-hidden="true">{stage.icon}</span>
              <span className="journey-pill-label">{stage.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
