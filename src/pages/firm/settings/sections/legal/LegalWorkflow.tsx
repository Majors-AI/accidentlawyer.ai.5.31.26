// Legal department specifics (PI): the pre-litigation / litigation split with the
// suit-filed unlock. The shared framework renders separately via
// <DepartmentSection deptId="legal" />; this adds the legal DEPARTMENT workflow.
//
// IMPORTANT: this does NOT rebuild per-case litigation handling. The real
// persistence / integration target is src/pages/firm/case-detail/LitTab.tsx with
// the cases / litigation / pleadings tables. Everything here is in-memory
// scaffold; the GATES + TRANSITIONS are real, the storage is TODO.
import { useState } from 'react';
import { useAuth } from '../../../../../App';
import { CASE_TYPES } from '../../../../../lib/firmSettings';
import { derivePermissions } from '../../../../../lib/permissions';
import { logChange } from '../../../../../lib/auditLog';

const caseTypeLabel = (v: string) => CASE_TYPES.find(c => c.value === v)?.label ?? v;

// ---- defined task templates (Step A) ------------------------------------

type TaskStatus = 'not_started' | 'in_progress' | 'done';
interface LegalTaskTemplate { id: string; name: string; lawyerOnly: boolean; }

// Pre-litigation tasks are always active.
export const PRE_LIT_TASKS: LegalTaskTemplate[] = [
  { id: 'open_file', name: 'Open file', lawyerOnly: false },
  { id: 'lor_carriers', name: 'Letters of representation to carriers', lawyerOnly: true },
  { id: 'police_report', name: 'Obtain police report', lawyerOnly: false },
  { id: 'treatment_monitoring', name: 'Treatment monitoring', lawyerOnly: false },
  { id: 'collect_records', name: 'Collect medical records & bills', lawyerOnly: false },
  { id: 'liability_damages_eval', name: 'Liability / damages evaluation', lawyerOnly: true },
  { id: 'prepare_demand', name: 'Prepare demand package', lawyerOnly: true },
  { id: 'send_demand', name: 'Send demand', lawyerOnly: true },
  { id: 'negotiate', name: 'Negotiate', lawyerOnly: true },
  { id: 'settle', name: 'Settle', lawyerOnly: true },
];

// Litigation tasks are lawyer-led and locked until suit is filed.
export const LIT_TASKS: LegalTaskTemplate[] = [
  { id: 'file_complaint', name: 'File complaint', lawyerOnly: true },
  { id: 'service', name: 'Service', lawyerOnly: true },
  { id: 'discovery', name: 'Discovery', lawyerOnly: true },
  { id: 'depositions', name: 'Depositions', lawyerOnly: true },
  { id: 'mediation_arbitration', name: 'Mediation / arbitration', lawyerOnly: true },
  { id: 'trial_prep', name: 'Trial prep', lawyerOnly: true },
  { id: 'trial', name: 'Trial', lawyerOnly: true },
];

const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Not started', in_progress: 'In progress', done: 'Done',
};
const statusTag = (s: TaskStatus) => (s === 'done' ? 'tag good' : s === 'in_progress' ? 'tag warn' : 'tag soft');

interface LegalCase {
  id: string;
  clientName: string;
  caseType: string;
  phase: 'pre_lit' | 'litigation';
  court: string | null;
  caseNumber: string | null;
  filingDate: string | null;
  taskStatus: Record<string, TaskStatus>;
}

// TODO(real case data): sourced from the cases table in production.
const SEED_CASE: LegalCase = {
  id: 'case-1', clientName: 'Robert Chen', caseType: 'mva', phase: 'pre_lit',
  court: null, caseNumber: null, filingDate: null,
  taskStatus: { open_file: 'done', police_report: 'in_progress', collect_records: 'in_progress' },
};

export default function LegalWorkflow() {
  const { profile } = useAuth();
  const perms = derivePermissions(profile);
  const isLawyer = perms.isLawyer;
  const canManage = perms.canManageDepartment('legal');
  const actor = profile?.full_name || profile?.id || 'unknown';

  const [c, setC] = useState<LegalCase>(SEED_CASE);
  const [court, setCourt] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [filingDate, setFilingDate] = useState('');

  const audit = (action: string, target: string, before: unknown, after: unknown) =>
    logChange({ actor, action, target, before, after });

  // Governance: lawyerOnly tasks editable only by lawyers; non-lawyer tasks
  // editable by legal department staff (canManageDepartment) or lawyers.
  const canEditTask = (t: LegalTaskTemplate) => (t.lawyerOnly ? isLawyer : (canManage || isLawyer));

  const statusOf = (id: string): TaskStatus => c.taskStatus[id] ?? 'not_started';
  const setTaskStatus = (id: string, status: TaskStatus) => {
    audit('legal-task-status', `legalCase:${c.id}:${id}`, statusOf(id), status);
    setC(prev => ({ ...prev, taskStatus: { ...prev.taskStatus, [id]: status } }));
  };

  const litUnlocked = c.phase === 'litigation';
  const suitReady = !!(court.trim() && caseNumber.trim() && filingDate);

  const markSuitFiled = () => {
    const after = { phase: 'litigation', court: court.trim(), caseNumber: caseNumber.trim(), filingDate };
    audit('mark-suit-filed', `legalCase:${c.id}`, { phase: c.phase }, after);
    setC(prev => ({ ...prev, phase: 'litigation', court: court.trim(), caseNumber: caseNumber.trim(), filingDate }));
  };

  const renderTask = (t: LegalTaskTemplate, locked: boolean) => {
    const editable = !locked && canEditTask(t);
    const s = statusOf(t.id);
    return (
      <div key={t.id} className="row" style={{ alignItems: 'center', marginBottom: 6, opacity: locked ? 0.55 : 1 }}>
        <span style={{ flex: 1, fontSize: 14 }}>
          {t.name}{' '}
          {t.lawyerOnly && <span className="tag ink" style={{ marginLeft: 4 }}>attorney</span>}
        </span>
        <span className={statusTag(s)} style={{ flex: '0 0 auto' }}>{STATUS_LABEL[s]}</span>
        <select value={s} disabled={!editable} style={{ flex: '0 0 150px' }}
          onChange={e => setTaskStatus(t.id, e.target.value as TaskStatus)}>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        {t.lawyerOnly && !isLawyer && <span className="tiny muted" style={{ flex: '0 0 auto' }}>attorney only</span>}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>{c.clientName}</h3>
            <span className="muted small">{caseTypeLabel(c.caseType)}</span>
          </div>
          <span className={litUnlocked ? 'tag gold' : 'tag soft'}>
            {litUnlocked ? 'Litigation' : 'Pre-litigation'}
          </span>
        </div>
        {litUnlocked && (
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>Court</dt><dd>{c.court}</dd>
            <dt>Case number</dt><dd>{c.caseNumber}</dd>
            <dt>Filing date</dt><dd>{c.filingDate}</dd>
          </dl>
        )}
        <p className="tiny muted" style={{ marginTop: litUnlocked ? 8 : 4, marginBottom: 0 }}>
          {/* TODO(real case data + persistence): scaffold case; real data is the
              cases table and litigation/pleadings via LitTab. */}
          Scaffold case — real persistence is the cases / litigation / pleadings tables (see LitTab).
        </p>
      </div>

      {/* Pre-litigation tasks (always active) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Pre-litigation tasks</h3>
        {PRE_LIT_TASKS.map(t => renderTask(t, false))}
      </div>

      {/* Suit-filed gate (centerpiece) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Suit filed</h3>
        {litUnlocked ? (
          <p className="tiny muted" style={{ marginTop: 0 }}>
            Suit filed {c.filingDate} · {c.court} · {c.caseNumber}. Litigation tasks are unlocked below.
          </p>
        ) : (
          <>
            <p className="tiny muted" style={{ marginTop: 0 }}>
              Litigation is locked until suit is filed. Marking suit filed is attorney-only and
              requires court, case number, and filing date.
            </p>
            <div className="row">
              <div>
                <label>Court</label>
                <input value={court} disabled={!isLawyer} onChange={e => setCourt(e.target.value)} placeholder="e.g. Maricopa County Superior Court" />
              </div>
              <div>
                <label>Case number</label>
                <input value={caseNumber} disabled={!isLawyer} onChange={e => setCaseNumber(e.target.value)} placeholder="e.g. CV2026-001234" />
              </div>
              <div>
                <label>Filing date</label>
                <input type="date" value={filingDate} disabled={!isLawyer} onChange={e => setFilingDate(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <button className="btn sm" style={{ width: 'auto' }} disabled={!isLawyer || !suitReady} onClick={markSuitFiled}>
                Mark suit filed
              </button>
              {!isLawyer && <span className="tiny muted">attorney only</span>}
              {isLawyer && !suitReady && <span className="tiny muted">enter court, case number, and filing date</span>}
            </div>
          </>
        )}
      </div>

      {/* Litigation tasks (locked until suit filed) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Litigation tasks</h3>
          {!litUnlocked && <span className="tag soft">🔒 Locked</span>}
        </div>
        {!litUnlocked && (
          <p className="tiny muted" style={{ marginTop: 6 }}>Unlocks when suit is filed (above).</p>
        )}
        <div style={{ marginTop: 8 }}>
          {LIT_TASKS.map(t => renderTask(t, !litUnlocked))}
        </div>
      </div>

      {/* Court-notice reconciliation (backend TODO seam) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Court-notice reconciliation</h3>
        <p className="tiny muted" style={{ margin: 0 }}>
          {/* TODO(backend seam): if a court / e-filing notice indicates suit was
              filed but it wasn't marked here, the system raises a notification and
              creates an attorney-review task to reconcile. Not implemented client-side. */}
          Backend TODO — if a court / e-filing notice shows suit was filed but it wasn’t marked here,
          the system would raise a notification and an attorney-review task to reconcile.
        </p>
      </div>
    </div>
  );
}
