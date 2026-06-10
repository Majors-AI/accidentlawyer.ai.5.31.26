// Accounting department specifics (PI). The shared framework renders separately
// via <DepartmentSection deptId="accounting" />; this adds the accounting
// DEPARTMENT workflow scaffold + the disbursement approval gate in action.
//
// IMPORTANT: this does NOT rebuild per-case money handling. The real persistence
// / integration target is src/pages/firm/case-detail/MoneyTab.tsx with the
// settlements / liens / trust_ledger / disbursements tables. Everything here is
// in-memory scaffold; the worksheet MATH is real, the storage is TODO.
import { useState } from 'react';
import { useAuth } from '../../../../../App';
import { useFirmSettings } from '../../../../../lib/firmSettings';
import { derivePermissions } from '../../../../../lib/permissions';
import { logChange } from '../../../../../lib/auditLog';

const fmt = (n: number) =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CostItem { id: string; description: string; amount: number; }
type LienStatus = 'open' | 'negotiating' | 'resolved';
interface Lien { id: string; provider: string; original: number; negotiated: number; status: LienStatus; }
type ReleaseStatus = 'draft' | 'pending_approval' | 'released';

// Seeded so the worksheet + release flow are tangible. TODO(real persistence):
// these load from settlements / reductions / liens / trust_ledger per case.
const SEED_COSTS: CostItem[] = [
  { id: 'cost-1', description: 'Court filing fees', amount: 450 },
  { id: 'cost-2', description: 'Medical records retrieval', amount: 120 },
];
const SEED_LIENS: Lien[] = [
  { id: 'lien-1', provider: 'Desert Spine & Rehab', original: 1850, negotiated: 1200, status: 'resolved' },
];

export default function AccountingWorkflow() {
  const { profile } = useAuth();
  const perms = derivePermissions(profile);
  const canEdit = perms.canManageDepartment('accounting');
  const canApproveDisbursement = perms.canApprove('disbursement');
  const actor = profile?.full_name || profile?.id || 'unknown';

  const { getApprovalGate } = useFirmSettings();
  const requiresApproval = getApprovalGate('disbursement').requiresApproval;

  // ---- in-memory workflow state ----
  const [settlement, setSettlement] = useState<{ amount: number; date: string } | null>({ amount: 45000, date: '2026-05-20' });
  const [sAmount, setSAmount] = useState(45000);
  const [sDate, setSDate] = useState('2026-05-20');
  const [feePct, setFeePct] = useState(33.33);
  const [costs, setCosts] = useState<CostItem[]>(SEED_COSTS);
  const [liens, setLiens] = useState<Lien[]>(SEED_LIENS);
  const [release, setRelease] = useState<ReleaseStatus>('draft');

  // draft inputs for add rows
  const [costDesc, setCostDesc] = useState('');
  const [costAmt, setCostAmt] = useState(0);
  const [lienProvider, setLienProvider] = useState('');
  const [lienOrig, setLienOrig] = useState(0);

  const fld = { disabled: !canEdit };

  const audit = (action: string, target: string, before: unknown, after: unknown) =>
    logChange({ actor, action, target, before, after });

  // ---- worksheet math (REAL) ----
  const S = settlement?.amount ?? 0;
  const fee = S * (feePct / 100);
  const C = costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const L = liens.reduce((sum, l) => sum + (Number(l.negotiated) || 0), 0);
  const net = S - fee - C - L;

  // ---- trust summary scaffold ----
  const deposits = S;
  const disbursedOut = release === 'released' ? S : 0;
  const trustBalance = deposits - disbursedOut;

  // ---- release transitions (audited) ----
  const recordSettlement = () => {
    const after = { amount: sAmount, date: sDate };
    audit('record-settlement', 'accounting:settlement', settlement, after);
    setSettlement(after);
  };
  const releaseDisbursement = () => {
    const next: ReleaseStatus = requiresApproval ? 'pending_approval' : 'released';
    audit('release-disbursement', 'accounting:disbursement', release, next);
    setRelease(next);
  };
  const approveDisbursement = () => {
    audit('approve-disbursement', 'accounting:disbursement', release, 'released');
    setRelease('released');
  };
  const resetRelease = () => {
    audit('reset-disbursement', 'accounting:disbursement', release, 'draft');
    setRelease('draft');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <h3 style={{ margin: 0 }}>Accounting workflow</h3>
        <p className="tiny muted" style={{ marginTop: 4, marginBottom: 0 }}>
          Department scaffold — real money handling lives in the case File Cabinet (MoneyTab) and the
          settlements / liens / trust_ledger / disbursements tables. {!canEdit && '· read-only'}
        </p>
      </div>

      {/* Settlement-received intake */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Settlement received</h3>
        <div className="row">
          <div>
            <label>Amount</label>
            <input type="number" value={sAmount} {...fld} onChange={e => setSAmount(Number(e.target.value))} />
          </div>
          <div>
            <label>Date received</label>
            <input type="date" value={sDate} {...fld} onChange={e => setSDate(e.target.value)} />
          </div>
        </div>
        {canEdit && <button className="btn sm" style={{ width: 'auto', marginTop: 10 }} onClick={recordSettlement}>Record settlement</button>}
        {settlement && (
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Recorded: {fmt(settlement.amount)} on {settlement.date}. Seeds the worksheet below.
          </p>
        )}
      </div>

      {/* Costs advanced */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Costs advanced</h3>
        {costs.length === 0 && <p className="muted small">No advanced costs.</p>}
        {costs.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span>{c.description}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <b>{fmt(c.amount)}</b>
              {canEdit && <button className="btn ghost sm" style={{ width: 'auto' }}
                onClick={() => { setCosts(cs => cs.filter(x => x.id !== c.id)); audit('remove-cost', 'accounting:cost', c, null); }}>Remove</button>}
            </span>
          </div>
        ))}
        {canEdit && (
          <div className="row" style={{ alignItems: 'center', marginTop: 8 }}>
            <input placeholder="Description" value={costDesc} onChange={e => setCostDesc(e.target.value)} />
            <input type="number" placeholder="Amount" value={costAmt || ''} onChange={e => setCostAmt(Number(e.target.value))} style={{ flex: '0 0 140px' }} />
            <button className="btn ghost sm" style={{ flex: '0 0 auto', width: 'auto' }} disabled={!costDesc.trim() || costAmt <= 0}
              onClick={() => {
                const item = { id: `cost-${Date.now()}`, description: costDesc.trim(), amount: costAmt };
                setCosts(cs => [...cs, item]); audit('add-cost', 'accounting:cost', null, item);
                setCostDesc(''); setCostAmt(0);
              }}>Add cost</button>
          </div>
        )}
        <p className="tiny muted" style={{ marginTop: 8 }}>Total advanced: <b>{fmt(C)}</b></p>
      </div>

      {/* Medical lien resolution */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Medical lien resolution</h3>
        {liens.length === 0 && <p className="muted small">No liens.</p>}
        {liens.map(l => (
          <div key={l.id} className="well" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <b style={{ fontSize: 14 }}>{l.provider}</b>
              {canEdit && <button className="btn ghost sm" style={{ width: 'auto' }}
                onClick={() => { setLiens(ls => ls.filter(x => x.id !== l.id)); audit('remove-lien', 'accounting:lien', l, null); }}>Remove</button>}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div>
                <span className="tiny muted">Original</span>
                <input type="number" value={l.original} {...fld}
                  onChange={e => setLiens(ls => ls.map(x => x.id === l.id ? { ...x, original: Number(e.target.value) } : x))} />
              </div>
              <div>
                <span className="tiny muted">Negotiated</span>
                <input type="number" value={l.negotiated} {...fld}
                  onChange={e => setLiens(ls => ls.map(x => x.id === l.id ? { ...x, negotiated: Number(e.target.value) } : x))} />
              </div>
              <div>
                <span className="tiny muted">Status</span>
                <select value={l.status} {...fld}
                  onChange={e => setLiens(ls => ls.map(x => x.id === l.id ? { ...x, status: e.target.value as LienStatus } : x))}>
                  <option value="open">Open</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        {canEdit && (
          <div className="row" style={{ alignItems: 'center', marginTop: 8 }}>
            <input placeholder="Provider" value={lienProvider} onChange={e => setLienProvider(e.target.value)} />
            <input type="number" placeholder="Original amount" value={lienOrig || ''} onChange={e => setLienOrig(Number(e.target.value))} style={{ flex: '0 0 160px' }} />
            <button className="btn ghost sm" style={{ flex: '0 0 auto', width: 'auto' }} disabled={!lienProvider.trim() || lienOrig <= 0}
              onClick={() => {
                const item: Lien = { id: `lien-${Date.now()}`, provider: lienProvider.trim(), original: lienOrig, negotiated: lienOrig, status: 'open' };
                setLiens(ls => [...ls, item]); audit('add-lien', 'accounting:lien', null, item);
                setLienProvider(''); setLienOrig(0);
              }}>Add lien</button>
          </div>
        )}
        <p className="tiny muted" style={{ marginTop: 8 }}>Negotiated liens total: <b>{fmt(L)}</b> (feeds the worksheet)</p>
      </div>

      {/* Disbursement worksheet (REAL calculation) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Disbursement worksheet</h3>
        <div className="row" style={{ marginBottom: 4 }}>
          <div>
            <label>Contingency fee %</label>
            <input type="number" value={feePct} {...fld} onChange={e => setFeePct(Number(e.target.value))} />
          </div>
          <div />
        </div>
        <dl className="kv" style={{ marginTop: 10 }}>
          <dt>Settlement (S)</dt><dd>{fmt(S)}</dd>
          <dt>Attorney fee (S × {feePct}%)</dt><dd>− {fmt(fee)}</dd>
          <dt>Costs advanced (C)</dt><dd>− {fmt(C)}</dd>
          <dt>Negotiated liens (L)</dt><dd>− {fmt(L)}</dd>
          <dt style={{ fontWeight: 600 }}>Net to client</dt>
          <dd style={{ fontWeight: 700, color: net >= 0 ? 'var(--good)' : 'var(--bad)' }}>{fmt(net)}</dd>
        </dl>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {/* TODO(real persistence): persists to the disbursements table
              (settlement_amount, fees, medical, liens_total, net_to_client) via MoneyTab. */}
          Net = S − fee − C − L. Persistence to the disbursements table is TODO (see MoneyTab).
        </p>
      </div>

      {/* Trust / IOLTA summary scaffold */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Trust / IOLTA summary</h3>
        <dl className="kv" style={{ marginTop: 4 }}>
          <dt>Deposits</dt><dd>{fmt(deposits)}</dd>
          <dt>Disbursements</dt><dd>{fmt(disbursedOut)}</dd>
          <dt style={{ fontWeight: 600 }}>Balance in trust</dt><dd style={{ fontWeight: 700 }}>{fmt(trustBalance)}</dd>
        </dl>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {/* TODO: real ledger is the trust_ledger table surfaced in MoneyTab. */}
          Scaffold only — the real ledger is <code>trust_ledger</code> via MoneyTab. Not duplicated here.
        </p>
      </div>

      {/* Release disbursement — approval gate in action */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Release disbursement</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="tiny muted">Status:</span>
          <span className={release === 'released' ? 'tag good' : release === 'pending_approval' ? 'tag warn' : 'tag soft'}>
            {release === 'pending_approval' ? 'Pending approval' : release === 'released' ? 'Released' : 'Draft'}
          </span>
          <span className="tiny muted">
            · Approval gate: {requiresApproval ? 'required' : 'not required'} (set in Owner Portal)
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <button className="btn sm" style={{ width: 'auto' }}
            disabled={!canEdit || release !== 'draft' || S <= 0}
            onClick={releaseDisbursement}>
            Release disbursement{requiresApproval ? ' (→ pending approval)' : ''}
          </button>

          {release === 'pending_approval' && (
            <>
              <button className="btn sm" style={{ width: 'auto' }}
                disabled={!canApproveDisbursement} onClick={approveDisbursement}>
                Approve &amp; release
              </button>
              {!canApproveDisbursement && <span className="tiny muted">approval requires an attorney or owner</span>}
            </>
          )}

          {release === 'released' && <span className="tiny muted">Disbursed {fmt(net)} net to client. Trust balance now {fmt(trustBalance)}.</span>}

          {canEdit && release !== 'draft' && (
            <button className="btn ghost sm" style={{ width: 'auto' }} onClick={resetRelease}>Reset</button>
          )}
        </div>
        {S <= 0 && <p className="tiny muted" style={{ marginTop: 8 }}>Record a settlement before releasing.</p>}
      </div>
    </div>
  );
}
