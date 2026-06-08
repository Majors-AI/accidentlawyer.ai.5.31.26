import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const PIPELINE_STAGES = ['lead', 'under_review', 'accepted', 'treating', 'demand', 'settlement', 'litigation'];

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString();
}

// Year-month bucket key, e.g. "2026-06".
function monthKey(d: string) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

// Continuous list of the last n months (oldest first), with display labels.
function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
      label: m.toLocaleDateString(undefined, { month: 'short' }),
    });
  }
  return out;
}

function StatCard({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div className={onClick ? 'card clickable' : 'card'} style={{ marginBottom: 0 }} onClick={onClick}>
      <div className="muted small" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontFamily: 'var(--serif)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

// Dependency-free monthly bar chart (matches the hand-rolled bar style elsewhere).
function MonthlyBars({ data, format }: { data: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
        {data.map((d, i) => (
          <div key={i} title={`${d.label}: ${format(d.value)}`}
            style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' }}>
            <div style={{
              width: '100%',
              background: d.value > 0 ? 'var(--oxblood)' : 'transparent',
              borderRadius: '4px 4px 0 0',
              height: d.value > 0 ? `${Math.max((d.value / max) * 100, 4)}%` : '0',
              transition: 'height .2s',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} className="small muted" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

export default function Reporting() {
  const nav = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<{ status: string }[]>([]);
  const [treatments, setTreatments] = useState<{ total_billed: number | null }[]>([]);
  const [deadlines, setDeadlines] = useState<{ due_at: string; satisfied: boolean }[]>([]);
  const [demands, setDemands] = useState<{ amount: number | null; status: string }[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: cs },
        { data: disb },
        { data: sf },
        { data: tx },
        { data: dl },
        { data: dm },
        { data: pf },
      ] = await Promise.all([
        supabase.from('cases').select('status, attorney_id, created_at'),
        supabase.from('disbursements').select('settlement_amount, fees, net_to_client, created_at'),
        supabase.from('settlements').select('status'),
        supabase.from('treatments').select('total_billed'),
        supabase.from('deadlines').select('due_at, satisfied'),
        supabase.from('demands').select('amount, status'),
        supabase.from('profiles').select('id, full_name'),
      ]);
      setCases(cs ?? []);
      setDisbursements(disb ?? []);
      setSettlements(sf ?? []);
      setTreatments(tx ?? []);
      setDeadlines(dl ?? []);
      setDemands(dm ?? []);
      setProfiles(pf ?? []);
      setLoading(false);
    })();
  }, []);

  // Case counts
  const openCases = cases.filter(c => c.status !== 'closed' && c.status !== 'denied');
  const closedCount = cases.filter(c => c.status === 'closed').length;
  const deniedCount = cases.filter(c => c.status === 'denied').length;
  const openCount = openCases.length;

  const stageCounts = PIPELINE_STAGES.map(stage => ({
    stage,
    count: cases.filter(c => c.status === stage).length,
  }));
  const maxStageCount = Math.max(...stageCounts.map(s => s.count), 1);

  // Financial
  const grossTotal = disbursements.reduce((s, d) => s + (Number(d.settlement_amount) || 0), 0);
  const feesTotal = disbursements.reduce((s, d) => s + (Number(d.fees) || 0), 0);
  const netTotal = disbursements.reduce((s, d) => s + (Number(d.net_to_client) || 0), 0);
  const disbCount = disbursements.length;
  const avgGross = disbCount > 0 ? grossTotal / disbCount : 0;
  const fundedCount = settlements.filter(s => s.status === 'funded').length;
  const specialsTotal = treatments.reduce((s, t) => s + (Number(t.total_billed) || 0), 0);

  // Trends — last 12 months
  const months = lastMonths(12);
  const newCasesSeries = months.map(m => ({
    label: m.label,
    value: cases.filter(c => c.created_at && monthKey(c.created_at) === m.key).length,
  }));
  const revenueSeries = months.map(m => ({
    label: m.label,
    value: disbursements
      .filter(d => d.created_at && monthKey(d.created_at) === m.key)
      .reduce((s, d) => s + (Number(d.settlement_amount) || 0), 0),
  }));

  // Caseload by attorney (active cases only)
  const nameById = new Map(profiles.map(p => [p.id, p.full_name]));
  const attorneyTally: Record<string, number> = {};
  for (const c of openCases) {
    const key = c.attorney_id ?? 'unassigned';
    attorneyTally[key] = (attorneyTally[key] || 0) + 1;
  }
  const attorneyRows = Object.entries(attorneyTally)
    .map(([id, count]) => ({
      name: id === 'unassigned' ? 'Unassigned' : (nameById.get(id) ?? 'Unknown'),
      count,
    }))
    .sort((a, b) => b.count - a.count);
  const maxAttorney = Math.max(...attorneyRows.map(a => a.count), 1);

  // Deadlines — compare as date strings to avoid timezone shifts on date-only column
  const todayStr = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  const openDeadlines = deadlines.filter(d => !d.satisfied);
  const overdueDeadlines = openDeadlines.filter(d => d.due_at < todayStr);
  const soonDeadlines = openDeadlines.filter(d => d.due_at >= todayStr && d.due_at <= in30Str);

  // Demands
  const sentDemands = demands.filter(d => d.status === 'sent');
  const sentDemandTotal = sentDemands.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  // Conversion — approximations from current status (no stage history yet)
  const INTAKE_STAGES = ['lead', 'under_review', 'info_requested'];
  const reviewedOut = cases.filter(c => !INTAKE_STAGES.includes(c.status)); // left intake: accepted-path or denied
  const decided = reviewedOut.length;
  const acceptedPath = reviewedOut.filter(c => c.status !== 'denied').length;
  const acceptanceRate = decided > 0 ? acceptedPath / decided : 0;
  const settledCount = disbCount; // cases with a disbursement
  const settlementRate = acceptedPath > 0 ? settledCount / acceptedPath : 0;
  const pct = (r: number) => `${Math.round(r * 100)}%`;

  if (loading) return <div className="muted">Loading…</div>;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Reporting</h1>
          <div className="sub">Firm-wide snapshot · {cases.length} total cases</div>
        </div>
      </div>

      {/* Top stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Open cases" value={String(openCount)} onClick={() => nav('/cases')} />
        <StatCard label="Closed cases" value={String(closedCount)} onClick={() => nav('/cases')} />
        <StatCard label="Total settled (gross)" value={fmt(grossTotal)} />
        <StatCard label="Fees earned" value={fmt(feesTotal)} />
        <StatCard label="Net to clients" value={fmt(netTotal)} />
      </div>

      {/* Trends over time */}
      <div className="grid two">
        <div className="card">
          <h3>New cases · last 12 months</h3>
          <MonthlyBars data={newCasesSeries} format={(n) => String(n)} />
        </div>
        <div className="card">
          <h3>Settled (gross) · last 12 months</h3>
          <MonthlyBars data={revenueSeries} format={fmt} />
        </div>
      </div>

      <div className="grid two">
        {/* Caseload by stage */}
        <div className="card">
          <h3>Caseload by stage</h3>
          <div style={{ marginTop: 12 }}>
            {stageCounts.map(({ stage, count }) => (
              <div key={stage} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                  <span style={{ textTransform: 'capitalize' }}>{stage.replace(/_/g, ' ')}</span>
                  <b>{count}</b>
                </div>
                <div style={{ background: 'var(--paper-2)', borderRadius: 4, height: 7 }}>
                  <div style={{
                    background: 'var(--oxblood)',
                    width: count === 0 ? '0%' : `${Math.max(Math.round((count / maxStageCount) * 100), 2)}%`,
                    height: '100%',
                    borderRadius: 4,
                    opacity: count === 0 ? 0 : 1,
                    transition: 'width .2s',
                  }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--paper-2)', display: 'flex', gap: 24, fontSize: 13 }}>
              <span>Denied: <b>{deniedCount}</b></span>
              <span>Closed: <b>{closedCount}</b></span>
              <span className="muted">Total: <b>{cases.length}</b></span>
            </div>
          </div>
        </div>

        {/* Caseload by attorney */}
        <div className="card">
          <h3>Caseload by attorney</h3>
          <div style={{ marginTop: 12 }}>
            {attorneyRows.length === 0 && <p className="muted small">No active cases.</p>}
            {attorneyRows.map(({ name, count }) => (
              <div key={name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                  <span>{name}</span>
                  <b>{count}</b>
                </div>
                <div style={{ background: 'var(--paper-2)', borderRadius: 4, height: 7 }}>
                  <div style={{
                    background: 'var(--oxblood)',
                    width: `${Math.max(Math.round((count / maxAttorney) * 100), 2)}%`,
                    height: '100%',
                    borderRadius: 4,
                    transition: 'width .2s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid two">
        {/* Financial summary */}
        <div className="card">
          <h3>Financial summary</h3>
          <dl className="kv" style={{ marginTop: 10 }}>
            <dt>Gross settled</dt><dd>{disbCount > 0 ? fmt(grossTotal) : <span className="muted">—</span>}</dd>
            <dt>Fees earned</dt><dd>{disbCount > 0 ? fmt(feesTotal) : <span className="muted">—</span>}</dd>
            <dt>Net to clients</dt><dd>{disbCount > 0 ? fmt(netTotal) : <span className="muted">—</span>}</dd>
            <dt>Avg. settlement</dt><dd>{disbCount > 0 ? fmt(avgGross) : <span className="muted">—</span>}</dd>
            <dt>Funded settlements</dt><dd>{fundedCount}</dd>
            <dt>Specials in flight</dt><dd>{specialsTotal > 0 ? fmt(specialsTotal) : <span className="muted">—</span>}</dd>
          </dl>
        </div>

        {/* Right column: deadlines + demands */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="card">
            <h3>Deadlines</h3>
            <div style={{ display: 'flex', gap: 28, marginTop: 10 }}>
              <div>
                <div style={{
                  fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 600,
                  color: overdueDeadlines.length > 0 ? 'var(--bad)' : 'var(--ink-soft)',
                }}>
                  {overdueDeadlines.length}
                </div>
                <div className="small muted">Overdue</div>
              </div>
              <div>
                <div style={{
                  fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 600,
                  color: soonDeadlines.length > 0 ? 'var(--warn)' : 'var(--ink-soft)',
                }}>
                  {soonDeadlines.length}
                </div>
                <div className="small muted">Due ≤30 days</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 600 }}>
                  {openDeadlines.length}
                </div>
                <div className="small muted">Total open</div>
              </div>
            </div>
            {openDeadlines.length === 0 && (
              <p className="muted small" style={{ marginTop: 8 }}>No open deadlines.</p>
            )}
          </div>

          <div className="card">
            <h3>Demands outstanding</h3>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Sent demands</dt>
              <dd>
                {sentDemands.length > 0
                  ? <span className="tag gold">{sentDemands.length}</span>
                  : <span className="muted">—</span>}
              </dd>
              <dt>Total amount</dt>
              <dd>{sentDemands.length > 0 ? fmt(sentDemandTotal) : <span className="muted">—</span>}</dd>
            </dl>
          </div>

          <div className="card">
            <h3>Conversion</h3>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Acceptance rate</dt>
              <dd>{decided > 0
                ? <>{pct(acceptanceRate)} <span className="muted small">· {acceptedPath} of {decided} decided</span></>
                : <span className="muted">—</span>}</dd>
              <dt>Settlement rate</dt>
              <dd>{acceptedPath > 0
                ? <>{pct(settlementRate)} <span className="muted small">· {settledCount} of {acceptedPath} accepted</span></>
                : <span className="muted">—</span>}</dd>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
