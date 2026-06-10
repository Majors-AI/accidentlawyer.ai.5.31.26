// Firm Directory (Settings § A). Master list of employees + an editable detail
// panel. Reads/writes the single firmSettings store; every mutation flows
// through the store's updaters, which call logChange (audit). Editing is gated
// by permissions.ts — non-permitted roles get a read-only view.
import { useState } from 'react';
import { useAuth } from '../../../../App';
import {
  useFirmSettings, WEEKDAYS, DEPT_IDS, DEPT_LABELS,
  type Employee, type DeptId, type Weekday,
} from '../../../../lib/firmSettings';
import { derivePermissions } from '../../../../lib/permissions';

export default function FirmDirectory() {
  const { profile } = useAuth();
  const perms = derivePermissions(profile);
  const { getEmployees, addEmployee } = useFirmSettings();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const employees = getEmployees();
  const selected = selectedId ? employees.find(e => e.id === selectedId) : null;

  if (selected) {
    // canManageDirectory is firm-wide; canEditEmployee leaves room for the
    // department-supervisor path (TODO in permissions.ts).
    const readOnly = !perms.canEditEmployee(selected.departmentIds);
    return (
      <EmployeeDetail
        key={selected.id}
        employeeId={selected.id}
        readOnly={readOnly}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>Firm Directory</h3>
        {perms.canManageDirectory && (
          <button
            className="btn sm"
            onClick={() => setSelectedId(addEmployee())}
          >
            + Add employee
          </button>
        )}
      </div>
      <p className="tiny muted" style={{ marginTop: 0 }}>
        {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
        {!perms.canManageDirectory && ' · read-only'}
      </p>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Title</th>
            <th>Type</th>
            <th>Departments</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(e => (
            <tr key={e.id} className="clickable" onClick={() => setSelectedId(e.id)}>
              <td>{e.fullName || <span className="muted">(unnamed)</span>}</td>
              <td>{e.title || <span className="muted">—</span>}</td>
              <td>{e.employmentType}</td>
              <td>
                {e.departmentIds.length === 0
                  ? <span className="muted">—</span>
                  : e.departmentIds.map(d => (
                      <span key={d} className="tag soft" style={{ marginRight: 6 }}>{DEPT_LABELS[d]}</span>
                    ))}
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr><td colSpan={4} className="muted">No employees yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---- detail panel -------------------------------------------------------

type Draft = Omit<Employee, 'id' | 'departmentIds'>;

function EmployeeDetail({ employeeId, readOnly, onBack }: {
  employeeId: string; readOnly: boolean; onBack: () => void;
}) {
  const { getEmployee, updateEmployee, removeEmployee, addEmployeeToDept, removeEmployeeFromDept } = useFirmSettings();
  const employee = getEmployee(employeeId);

  // Draft holds the scalar/nested fields; department membership is edited live
  // (each toggle is its own audited store action), so it is read from the store.
  const [draft, setDraft] = useState<Draft | null>(() => {
    if (!employee) return null;
    const { id: _id, departmentIds: _d, ...rest } = employee;
    return rest;
  });

  if (!employee || !draft) {
    return (
      <div className="card">
        <p className="muted">Employee not found.</p>
        <button className="btn ghost sm" onClick={onBack}>← Back to directory</button>
      </div>
    );
  }

  const set = (patch: Partial<Draft>) => setDraft(d => (d ? { ...d, ...patch } : d));

  const save = () => {
    updateEmployee(employeeId, draft);   // logChange fires in the store
    onBack();
  };

  const remove = () => {
    removeEmployee(employeeId);           // logChange fires in the store
    onBack();
  };

  const fld = { disabled: readOnly };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button className="btn ghost sm" onClick={onBack}>← Directory</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {!readOnly && <button className="btn sm" onClick={save}>Save</button>}
            <button className="btn ghost sm" onClick={onBack}>{readOnly ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
        {readOnly && (
          <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Read-only — you don’t have permission to edit firm directory entries.
          </p>
        )}
      </div>

      {/* Contact info */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Contact info</h3>
        <label>Full name</label>
        <input value={draft.fullName} {...fld} onChange={e => set({ fullName: e.target.value })} />
        <div className="row">
          <div>
            <label>Phone</label>
            <input value={draft.contact.phone} {...fld}
              onChange={e => set({ contact: { ...draft.contact, phone: e.target.value } })} />
          </div>
          <div>
            <label>Email</label>
            <input value={draft.contact.email} {...fld}
              onChange={e => set({ contact: { ...draft.contact, email: e.target.value } })} />
          </div>
        </div>
        <label>Address</label>
        <input value={draft.contact.address} {...fld}
          onChange={e => set({ contact: { ...draft.contact, address: e.target.value } })} />
      </div>

      {/* Employment */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Employment</h3>
        <div className="row">
          <div>
            <label>Title</label>
            <input value={draft.title} {...fld} onChange={e => set({ title: e.target.value })} />
          </div>
          <div>
            <label>Employment type</label>
            <select value={draft.employmentType} {...fld}
              onChange={e => set({ employmentType: e.target.value as Employee['employmentType'] })}>
              <option value="FT">Full-time</option>
              <option value="PT">Part-time</option>
            </select>
          </div>
        </div>

        <label style={{ marginTop: 16 }}>Compensation</label>
        <div className="row">
          <select value={draft.compensation.type} {...fld}
            onChange={e => set({ compensation: { ...draft.compensation, type: e.target.value as 'salary' | 'hourly' } })}>
            <option value="salary">Salary</option>
            <option value="hourly">Hourly</option>
          </select>
          <input type="number" value={draft.compensation.rate} {...fld}
            onChange={e => set({ compensation: { ...draft.compensation, rate: Number(e.target.value) } })} />
          <input value={draft.compensation.currency} {...fld}
            onChange={e => set({ compensation: { ...draft.compensation, currency: e.target.value } })} />
        </div>
        <input style={{ marginTop: 8 }} placeholder="Compensation notes" value={draft.compensation.notes} {...fld}
          onChange={e => set({ compensation: { ...draft.compensation, notes: e.target.value } })} />

        <label style={{ marginTop: 16 }}>Benefits</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {(['health', 'dental', 'vision', 'retirement401k'] as const).map(k => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', margin: 0 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={draft.benefits[k]} {...fld}
                onChange={e => set({ benefits: { ...draft.benefits, [k]: e.target.checked } })} />
              {k === 'retirement401k' ? '401(k)' : k.charAt(0).toUpperCase() + k.slice(1)}
            </label>
          ))}
        </div>
        <input style={{ marginTop: 8 }} placeholder="Benefits notes" value={draft.benefits.notes} {...fld}
          onChange={e => set({ benefits: { ...draft.benefits, notes: e.target.value } })} />

        <label style={{ marginTop: 16 }}>FMLA status</label>
        <select value={draft.fmlaStatus} {...fld}
          onChange={e => set({ fmlaStatus: e.target.value as Employee['fmlaStatus'] })}>
          <option value="none">None</option>
          <option value="eligible">Eligible</option>
          <option value="active">Active</option>
          <option value="exhausted">Exhausted</option>
        </select>
      </div>

      {/* Schedule */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Schedule</h3>
        <label>Work hours</label>
        {WEEKDAYS.map((day: Weekday) => (
          <div key={day} className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
            <span style={{ flex: '0 0 48px', textTransform: 'capitalize', fontSize: 13 }}>{day}</span>
            <input type="time" value={draft.workHours.days[day].start} {...fld}
              onChange={e => set({ workHours: { days: { ...draft.workHours.days, [day]: { ...draft.workHours.days[day], start: e.target.value } } } })} />
            <span style={{ flex: '0 0 16px', textAlign: 'center' }}>–</span>
            <input type="time" value={draft.workHours.days[day].end} {...fld}
              onChange={e => set({ workHours: { days: { ...draft.workHours.days, [day]: { ...draft.workHours.days[day], end: e.target.value } } } })} />
          </div>
        ))}
        <p className="tiny muted">Leave both blank for a day off.</p>

        <label style={{ marginTop: 12 }}>Lunch</label>
        <div className="row">
          <div>
            <span className="tiny muted">Start</span>
            <input type="time" value={draft.lunchHours.start} {...fld}
              onChange={e => set({ lunchHours: { ...draft.lunchHours, start: e.target.value } })} />
          </div>
          <div>
            <span className="tiny muted">Minutes</span>
            <input type="number" value={draft.lunchHours.minutes} {...fld}
              onChange={e => set({ lunchHours: { ...draft.lunchHours, minutes: Number(e.target.value) } })} />
          </div>
        </div>
      </div>

      {/* Time off */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Time off</h3>
        <div className="row">
          <div>
            <label>PTO balance (hours)</label>
            <input type="number" value={draft.pto.balanceHours} {...fld}
              onChange={e => set({ pto: { ...draft.pto, balanceHours: Number(e.target.value) } })} />
            <input style={{ marginTop: 8 }} placeholder="PTO notes" value={draft.pto.notes} {...fld}
              onChange={e => set({ pto: { ...draft.pto, notes: e.target.value } })} />
          </div>
          <div>
            <label>STO balance (hours)</label>
            <input type="number" value={draft.sto.balanceHours} {...fld}
              onChange={e => set({ sto: { ...draft.sto, balanceHours: Number(e.target.value) } })} />
            <input style={{ marginTop: 8 }} placeholder="STO notes" value={draft.sto.notes} {...fld}
              onChange={e => set({ sto: { ...draft.sto, notes: e.target.value } })} />
          </div>
        </div>
      </div>

      {/* Departments — edited live through the store's audited updaters */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Departments</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DEPT_IDS.map((d: DeptId) => {
            const member = employee.departmentIds.includes(d);
            return (
              <button
                key={d}
                className={member ? 'tag gold' : 'tag soft'}
                disabled={readOnly}
                style={{ cursor: readOnly ? 'default' : 'pointer', border: 'none' }}
                onClick={() => readOnly ? undefined : (member ? removeEmployeeFromDept(employeeId, d) : addEmployeeToDept(employeeId, d))}
                title={readOnly ? '' : member ? 'Remove from department' : 'Add to department'}
              >
                {member ? '✓ ' : '+ '}{DEPT_LABELS[d]}
              </button>
            );
          })}
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Department changes save immediately (each is audit-logged).
        </p>
      </div>

      {/* Reporting summary — SCAFFOLD */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Reporting summary</h3>
        <dl className="kv" style={{ marginTop: 4 }}>
          <dt>Tasks handled</dt><dd>—</dd>
          <dt>Goals set</dt><dd>—</dd>
          <dt>Goal attainment</dt><dd>—</dd>
        </dl>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {/* TODO(real reporting data): per-employee task counts, goals, and
              attainment land with the department steps. Placeholder for now. */}
          Scaffold — real reporting arrives with the department steps.
        </p>
      </div>

      {/* Danger zone */}
      {!readOnly && (
        <div className="card" style={{ marginBottom: 0 }}>
          <button className="btn ghost sm" onClick={remove}>Remove employee</button>
        </div>
      )}
    </div>
  );
}
