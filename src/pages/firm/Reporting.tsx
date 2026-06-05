import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const PIPELINE_STAGES = ['lead', 'under_review', 'accepted', 'treating', 'demand', 'settlement', 'litigation'];

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString();
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="muted small" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontFamily: 'var(--serif)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function Reporting() {
  const [cases, setCases] = useState<{ status: string }[]>([]);
  const [disbursements, setDisbursements] = useState<{ settlement_amount: number | null; fees: number | null; net_to_client: number | null }[]>([]);
  const [settlements, setSettlements] = useState<{ status: string }[]>([]);
  const [treatments, setTreatments] = useState<{ total_billed: number | null }[]>([]);
  const [deadlines, setDeadlines] = useState<{ due_at: string; satisfied: boolean }[]>([]);
  const [demands, setDemands] = useState<{ amount: number | null; status: string }[]>([]);
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
      ] = await Promise.all([
        supabase.from('cases').select('status'),
        supabase.from('disbursements').select('settlement_amount, fees, net_to_client'),
        supabase.from('settlements').select('status'),
        supabase.from('treatments').select('total_billed'),
        supabase.from('deadlines').select('due_at, satisfied'),
        supabase.from('demands').select('amount, status'),
      ]);
      setCases(cs ?? []);
      setDisbursements(disb ?? []);
      setSettlements(sf ?? []);
      setTreatments(tx ?? []);
      setDeadlines(dl ?? []);
      setDemands(dm ?? []);
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
        <StatCard label="Open cases" value={String(openCount)} />
        <StatCard label="Closed cases" value={String(closedCount)} />
        <StatCard label="Total settled (gross)" value={fmt(grossTotal)} />
        <StatCard label="Fees earned" value={fmt(feesTotal)} />
        <StatCard label="Net to clients" value={fmt(netTotal)} />
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

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
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

          {/* Deadlines */}
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

          {/* Demands outstanding */}
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
        </div>
      </div>
    </>
  );
}
