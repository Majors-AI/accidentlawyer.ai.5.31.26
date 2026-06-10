// Owner Portal § 1 — Approval gates. Config UI for the same approvalGate slice
// Accounting already reads. Writes via the audited setApprovalGate. Owner-only
// (the route is guarded in FirmSettings; this assumes an owner is viewing).
import { useFirmSettings, APPROVAL_GATE_KEYS, type ApproverMode } from '../../../../../lib/firmSettings';

export default function ApprovalGates() {
  const { getApprovalGate, setApprovalGate, getEmployees } = useFirmSettings();
  const employees = getEmployees();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Approval gates</h3>
        <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
          Require approval before a gated action takes effect. Departments read these — Accounting’s
          disbursement release already honors the disbursement gate.
        </p>
      </div>

      {APPROVAL_GATE_KEYS.map(({ key, label }) => {
        const gate = getApprovalGate(key);
        const mode: ApproverMode = gate.approverMode ?? 'supervising_attorney';
        return (
          <div className="card" key={key} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{label}</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', margin: 0 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={gate.requiresApproval}
                  onChange={e => setApprovalGate(key, { ...gate, requiresApproval: e.target.checked, approverMode: gate.approverMode ?? 'supervising_attorney' })} />
                Requires approval
              </label>
            </div>

            {gate.requiresApproval && (
              <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
                <div>
                  <label>Approver</label>
                  <select value={mode}
                    onChange={e => {
                      const next = e.target.value as ApproverMode;
                      setApprovalGate(key, { ...gate, approverMode: next, approverId: next === 'specific' ? gate.approverId : undefined });
                    }}>
                    <option value="supervising_attorney">Supervising attorney</option>
                    <option value="specific">Specific employee</option>
                  </select>
                </div>
                {mode === 'specific' && (
                  <div>
                    <label>Employee</label>
                    <select value={gate.approverId ?? ''}
                      onChange={e => setApprovalGate(key, { ...gate, approverId: e.target.value || undefined })}>
                      <option value="">— Select employee —</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullName || '(unnamed)'} · {emp.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="card" style={{ marginBottom: 0 }}>
        <p className="tiny muted" style={{ margin: 0 }}>
          {/* TODO(refinement): enforcing a SPECIFIC approver end-to-end (vs the
              current canApprove = attorney/owner) requires wiring approverMode /
              approverId into the approval check. Today departments only read
              requiresApproval; the approver choice is recorded for that refinement. */}
          Note: today departments enforce only <b>requiresApproval</b> (approval needed at all). Routing
          to a <b>specific</b> approver end-to-end is a refinement TODO; the choice is recorded now.
        </p>
      </div>
    </div>
  );
}
