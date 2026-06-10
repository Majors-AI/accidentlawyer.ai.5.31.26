// Placeholder — fleshed out in a later step (White Label). Reads the shared
// global scheme so it is provably the same slice the Department views use.
import { useFirmSettings } from '../../../../lib/firmSettings';

export default function WhiteLabel() {
  const { getWhiteLabel } = useFirmSettings();
  const { logoUrl, globalScheme } = getWhiteLabel();
  return (
    <div className="card">
      <h3>White Label</h3>
      <p className="muted">Built in a later step.</p>
      <p className="tiny muted">
        Logo: {logoUrl ?? 'none yet'} · Global primary {globalScheme.primary}
      </p>
    </div>
  );
}
