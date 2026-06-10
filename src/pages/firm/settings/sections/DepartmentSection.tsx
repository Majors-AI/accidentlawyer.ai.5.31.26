// Reusable Department view (Settings § C, structural parts). One component
// serves Intake / Accounting / Legal via the deptId prop. Sections, top to
// bottom: color scheme (shared DeptSchemeControl), team-by-title, department
// settings (draft + single audited Save), and per-employee reporting (scaffold).
// Tasks / scores / case-type rules are step 5 — intentionally absent.
import { useState } from 'react';
import { useAuth } from '../../../../App';
import {
  useFirmSettings, WEEKDAYS, DEPT_LABELS, CASE_TYPES, US_STATES,
  type DeptId, type DepartmentConfig, type Employee, type Weekday, type CaseTypeAssignment,
} from '../../../../lib/firmSettings';
import { derivePermissions } from '../../../../lib/permissions';
import { schemeToVars } from '../../../../lib/theme';
import { autoAssign } from '../../../../lib/assignment';
import { DeptSchemeControl } from './WhiteLabel';

const caseTypeLabel = (v: string) => CASE_TYPES.find(c => c.value === v)?.label ?? v;
const emptyAssignment = (): CaseTypeAssignment => ({ allStates: true, states: [], caseTypes: [] });

// Editable subset of a department's config (the rest — id/label/enabled — isn't
// edited here). Saved in one shot so audit fires once per save, not per keystroke.
type DeptDraft = Pick<DepartmentConfig,
  'supervisorId' | 'hoursOfOperation' | 'lunch' | 'responseTemplates' | 'knowledgeBase'
  | 'tasks' | 'strengthScores' | 'caseTypeAssignments'>;

function toDraft(d: DepartmentConfig): DeptDraft {
  return {
    supervisorId: d.supervisorId,
    hoursOfOperation: d.hoursOfOperation,
    lunch: d.lunch,
    responseTemplates: d.responseTemplates,
    knowledgeBase: d.knowledgeBase,
    tasks: d.tasks,
    strengthScores: d.strengthScores,
    caseTypeAssignments: d.caseTypeAssignments,
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
  const [newTask, setNewTask] = useState('');
  const set = (patch: Partial<DeptDraft>) => setDraft(d => ({ ...d, ...patch }));

  const save = () => setDepartment(deptId, draft);   // single logChange in the store
  const reset = () => setDraft(toDraft(dept));

  // ---- assignment simulator (pure preview against the in-progress draft) ----
  const [simTaskId, setSimTaskId] = useState('');
  const [simState, setSimState] = useState('AZ');
  const [simCaseType, setSimCaseType] = useState('mva');
  const [simInitialContactId, setSimInitialContactId] = useState('');
  const [simOverrideId, setSimOverrideId] = useState('');

  // Per-member coverage helpers operating on the draft (immutable updates).
  const assignmentFor = (id: string): CaseTypeAssignment => draft.caseTypeAssignments[id] ?? emptyAssignment();
  const setAssignment = (id: string, patch: Partial<CaseTypeAssignment>) =>
    set({ caseTypeAssignments: { ...draft.caseTypeAssignments, [id]: { ...assignmentFor(id), ...patch } } });
  const toggleInArray = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  // Team grouped by title (the title field drives department team-by-title).
  const byTitle = new Map<string, Employee[]>();
  for (const m of members) {
    const t = m.title || 'Untitled';
    if (!byTitle.has(t)) byTitle.set(t, []);
    byTitle.get(t)!.push(m);
  }

  const fld = { disabled: !canEdit };

  // Run the pure engine against the in-progress draft + live members. Workloads
  // and availability are scaffold inputs (see assignment.ts TODOs); empty maps
  // mean every member is available with zero workload.
  const simTask = draft.tasks.find(t => t.id === simTaskId) ?? draft.tasks[0] ?? null;
  const simResult = simTask
    ? autoAssign({
        task: simTask,
        caseContext: { state: simState, caseType: simCaseType },
        members: members.map(m => ({ id: m.id })),
        scores: draft.strengthScores,
        caseTypeAssignments: draft.caseTypeAssignments,
        workloads: {},
        available: {},
        initialContactId: simInitialContactId || null,
        manualOverrideId: simOverrideId || null,
      })
    : null;
  const nameOf = (id: string | null) => (id ? (getEmployee(id)?.fullName ?? id) : null);

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

      {/* 5a — Auto-assign configuration (tasks, strength scores, case-type
            coverage). Same draft + single Save: one audited setDepartment call.
            TODO(governance): non-lawyers must not edit lawyer/attorney tasks —
            that lawyer-task gating is enforced in the department-specific steps
            (Legal especially); here, editing is gated by canManageDepartment. */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Auto-assign configuration</h3>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost sm" onClick={reset}>Reset</button>
              <button className="btn sm" onClick={save}>Save changes</button>
            </div>
          )}
        </div>
        <p className="tiny muted" style={{ marginTop: 4 }}>
          Scoped to {DEPT_LABELS[deptId]} only — scores and coverage here don’t affect other departments.
        </p>

        {/* Tasks */}
        <label style={{ marginTop: 12 }}>Task types</label>
        {draft.tasks.length === 0 && <p className="muted small">No task types yet.</p>}
        {draft.tasks.map((t, i) => (
          <div key={t.id} className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
            <input value={t.name} {...fld}
              onChange={e => set({ tasks: draft.tasks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', margin: 0, flex: '0 0 auto' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={t.isFollowUp} {...fld}
                onChange={e => set({ tasks: draft.tasks.map((x, j) => (j === i ? { ...x, isFollowUp: e.target.checked } : x)) })} />
              Follow-up
            </label>
            {canEdit && (
              <button className="btn ghost sm" style={{ flex: '0 0 auto', width: 'auto' }}
                onClick={() => set({ tasks: draft.tasks.filter((_, j) => j !== i) })}>Remove</button>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="row" style={{ alignItems: 'center' }}>
            <input placeholder="New task type (e.g. Demand letter)" value={newTask}
              onChange={e => setNewTask(e.target.value)} />
            <button className="btn ghost sm" style={{ flex: '0 0 auto', width: 'auto' }} disabled={!newTask.trim()}
              onClick={() => { set({ tasks: [...draft.tasks, { id: `task-${Date.now()}`, name: newTask.trim(), isFollowUp: false }] }); setNewTask(''); }}>
              Add task
            </button>
          </div>
        )}

        {/* Strength scores */}
        <label style={{ marginTop: 16 }}>Strength scores (0–100, this department)</label>
        {members.length === 0 && <p className="muted small">No members to score.</p>}
        {members.map(m => {
          const v = draft.strengthScores[m.id] ?? 0;
          return (
            <div key={m.id} className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
              <span style={{ flex: '0 0 160px', fontSize: 14 }}>{m.fullName || '(unnamed)'}</span>
              <input type="range" min={0} max={100} value={v} {...fld}
                onChange={e => set({ strengthScores: { ...draft.strengthScores, [m.id]: Number(e.target.value) } })} />
              <span style={{ flex: '0 0 36px', textAlign: 'right', fontSize: 13 }}><b>{v}</b></span>
            </div>
          );
        })}

        {/* Case-type assignment */}
        <label style={{ marginTop: 16 }}>Case-type assignment</label>
        {members.length === 0 && <p className="muted small">No members to assign.</p>}
        {members.map(m => {
          const a = assignmentFor(m.id);
          return (
            <div key={m.id} className="well" style={{ marginBottom: 10 }}>
              <b style={{ fontSize: 14 }}>{m.fullName || '(unnamed)'}</b>
              <div style={{ marginTop: 8 }}>
                <span className="tiny muted">Case types</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {CASE_TYPES.map(ct => (
                    <button key={ct.value} className={a.caseTypes.includes(ct.value) ? 'tag gold' : 'tag soft'}
                      disabled={!canEdit} style={{ border: 'none', cursor: canEdit ? 'pointer' : 'default' }}
                      onClick={() => canEdit && setAssignment(m.id, { caseTypes: toggleInArray(a.caseTypes, ct.value) })}>
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', marginTop: 10 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={a.allStates} {...fld}
                  onChange={e => setAssignment(m.id, { allStates: e.target.checked })} />
                All states
              </label>
              {!a.allStates && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {US_STATES.map(st => (
                    <button key={st} className={a.states.includes(st) ? 'tag gold' : 'tag soft'}
                      disabled={!canEdit} style={{ border: 'none', cursor: canEdit ? 'pointer' : 'default', padding: '2px 8px' }}
                      onClick={() => canEdit && setAssignment(m.id, { states: toggleInArray(a.states, st) })}>
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 5b — Assignment simulator (pure preview; runs autoAssign on the draft) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Assignment simulator</h3>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          Runs the auto-assign engine against the current (unsaved) configuration.
          Workload &amp; availability are scaffold inputs (every member available, zero workload).
        </p>
        <div className="row">
          <div>
            <label>Task</label>
            <select value={simTask?.id ?? ''} onChange={e => setSimTaskId(e.target.value)}>
              {draft.tasks.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.isFollowUp ? ' (follow-up)' : ''}</option>
              ))}
              {draft.tasks.length === 0 && <option value="">No tasks defined</option>}
            </select>
          </div>
          <div>
            <label>State</label>
            <select value={simState} onChange={e => setSimState(e.target.value)}>
              {US_STATES.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div>
            <label>Case type</label>
            <select value={simCaseType} onChange={e => setSimCaseType(e.target.value)}>
              {CASE_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label>Initial contact (for follow-up routing)</label>
            <select value={simInitialContactId} onChange={e => setSimInitialContactId(e.target.value)}>
              <option value="">— None —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.fullName || '(unnamed)'}</option>)}
            </select>
          </div>
          {canEdit && (
            <div>
              <label>Supervisor / super-admin override</label>
              <select value={simOverrideId} onChange={e => setSimOverrideId(e.target.value)}>
                <option value="">— No override —</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.fullName || '(unnamed)'}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="well" style={{ marginTop: 12 }}>
          {simResult ? (
            <>
              <div style={{ fontSize: 14 }}>
                Assignee:{' '}
                {simResult.assigneeId
                  ? <b>{nameOf(simResult.assigneeId)}</b>
                  : <span className="tag bad">Unassigned</span>}
              </div>
              <div className="tiny muted" style={{ marginTop: 4 }}>Reason: {simResult.reason}</div>
            </>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>Define a task type to run the simulator.</p>
          )}
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {/* TODO(real reassignment seam): assignment/override also runs from the
              client file in the File Cabinet (a separate page); persisting the
              chosen assignee and that wiring is a later/back-end touch. */}
          Reassignment also happens from the client file in the File Cabinet — that wiring is a later back-end touch.
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
