import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function Calendar() {
  const { profile } = useAuth();
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);

  const [evtForm, setEvtForm] = useState({ title: '', starts_at: '', ends_at: '', case_id: '' });
  const [addingEvt, setAddingEvt] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    const { data: dl } = await supabase
      .from('deadlines')
      .select('*, cases(id, clients(full_name))')
      .order('due_at');
    setDeadlines(dl ?? []);

    const { data: tk } = await supabase
      .from('tasks')
      .select('*, cases(id, clients(full_name))')
      .eq('status', 'open')
      .order('due_at');
    setTasks(tk ?? []);

    const { data: ev } = await supabase
      .from('calendar_events')
      .select('*, cases(id, clients(full_name))')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at');
    setEvents(ev ?? []);

    const { data: cs } = await supabase
      .from('cases')
      .select('id, clients(full_name)')
      .neq('status', 'closed')
      .order('created_at', { ascending: false });
    setCases(cs ?? []);
  }
  useEffect(() => { load(); }, []);

  async function toggleSatisfied(id: string, current: boolean) {
    await supabase.from('deadlines').update({ satisfied: !current }).eq('id', id);
    load();
  }

  async function setTaskStatus(id: string, status: string) {
    await supabase.from('tasks').update({ status }).eq('id', id);
    load();
  }

  async function addEvent() {
    if (!evtForm.title || !evtForm.starts_at || !profile?.firm_id) return;
    setAddingEvt(true);
    await supabase.from('calendar_events').insert({
      firm_id: profile.firm_id,
      case_id: evtForm.case_id || null,
      title: evtForm.title,
      starts_at: evtForm.starts_at,
      ends_at: evtForm.ends_at || null,
    });
    setEvtForm({ title: '', starts_at: '', ends_at: '', case_id: '' });
    setAddingEvt(false);
    load();
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20 }}>Calendar &amp; deadlines</h2>

      {/* --- Deadlines across all firm cases --- */}
      <div className="card">
        <h3>Deadlines</h3>
        <table>
          <thead>
            <tr><th>Case</th><th>Type</th><th>Label</th><th>Due</th><th>Status</th></tr>
          </thead>
          <tbody>
            {deadlines.map(d => {
              const overdue = !d.satisfied && d.due_at < today;
              return (
                <tr key={d.id}>
                  <td className="small">{d.cases?.clients?.full_name ?? '—'}</td>
                  <td className="small">{d.type.replace(/_/g, ' ')}</td>
                  <td className="small">{d.label ?? '--'}</td>
                  <td className="small" style={overdue ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>
                    {d.due_at}
                  </td>
                  <td>
                    <span
                      className={`tag tiny ${d.satisfied ? 'good' : overdue ? 'bad' : 'warn'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleSatisfied(d.id, d.satisfied)}
                    >
                      {d.satisfied ? 'satisfied' : overdue ? 'overdue' : 'open'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {deadlines.length === 0 && <tr><td colSpan={5} className="muted">No deadlines recorded.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* --- Open tasks across all firm cases --- */}
      <div className="card">
        <h3>Open tasks</h3>
        <table>
          <thead>
            <tr><th>Case</th><th>Title</th><th>Due</th><th></th></tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td className="small">{t.cases?.clients?.full_name ?? '—'}</td>
                <td className="small">{t.title}</td>
                <td className="small">{t.due_at ? new Date(t.due_at).toLocaleDateString() : '--'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm ghost" style={{ marginRight: 4 }} onClick={() => setTaskStatus(t.id, 'done')}>Done</button>
                  <button className="btn sm ghost" onClick={() => setTaskStatus(t.id, 'snoozed')}>Snooze</button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={4} className="muted">No open tasks.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* --- Upcoming calendar events --- */}
      <div className="card">
        <h3>Upcoming events</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Google Calendar sync coming later — events are local only.
        </p>
        <table>
          <thead>
            <tr><th>Title</th><th>Case</th><th>Starts</th><th>Ends</th></tr>
          </thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id}>
                <td className="small">{e.title}</td>
                <td className="small">{e.cases?.clients?.full_name ?? '—'}</td>
                <td className="small">{e.starts_at ? new Date(e.starts_at).toLocaleString() : '--'}</td>
                <td className="small">{e.ends_at ? new Date(e.ends_at).toLocaleString() : '--'}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={4} className="muted">No upcoming events.</td></tr>}
          </tbody>
        </table>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: 14, fontFamily: 'var(--sans)', fontWeight: 600, marginBottom: 8 }}>Add event</h4>
          <div className="row">
            <div>
              <label>Title</label>
              <input value={evtForm.title} onChange={e => setEvtForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" />
            </div>
            <div>
              <label>Starts</label>
              <input type="datetime-local" value={evtForm.starts_at} onChange={e => setEvtForm(f => ({ ...f, starts_at: e.target.value }))} />
            </div>
            <div>
              <label>Ends</label>
              <input type="datetime-local" value={evtForm.ends_at} onChange={e => setEvtForm(f => ({ ...f, ends_at: e.target.value }))} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <div>
              <label>Case (optional)</label>
              <select value={evtForm.case_id} onChange={e => setEvtForm(f => ({ ...f, case_id: e.target.value }))}>
                <option value="">-- no specific case --</option>
                {cases.map(cs => (
                  <option key={cs.id} value={cs.id}>{cs.clients?.full_name ?? cs.id}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn sm" onClick={addEvent} disabled={addingEvt || !evtForm.title || !evtForm.starts_at}>
                {addingEvt ? 'Saving...' : 'Add event'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
