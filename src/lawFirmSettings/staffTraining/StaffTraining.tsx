// Staff Training view (SCAFFOLD).
//
// Stage 8. Three things, per the catalog's Staff Training department:
//   1. Assign onboarding by role  — pick a role + employee, assign its modules.
//   2. Track module completion    — a per-trainee/per-module status tracker.
//   3. Competency sign-off        — a supervisor signs a completed assignment.
//
// In-memory only: reads modules/assignments from the staffTraining store
// (useSyncExternalStore) and the staff list from useFirmSettings(). Nothing is
// persisted or transmitted this pass. App.tsx wraps this in FirmSettingsProvider
// (like the Accounting/Legal stages) so useFirmSettings() resolves.

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useFirmSettings } from '../../lib/firmSettings';
import {
  subscribe, getModules, getAssignments,
  assignOnboardingByRole, advanceStatus, signOff, resetTraining,
} from './store';
import {
  ROLE_LABEL, TRAINING_ROLES,
  type TrainingRole, type TrainingStatus,
} from './types';

const STATUS_TAG: Record<TrainingStatus, string> = {
  assigned: 'soft', in_progress: 'gold', completed: 'good',
};
const STATUS_LABEL: Record<TrainingStatus, string> = {
  assigned: 'assigned', in_progress: 'in progress', completed: 'completed',
};
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '—');

export default function StaffTraining() {
  const { getEmployees, getEmployee } = useFirmSettings();
  const modules = useSyncExternalStore(subscribe, getModules);
  const assignments = useSyncExternalStore(subscribe, getAssignments);
  const employees = getEmployees();

  const moduleById = useMemo(
    () => new Map(modules.map((m) => [m.id, m])),
    [modules],
  );
  const empName = (id: string) => getEmployee(id)?.fullName ?? id;

  // ── Assign-by-role panel state ────────────────────────────────────────────
  const [role, setRole] = useState<TrainingRole>('all');
  const [assignee, setAssignee] = useState<string>(employees[0]?.id ?? '');
  const [assignMsg, setAssignMsg] = useState<string>('');

  function doAssign() {
    if (!assignee) return;
    const added = assignOnboardingByRole(role, assignee);
    setAssignMsg(
      added === 0
        ? `${empName(assignee)} already has all ${ROLE_LABEL[role]} modules.`
        : `Assigned ${added} module${added === 1 ? '' : 's'} to ${empName(assignee)}.`,
    );
  }

  // ── Sign-off inline form state (one open row at a time) ───────────────────
  const [signingId, setSigningId] = useState<string | null>(null);
  const [supId, setSupId] = useState<string>(employees[0]?.id ?? '');
  const [note, setNote] = useState<string>('');

  function openSignoff(id: string) {
    setSigningId(id); setSupId(employees[0]?.id ?? ''); setNote('');
  }
  function submitSignoff(id: string) {
    if (signOff(id, supId, note.trim())) { setSigningId(null); setNote(''); }
  }

  // Sort: trainee, then module sort order, for a stable tracker.
  const rows = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const an = empName(a.assigneeId), bn = empName(b.assigneeId);
      if (an !== bn) return an.localeCompare(bn);
      return (moduleById.get(a.moduleId)?.sortOrder ?? 0) - (moduleById.get(b.moduleId)?.sortOrder ?? 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, moduleById]);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Staff Training</h1>
          <div className="sub">Assign onboarding, track completion, and sign off competency</div>
        </div>
        <button className="btn ghost" onClick={() => { resetTraining(); setAssignMsg(''); }}>
          Reset to seed
        </button>
      </div>

      {/* 1 — Assign onboarding by role */}
      <div className="card" style={{ maxWidth: 720 }}>
        <h3 style={{ marginTop: 0 }}>Assign onboarding by role</h3>
        <p className="muted tiny" style={{ marginTop: 0 }}>
          Assigns every active module for the selected role (plus all-staff modules) to the employee.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 1 220px' }}>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as TrainingRole)}>
              {TRAINING_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 240px' }}>
            <label>Employee</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {employees.length === 0 && <option value="">No employees</option>}
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName || '(unnamed)'}{emp.title ? ` — ${emp.title}` : ''}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" disabled={!assignee} onClick={doAssign}>Assign onboarding</button>
        </div>
        {assignMsg && <div className="muted small" style={{ marginTop: 10 }}>{assignMsg}</div>}
      </div>

      {/* 2 & 3 — Tracker + competency sign-off */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr>
            <th>Trainee</th><th>Module</th><th>Status</th><th>Completed</th><th>Competency sign-off</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No assignments yet.</td></tr>}
            {rows.map((a) => {
              const m = moduleById.get(a.moduleId);
              const signing = signingId === a.id;
              return (
                <tr key={a.id}>
                  <td><b>{empName(a.assigneeId)}</b></td>
                  <td className="small">
                    {m?.title ?? a.moduleId}
                    {m && <div className="muted tiny">{ROLE_LABEL[m.targetRole]}</div>}
                  </td>
                  <td>
                    <span className={`tag ${STATUS_TAG[a.status]} tiny`}>{STATUS_LABEL[a.status]}</span>
                    {a.status !== 'completed' && (
                      <button className="btn ghost sm" style={{ marginLeft: 8 }}
                        onClick={() => advanceStatus(a.id)}>
                        {a.status === 'assigned' ? 'Start' : 'Mark complete'}
                      </button>
                    )}
                  </td>
                  <td className="small">{fmtDate(a.completedAt)}</td>
                  <td className="small">
                    {a.signoff ? (
                      <div>
                        <span className="tag good tiny" style={{ marginRight: 6 }}>signed</span>
                        {empName(a.signoff.supervisorId)} · {fmtDate(a.signoff.signedAt)}
                        {a.signoff.note && <div className="muted tiny">“{a.signoff.note}”</div>}
                      </div>
                    ) : a.status !== 'completed' ? (
                      <span className="muted tiny">Awaiting completion</span>
                    ) : signing ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={supId} onChange={(e) => setSupId(e.target.value)}>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.fullName || '(unnamed)'}</option>
                          ))}
                        </select>
                        <input value={note} onChange={(e) => setNote(e.target.value)}
                          placeholder="Competency note" style={{ width: 200 }} />
                        <button className="btn sm" disabled={!supId} onClick={() => submitSignoff(a.id)}>Sign off</button>
                        <button className="btn ghost sm" onClick={() => setSigningId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn ghost sm" onClick={() => openSignoff(a.id)}>Sign off competency</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
