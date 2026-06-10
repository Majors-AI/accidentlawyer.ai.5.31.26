// Shared placeholder body for the three department sections (Intake, Accounting,
// Legal). Reads the dept's effective color scheme from the shared firmSettings
// provider — the SAME slice White Label writes to — proving the single source.
import { useFirmSettings, type DeptId, DEPT_LABELS } from '../../../../lib/firmSettings';

export default function DepartmentSection({ deptId }: { deptId: DeptId }) {
  const { getDepartment, getDeptScheme, getWhiteLabel } = useFirmSettings();
  const dept = getDepartment(deptId);
  const scheme = getDeptScheme(deptId);
  const inherits = getWhiteLabel().deptSchemes[deptId] === null;
  return (
    <div className="card">
      <h3>{DEPT_LABELS[deptId]}</h3>
      <p className="muted">Built in a later step.</p>
      <p className="tiny muted">
        {dept.enabled ? 'Enabled' : 'Disabled'} · scheme primary {scheme.primary}
        {inherits ? ' (inherits global)' : ' (department override)'}
      </p>
    </div>
  );
}
