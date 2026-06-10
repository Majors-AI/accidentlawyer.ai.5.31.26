// Placeholder — fleshed out in step 2 (Firm Directory). Reads from the shared
// firmSettings provider so the wiring is real even though the UI is a stub.
import { useFirmSettings } from '../../../../lib/firmSettings';

export default function FirmDirectory() {
  const { getEmployees } = useFirmSettings();
  const count = getEmployees().length;
  return (
    <div className="card">
      <h3>Firm Directory</h3>
      <p className="muted">Built in step 2.</p>
      <p className="tiny muted">{count} employees seeded in the shared settings store.</p>
    </div>
  );
}
