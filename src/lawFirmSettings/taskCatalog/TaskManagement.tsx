// Law Firm Settings § Task Management (SCAFFOLD UI).
//
// In-memory only: state is seeded from SEED_FIRM_CONFIG and edited locally.
// TODO(real persistence: Supabase) — load/save FirmTaskConfig by firm_id and
// write each mode change to the audit log. No sends, no release actions fire
// this pass; the Release Queue's button is a placeholder.

import { useMemo, useState } from 'react';
import type {
  AutomationMode,
  Department,
  DepartmentId,
  FirmTask,
  FirmTaskConfig,
} from './types';
import { modeOptions, resolveMode, isInherited } from './engine';
import { SEED_FIRM_CONFIG } from './seed';

const MODES: AutomationMode[] = ['auto', 'queued', 'manual'];

const MODE_LABEL: Record<AutomationMode, string> = {
  auto: 'Auto',
  queued: 'Queued',
  manual: 'Manual',
};

const MODE_BLURB: Record<AutomationMode, string> = {
  auto: 'Action fires with no human step.',
  queued: 'Bot stages the action; a human releases it with one click.',
  manual: 'A person performs the whole task.',
};

const ACTION_LABEL: Record<FirmTask['action'], string> = {
  none: '—',
  send_lor: 'Send LOR',
  request_records: 'Request records',
  request_bills: 'Request bills',
  send_demand: 'Send demand',
  generate_doc: 'Generate doc',
  send_email: 'Send email',
  send_sms: 'Send SMS',
  assign_task: 'Assign task',
  calendar_event: 'Calendar event',
};

function triggerLabel(t: FirmTask['trigger']): string {
  switch (t.type) {
    case 'manual': return 'Manual';
    case 'status_change': return `Status: ${t.on ?? '?'}`;
    case 'dependency': return `After: ${t.on ?? '?'}`;
    case 'scheduled': return `+${t.delayDays ?? 0}d after ${t.on ?? '?'}`;
    default: return t.type;
  }
}

const PRIORITY_STYLE: Record<FirmTask['priority'], React.CSSProperties> = {
  high: { background: 'rgba(15,119,255,.12)', color: 'var(--color-electric-blue)' },
  med: { background: 'rgba(9,17,53,.06)', color: 'var(--color-midnight-ink)' },
  low: { background: 'rgba(9,17,53,.04)', color: 'var(--color-slate)' },
};

// Recompute every task's resolved automationMode after any default/override edit.
function recompute(firm: FirmTaskConfig): FirmTaskConfig {
  for (const dept of firm.departments) {
    for (const task of dept.tasks) {
      task.automationMode = resolveMode(task, dept, firm);
    }
  }
  return firm;
}

export default function TaskManagement() {
  const [firm, setFirm] = useState<FirmTaskConfig>(() =>
    recompute(structuredClone(SEED_FIRM_CONFIG)),
  );
  const [open, setOpen] = useState<DepartmentId | null>('intake');

  // ---- edits (immutable: clone → mutate → recompute → set) --------------
  function update(mutate: (draft: FirmTaskConfig) => void) {
    setFirm((prev) => {
      const draft = structuredClone(prev);
      mutate(draft);
      return recompute(draft);
    });
  }
  const setFirmDefault = (mode: AutomationMode) =>
    update((d) => { d.firmDefaultMode = mode; });
  const setDeptDefault = (id: DepartmentId, mode: AutomationMode) =>
    update((d) => { const dep = d.departments.find((x) => x.id === id); if (dep) dep.defaultMode = mode; });
  const setTaskOverride = (id: DepartmentId, taskId: string, mode: AutomationMode) =>
    update((d) => {
      const task = d.departments.find((x) => x.id === id)?.tasks.find((t) => t.id === taskId);
      if (task) task.modeOverride = mode;
    });
  const resetTask = (id: DepartmentId, taskId: string) =>
    update((d) => {
      const task = d.departments.find((x) => x.id === id)?.tasks.find((t) => t.id === taskId);
      if (task) delete task.modeOverride;
    });

  // Tasks staged for one-click release (resolved to 'queued').
  const queued = useMemo(
    () => firm.departments.flatMap((d) => d.tasks.filter((t) => t.automationMode === 'queued')),
    [firm],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ---- firm-level default ---- */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Automation default</h3>
        <p className="tiny muted" style={{ marginTop: 4, marginBottom: 12 }}>
          The top of the cascade. Departments and individual tasks inherit this unless they set their own.
        </p>
        <ModeSeg
          value={firm.firmDefaultMode}
          onPick={setFirmDefault}
          options={MODES.map((m) => ({ mode: m, disabled: false }))}
        />
        <div className="tm-blurbs">
          {MODES.map((m) => (
            <div key={m} className="tiny muted">
              <b style={{ color: 'var(--color-midnight-ink)' }}>{MODE_LABEL[m]}</b> — {MODE_BLURB[m]}
            </div>
          ))}
        </div>
      </div>

      {/* ---- department accordion ---- */}
      {firm.departments.map((dept) => (
        <DeptCard
          key={dept.id}
          dept={dept}
          firm={firm}
          isOpen={open === dept.id}
          onToggle={() => setOpen((cur) => (cur === dept.id ? null : dept.id))}
          onDeptDefault={(m) => setDeptDefault(dept.id, m)}
          onTaskMode={(taskId, m) => setTaskOverride(dept.id, taskId, m)}
          onTaskReset={(taskId) => resetTask(dept.id, taskId)}
        />
      ))}

      {/* ---- release queue placeholder ---- */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Release queue</h3>
          <span className="tag" style={{ background: 'rgba(15,119,255,.12)', color: 'var(--color-electric-blue)' }}>
            {queued.length} staged
          </span>
        </div>
        <p className="tiny muted" style={{ marginTop: 4 }}>
          Tasks resolved to <b>Queued</b> wait here for one-click release. Releasing is a later pass — the button is inert.
        </p>
        <div className="tm-queue">
          {queued.map((t) => (
            <div key={t.id} className="tm-queue-row">
              <div>
                <div>{t.label}</div>
                <div className="tiny muted">{ACTION_LABEL[t.action]} · {triggerLabel(t.trigger)}</div>
              </div>
              <button className="btn sm ghost" disabled title="Release wiring is a later pass">Release</button>
            </div>
          ))}
          {queued.length === 0 && <div className="tiny muted">Nothing staged.</div>}
        </div>
      </div>
    </div>
  );
}

// ---- department card ----------------------------------------------------

function DeptCard(props: {
  dept: Department;
  firm: FirmTaskConfig;
  isOpen: boolean;
  onToggle: () => void;
  onDeptDefault: (m: AutomationMode) => void;
  onTaskMode: (taskId: string, m: AutomationMode) => void;
  onTaskReset: (taskId: string) => void;
}) {
  const { dept, firm, isOpen, onToggle, onDeptDefault, onTaskMode, onTaskReset } = props;
  const counts = useMemo(() => {
    const c: Record<AutomationMode, number> = { auto: 0, queued: 0, manual: 0 };
    for (const t of dept.tasks) c[t.automationMode]++;
    return c;
  }, [dept]);

  return (
    <div className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
      <div className="tm-dept-head">
        <button className="tm-dept-toggle" onClick={onToggle} aria-expanded={isOpen}>
          <span className="tm-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          <span>{dept.label}</span>
          <span className="tiny muted">({dept.tasks.length})</span>
        </button>
        <div className="tm-dept-meta">
          <span className="tm-count tm-count-auto" title="Auto">A {counts.auto}</span>
          <span className="tm-count tm-count-queued" title="Queued">Q {counts.queued}</span>
          <span className="tm-count tm-count-manual" title="Manual">M {counts.manual}</span>
          <label className="tm-dept-default">
            <span className="tiny muted">Dept default</span>
            <select
              value={dept.defaultMode}
              onChange={(e) => onDeptDefault(e.target.value as AutomationMode)}
              style={{ width: 'auto' }}
            >
              {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
            </select>
          </label>
        </div>
      </div>

      {isOpen && (
        <div className="tm-table">
          <div className="tm-row tm-head">
            <div>Task</div><div>Trigger</div><div>Action</div><div>Owner</div><div>Pri</div><div>Mode</div>
          </div>
          {dept.tasks.map((task) => {
            const opts = modeOptions(task, firm);
            const inherited = isInherited(task);
            return (
              <div key={task.id} className="tm-row">
                <div>
                  {task.label}
                  {task.description && <div className="tiny muted">{task.description}</div>}
                  <div className="tm-flags">
                    {task.attorneyGated && <span className="tm-flag">atty-gated</span>}
                    {task.externalAction && <span className="tm-flag">external</span>}
                    {task.moneyMovement && <span className="tm-flag tm-flag-lock">money · locked</span>}
                  </div>
                </div>
                <div className="tiny">{triggerLabel(task.trigger)}</div>
                <div className="tiny">{ACTION_LABEL[task.action]}</div>
                <div className="tiny">{task.defaultOwnerRole}</div>
                <div>
                  <span className="tag" style={PRIORITY_STYLE[task.priority]}>{task.priority}</span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <ModeSeg
                      value={task.automationMode}
                      muted={inherited}
                      onPick={(m) => onTaskMode(task.id, m)}
                      options={opts}
                    />
                    {inherited
                      ? <span className="tag" style={{ background: 'rgba(9,17,53,.05)', color: 'var(--color-slate)' }}>inherited</span>
                      : <button className="tm-reset" onClick={() => onTaskReset(task.id)}>reset</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- 3-way segmented mode control --------------------------------------

function ModeSeg(props: {
  value: AutomationMode;
  options: { mode: AutomationMode; disabled: boolean; reason?: string }[];
  onPick: (m: AutomationMode) => void;
  muted?: boolean;
}) {
  const { value, options, onPick, muted } = props;
  return (
    <div className={'tm-seg' + (muted ? ' tm-seg-muted' : '')}>
      {options.map((o) => (
        <button
          key={o.mode}
          type="button"
          className={'tm-seg-btn' + (o.mode === value ? ' active' : '')}
          disabled={o.disabled}
          title={o.disabled ? o.reason : MODE_BLURB[o.mode]}
          onClick={() => !o.disabled && onPick(o.mode)}
        >
          {MODE_LABEL[o.mode]}
        </button>
      ))}
    </div>
  );
}
