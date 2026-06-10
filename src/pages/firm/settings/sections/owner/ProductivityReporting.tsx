// Owner Portal § 3 — Firm-wide productivity reporting (scaffold). Ties to the
// per-employee reporting scaffolds in DepartmentSection: tasks handled / goals /
// attainment, by employee and department. Placeholder values; TODO real data.
import { useFirmSettings, DEPT_IDS, DEPT_LABELS, type DeptId } from '../../../../../lib/firmSettings';

export default function ProductivityReporting() {
  const { getEmployees } = useFirmSettings();
  const employees = getEmployees();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Firm-wide productivity</h3>
        <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
          {/* TODO(real data): tasks/goals/attainment per employee per department,
              from the step-5 task engine. Mirrors DepartmentSection's per-employee
              reporting scaffold, rolled up firm-wide. */}
          Scaffold — placeholder metrics. Real per-employee / per-department productivity ties to the
          task engine (same source as each department’s reporting).
        </p>
      </div>

      {/* By employee */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>By employee</h3>
        <table>
          <thead>
            <tr><th>Employee</th><th>Departments</th><th>Tasks handled</th><th>Goals set</th><th>Goal attainment</th></tr>
          </thead>
          <tbody>
            {employees.length === 0 && <tr><td colSpan={5} className="muted">No employees.</td></tr>}
            {employees.map(e => (
              <tr key={e.id}>
                <td>{e.fullName || <span className="muted">(unnamed)</span>}<div className="tiny muted">{e.title}</div></td>
                <td>{e.departmentIds.length ? e.departmentIds.map(d => DEPT_LABELS[d]).join(', ') : <span className="muted">—</span>}</td>
                <td className="muted">—</td>
                <td className="muted">—</td>
                <td className="muted">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* By department */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>By department</h3>
        <table>
          <thead>
            <tr><th>Department</th><th>Members</th><th>Tasks handled</th><th>Goal attainment</th></tr>
          </thead>
          <tbody>
            {DEPT_IDS.map((d: DeptId) => (
              <tr key={d}>
                <td>{DEPT_LABELS[d]}</td>
                <td>{employees.filter(e => e.departmentIds.includes(d)).length}</td>
                <td className="muted">—</td>
                <td className="muted">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
