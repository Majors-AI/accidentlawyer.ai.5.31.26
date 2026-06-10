// Reusable Department view (Settings § C, structural parts). One component
// serves Intake / Accounting / Legal via the deptId prop. Sections, top to
// bottom: color scheme (shared DeptSchemeControl), team-by-title, department
// settings (draft + single audited Save), and per-employee reporting (scaffold).
// Tasks / scores / case-type rules are step 5 — intentionally absent.
import { useState } from 'react';
import { useAuth } from '../../../../App';
import {
  useFirmSettings, WEEKDAYS, DEPT_LABELS,
  type DeptId, type DepartmentConfig, type Employee, type Weekday,
} from '../../../../lib/firmSettings';
import { derivePermissions } from '../../../../lib/permissions';
import { schemeToVars } from '../../../../lib/theme';
import { DeptSchemeControl } from './WhiteLabel';

// Editable subset of a department's config (the rest — id/label/enabled — isn't
// edited here). Saved in one shot so audit fires once per save, not per keystroke.
type DeptDraft = Pick<DepartmentConfig, 'supervisorId' | 'hoursOfOperation' | 'lunch' | 'responseTemplates' | 'knowledgeBase'>;

function toDraft(d: DepartmentConfig): DeptDraft {
  return {
    supervisorId: d.supervisorId,
    hoursOfOperation: d.hoursOfOperation,
    lunch: d.lunch,
    responseTemplates: d.responseTemplates,
    knowledgeBase: d.knowledgeBase,
  };
}

export default function DepartmentSection({ deptId }: { deptId: DeptId }) {
  const { profile } = useAuth();
  const canEdit = derivePermissions(profile).canManageDepartment(deptId);

  const { getDepartment, getDeptScheme, getEmployees, getEmployee, setDepartment } = useFirmSettings();
  const dept = getDepartment(deptId);
  const scheme = getDeptScheme(deptId);
  const members = getEmployees().filter(e => e.departmentIds.includes(deptId));

  const [draft, setDraft] = useState<DeptDraft>(() => toDraft(dept));
  const [newType, setNewType] = useState('');
  const [newKb, setNewKb] = useState('');
  const set = (patch: Partial<DeptDraft>) => setDraft(d => ({ ...d, ...patch }));

  const save = () => setDepartment(deptId, draft);   // single logChange in the store
  const reset = () => setDraft(toDraft(dept));

  // Team grouped by title (the title field drives department team-by-title).
  const byTitle = new Map<string, Employee[]>();
  for (const m of members) {
    const t = m.title || 'Untitled';
    if (!byTitle.has(t)) byTitle.set(t, []);
    byTitle.get(t)!.push(m);
  }

  const fld = { disabled: !canEdit };

  return (
    // The dept's own scheme is scoped to its own views via these CSS vars.
    // TODO(apply app-wide + persist): broad application of these vars across the
    // real app shell still lands later; here it only themes this subtree.
    <div style={{ ...schemeToVars(scheme), display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>{DEPT_LABELS[deptId]} department</h3>
        <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
          {members.length} {members.length === 1 ? 'member' : 'members'}
          {!canEdit && ' · read-only (supervisors of this department, owners, and admins can edit)'}
        </p>
      </div>

      {/* 1 — Color scheme (shared control; single source with White Label) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Color scheme</h3>
        <DeptSchemeControl deptId={deptId} />
      </div>

      {/* 2 — Team by title */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Team</h3>
        {members.length === 0 && <p className="muted small">No employees in this department yet.</p>}
        {[...byTitle.entries()].map(([title, group]) => (
          <div key={title} style={{ marginBottom: 12 }}>
            <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{title}</div>
            {group.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '3px 0' }}>
                <span>{m.fullName || <span className="muted">(unnamed)</span>}</span>
                <span className="muted small">{m.employmentType}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 3 — Department settings (draft + single Save) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Department settings</h3>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost sm" onClick={reset}>Reset</button>
              <button className="btn sm" onClick={save}>Save changes</button>
            </div>
          )}
        </div>

        {/* Supervisor */}
        <label style={{ marginTop: 16 }}>Supervisor</label>
        <select value={draft.supervisorId ?? ''} {...fld}
          onChange={e => set({ supervisorId: e.target.value || null })}>
          <option value="">— None —</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.fullName || '(unnamed)'} · {m.title}</option>
          ))}
        </select>
        {draft.supervisorId && !members.some(m => m.id === draft.supervisorId) && (
          <p className="tiny muted" style={{ marginTop: 4 }}>
            Current supervisor ({getEmployee(draft.supervisorId)?.fullName ?? draft.supervisorId}) is not a member of this department.
          </p>
        )}

        {/* Hours of operation */}
        <label style={{ marginTop: 16 }}>Hours of operation</label>
        {WEEKDAYS.map((day: Weekday) => (
          <div key={day} className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
            <span style={{ flex: '0 0 48px', textTransform: 'capitalize', fontSize: 13 }}>{day}</span>
            <input type="time" value={draft.hoursOfOperation.days[day].start} {...fld}
              onChange={e => set({ hoursOfOperation: { days: { ...draft.hoursOfOperation.days, [day]: { ...draft.hoursOfOperation.days[day], start: e.target.value } } } })} />
            <span style={{ flex: '0 0 16px', textAlign: 'center' }}>–</span>
            <input type="time" value={draft.hoursOfOperation.days[day].end} {...fld}
              onChange={e => set({ hoursOfOperation: { days: { ...draft.hoursOfOperation.days, [day]: { ...draft.hoursOfOperation.days[day], end: e.target.value } } } })} />
          </div>
        ))}
        <p className="tiny muted">Leave both blank for a closed day.</p>

        {/* Lunch */}
        <label style={{ marginTop: 12 }}>Lunch</label>
        <div className="row">
          <div>
            <span className="tiny muted">Start</span>
            <input type="time" value={draft.lunch.start} {...fld}
              onChange={e => set({ lunch: { ...draft.lunch, start: e.target.value } })} />
          </div>
          <div>
            <span className="tiny muted">Minutes</span>
            <input type="number" value={draft.lunch.minutes} {...fld}
              onChange={e => set({ lunch: { ...draft.lunch, minutes: Number(e.target.value) } })} />
          </div>
        </div>

        {/* Response templates */}
        <label style={{ marginTop: 16 }}>Response templates</label>
        {draft.responseTemplates.map((t, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: 13 }}>{t.type}</b>
              {canEdit && (
                <button className="btn ghost sm" style={{ width: 'auto' }}
                  onClick={() => set({ responseTemplates: draft.responseTemplates.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              )}
            </div>
            <textarea rows={2} value={t.body} {...fld} placeholder={`${t.type} message body…`}
              onChange={e => set({ responseTemplates: draft.responseTemplates.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
          </div>
        ))}
        {canEdit && (
          <div className="row" style={{ alignItems: 'center' }}>
            <input placeholder="New template type (e.g. Settlement Update)" value={newType}
              onChange={e => setNewType(e.target.value)} />
            <button className="btn ghost sm" style={{ flex: '0 0 auto', width: 'auto' }}
              disabled={!newType.trim()}
              onClick={() => { set({ responseTemplates: [...draft.responseTemplates, { type: newType.trim(), body: '' }] }); setNewType(''); }}>
              Add type
            </button>
          </div>
        )}

        {/* Knowledge base — scaffold */}
        <label style={{ marginTop: 16 }}>Knowledge base</label>
        {draft.knowledgeBase.length === 0 && <p className="muted small">No documents yet.</p>}
        {draft.knowledgeBase.map(kb => (
          <div key={kb.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span>{kb.name}</span>
            {canEdit && (
              <button className="btn ghost sm" style={{ width: 'auto' }}
                onClick={() => set({ knowledgeBase: draft.knowledgeBase.filter(k => k.id !== kb.id) })}>
                Remove
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="row" style={{ alignItems: 'center' }}>
            <input placeholder="Document name" value={newKb} onChange={e => setNewKb(e.target.value)} />
            <button className="btn ghost sm" style={{ flex: '0 0 auto', width: 'auto' }}
              disabled={!newKb.trim()}
              onClick={() => { set({ knowledgeBase: [...draft.knowledgeBase, { id: `kb-${Date.now()}`, name: newKb.trim() }] }); setNewKb(''); }}>
              Add document
            </button>
          </div>
        )}
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {/* TODO(real storage + AI sourcing): documents upload to storage and feed
              AI-drafted responses; both the upload and the AI drafting are backend
              TODO. This list is a name-only scaffold. */}
          Scaffold — real document upload/storage and AI-sourced drafting are backend TODO.
        </p>
      </div>

      {/* 4 — Per-employee reporting (scaffold). Dual columns per department for
            staff who belong to more than one department. */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Per-employee reporting</h3>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>By department</th>
              <th>Tasks handled</th>
              <th>Goals set</th>
              <th>Goal attainment</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={5} className="muted">No members to report on.</td></tr>
            )}
            {members.map(m => (
              // One row per (member × department they belong to) — a member in
              // multiple departments gets a row per dept (the "dual columns").
              m.departmentIds.map((dId, idx) => (
                <tr key={`${m.id}-${dId}`}>
                  {idx === 0 && (
                    <td rowSpan={m.departmentIds.length}>
                      {m.fullName || <span className="muted">(unnamed)</span>}
                      <div className="tiny muted">{m.title}</div>
                    </td>
                  )}
                  <td><span className={dId === deptId ? 'tag gold' : 'tag soft'}>{DEPT_LABELS[dId]}</span></td>
                  <td className="muted">—</td>
                  <td className="muted">—</td>
                  <td className="muted">—</td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {/* TODO(real reporting data): tasks/goals/attainment per employee per
              department land with the step-5 task + scoring engine. */}
          Scaffold — real per-employee, per-department reporting arrives with the step-5 task engine.
        </p>
      </div>
    </div>
  );
}
