import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Statuses that are no longer "open / active" work.
const CLOSED_STATUSES = ['closed', 'denied'];
const REVIEW_STATUSES = ['lead', 'under_review', 'info_requested'];

// Days between today (local midnight) and a date. Handles both date-only
// columns (sol_date, deadlines.due_at) and timestamptz (tasks, follow_ups)
// without timezone drift. Negative = overdue.
function daysFromToday(d: string | null | undefined): number | null {
  if (!d) return null;
  const due = new Date(d.length <= 10 ? d + 'T00:00:00' : d);
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((due.getTime() - today.getTime()) / 86400000);
}

function dueLabel(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days}d`;
}

function urgencyTag(days: number | null): string {
  if (days === null) return 'soft';
  if (days < 0) return 'bad';
  if (days <= 14) return 'warn';
  if (days <= 30) return 'gold';
  return 'soft';
}

function caseName(c: any): string {
  return c?.clients?.full_name ?? '—';
}

type Item = { key: string; caseId?: string; name: string; detail: string; days: number | null };

function ActionRow({ item, onOpen }: { item: Item; onOpen: (id?: string) => void }) {
  return (
    <div
      className={item.caseId ? 'clickable' : ''}
      onClick={() => item.caseId && onOpen(item.caseId)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 0', borderBottom: '1px solid var(--paper-2)', gap: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <b style={{ fontSize: 14 }}>{item.name}</b>
        <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.detail}
        </div>
      </div>
      <span className={`tag ${urgencyTag(item.days)} tiny`} style={{ flexShrink: 0 }}>{dueLabel(item.days)}</span>
    </div>
  );
}

function ListCard({
  title, accent, items, empty, onOpen, viewAll,
}: {
  title: string; accent: string; items: Item[]; empty: string;
  onOpen: (id?: string) => void; viewAll?: { label: string; go: () => void };
}) {
  const MAX = 6;
  const shown = items.slice(0, MAX);
  const extra = items.length - shown.length;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3>{title}</h3>
        {items.length > 0 && <span className={`tag ${accent} tiny`}>{items.length}</span>}
      </div>
      {shown.length === 0 ? (
        <p className="muted small" style={{ marginTop: 8 }}>{empty}</p>
      ) : (
        <div style={{ marginTop: 6 }}>
          {shown.map(it => <ActionRow key={it.key} item={it} onOpen={onOpen} />)}
          {(extra > 0 || viewAll) && (
            <div
              className="small muted clickable"
              style={{ marginTop: 8 }}
              onClick={() => viewAll?.go()}
            >
              {extra > 0 ? `+${extra} more` : ''}{extra > 0 && viewAll ? ' · ' : ''}{viewAll?.label ?? ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent, onClick }: {
  label: string; value: string; accent?: string; onClick?: () => void;
}) {
  return (
    <div
      className={onClick ? 'card clickable' : 'card'}
      style={{ marginBottom: 0 }}
      onClick={onClick}
    >
      <div className="muted small" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontFamily: 'var(--serif)', fontWeight: 600, color: accent }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [signOff, setSignOff] = useState(0);
  const [approvals, setApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: cs },
        { data: dl },
        { data: fu },
        { data: tk },
        { count: comm },
        { count: apr },
      ] = await Promise.all([
        supabase.from('cases').select('id, status, sol_date, clients(full_name)'),
        supabase.from('deadlines').select('id, type, label, due_at, cases(id, clients(full_name))').eq('satisfied', false),
        supabase.from('follow_ups').select('id, label, due_at, cases(id, clients(full_name))').eq('done', false),
        supabase.from('tasks').select('id, title, due_at, cases(id, clients(full_name))').eq('status', 'open'),
        supabase.from('communications').select('id', { count: 'exact', head: true }).in('status', ['draft', 'queued']),
        supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
      ]);
      setCases(cs ?? []);
      setDeadlines(dl ?? []);
      setFollowUps(fu ?? []);
      setTasks(tk ?? []);
      setSignOff(comm ?? 0);
      setApprovals(apr ?? 0);
      setLoading(false);
    })();
  }, []);

  const open = cases.filter(c => !CLOSED_STATUSES.includes(c.status));
  const reviewing = cases.filter(c => REVIEW_STATUSES.includes(c.status)).length;

  // SOL watch — open cases with a statute date inside 90 days (incl. overdue).
  const sol: Item[] = open
    .filter(c => c.sol_date)
    .map(c => ({ c, days: daysFromToday(c.sol_date) }))
    .filter(x => x.days !== null && x.days <= 90)
    .sort((a, b) => (a.days! - b.days!))
    .map(({ c, days }) => ({
      key: c.id, caseId: c.id, name: caseName(c), detail: `SOL ${c.sol_date}`, days,
    }));

  // Unsatisfied deadlines inside 30 days (incl. overdue).
  const dlItems: Item[] = deadlines
    .map(d => ({ d, days: daysFromToday(d.due_at) }))
    .filter(x => x.days !== null && x.days! <= 30)
    .sort((a, b) => (a.days! - b.days!))
    .map(({ d, days }) => ({
      key: d.id, caseId: d.cases?.id,
      name: caseName(d.cases),
      detail: (d.label || (d.type ?? '').replace(/_/g, ' ') || 'Deadline'),
      days,
    }));

  // Open follow-ups due inside 7 days (incl. overdue).
  const fuItems: Item[] = followUps
    .map(f => ({ f, days: daysFromToday(f.due_at) }))
    .filter(x => x.days !== null && x.days! <= 7)
    .sort((a, b) => (a.days! - b.days!))
    .map(({ f, days }) => ({
      key: f.id, caseId: f.cases?.id, name: caseName(f.cases), detail: f.label ?? 'Follow-up', days,
    }));

  // Open tasks due inside 7 days (incl. overdue).
  const tkItems: Item[] = tasks
    .map(t => ({ t, days: daysFromToday(t.due_at) }))
    .filter(x => x.days !== null && x.days! <= 7)
    .sort((a, b) => (a.days! - b.days!))
    .map(({ t, days }) => ({
      key: t.id, caseId: t.cases?.id, name: t.title ?? 'Task', detail: `For ${caseName(t.cases)}`, days,
    }));

  const overdueDeadlines = dlItems.filter(i => i.days !== null && i.days < 0).length;
  const solCritical = sol.filter(i => i.days !== null && i.days <= 30).length;
  const openCase = (id?: string) => id && nav(`/cases/${id}`);

  if (loading) return <div className="muted">Loading…</div>;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">What needs attention · {open.length} open cases</div>
        </div>
      </div>

      {/* Headline stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="Open cases" value={String(open.length)} onClick={() => nav('/cases')} />
        <StatCard label="Awaiting review" value={String(reviewing)} onClick={() => nav('/cases')} />
        <StatCard label="SOL ≤30 days" value={String(solCritical)}
          accent={solCritical > 0 ? 'var(--bad)' : undefined} />
        <StatCard label="Overdue deadlines" value={String(overdueDeadlines)}
          accent={overdueDeadlines > 0 ? 'var(--bad)' : undefined} onClick={() => nav('/calendar')} />
        <StatCard label="Awaiting sign-off" value={String(signOff + approvals)}
          accent={(signOff + approvals) > 0 ? 'var(--warn)' : undefined} onClick={() => nav('/approvals')} />
      </div>

      {/* SOL watch — the headline malpractice-risk widget */}
      <ListCard
        title="Statute of limitations watch"
        accent="bad"
        items={sol}
        empty="No cases approaching SOL in the next 90 days."
        onOpen={openCase}
        viewAll={{ label: 'Open caseload', go: () => nav('/cases') }}
      />

      <div className="grid two">
        <ListCard
          title="Deadlines"
          accent="warn"
          items={dlItems}
          empty="No deadlines due in the next 30 days."
          onOpen={openCase}
          viewAll={{ label: 'Calendar & deadlines', go: () => nav('/calendar') }}
        />
        <ListCard
          title="Open tasks"
          accent="gold"
          items={tkItems}
          empty="No tasks due this week."
          onOpen={openCase}
        />
      </div>

      <div className="grid two">
        <ListCard
          title="Follow-ups due"
          accent="gold"
          items={fuItems}
          empty="No follow-ups due this week."
          onOpen={openCase}
        />
        <div className="card">
          <h3>Needs your sign-off</h3>
          <dl className="kv" style={{ marginTop: 10 }}>
            <dt>Drafts awaiting release</dt>
            <dd>{signOff > 0 ? <span className="tag gold">{signOff}</span> : <span className="muted">—</span>}</dd>
            <dt>Approvals requested</dt>
            <dd>{approvals > 0 ? <span className="tag gold">{approvals}</span> : <span className="muted">—</span>}</dd>
          </dl>
          {(signOff + approvals) > 0 && (
            <div className="small muted clickable" style={{ marginTop: 10 }} onClick={() => nav('/approvals')}>
              Go to approval inbox
            </div>
          )}
        </div>
      </div>
    </>
  );
}
