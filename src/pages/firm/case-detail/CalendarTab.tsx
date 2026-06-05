import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const DEADLINE_TYPES = ['sol','notice_of_claim','demand_reply','litigation_response','hearing','other'];

interface Props {
  caseId: string;
  firmId: string;
}

export default function CalendarTab({ caseId, firmId }: Props) {
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [dlForm, setDlForm] = useState({ type: 'sol', due_at: '', label: '' });
  const [addingDl, setAddingDl] = useState(false);

  const [taskForm, setTaskForm] = useState({ title: '', due_at: '' });
  const [addingTask, setAddingTask] = useState(false);

  const [evtForm, setEvtForm] = useState({ title: '', starts_at: '', ends_at: '' });
  const [addingEvt, setAddingEvt] = useState(false);

  async function load() {
    const { data: dl } = await supabase.from('deadlines').select('*').eq('case_id', caseId).order('due_at');
    setDeadlines(dl ?? []);
    const { data: tk } = await supabase.from('tasks').select('*').eq('case_id', caseId).order('due_at');
    setTasks(tk ?? []);
    const { data: ev } = await supabase.from('calendar_events').select('*').eq('case_id', caseId).order('starts_at');
    setEvents(ev ?? []);
  }
  useEffect(() => { load(); }, [caseId]);

  const today = new Date().toISOString().slice(0, 10);

  async function addDeadline() {
    if (!dlForm.due_at) return;
    setAddingDl(true);
    await supabase.from('deadlines').insert({
      case_id: caseId,
      type: dlForm.type,
      due_at: dlForm.due_at,
      label: dlForm.label || null,
    });
    setDlForm({ type: 'sol', due_at: '', label: '' });
    setAddingDl(false);
    load();
  }

  async function toggleSatisfied(id: string, current: boolean) {
    await supabase.from('deadlines').update({ satisfied: !current }).eq('id', id);
    load();
  }

  async function addTask() {
    if (!taskForm.title) return;
    setAddingTask(true);
    await supabase.from('tasks').insert({
      case_id: caseId,
      title: taskForm.title,
      due_at: taskForm.due_at || null,
    });
    setTaskForm({ title: '', due_at: '' });
    setAddingTask(false);
    load();
  }

  async function setTaskStatus(id: string, status: string) {
    await supabase.from('tasks').update({ status }).eq('id', id);
    load();
  }

  async function addEvent() {
    if (!evtForm.title || !evtForm.starts_at) return;
    setAddingEvt(true);
    await supabase.from('calendar_events').insert({
      firm_id: firmId,
      case_id: caseId,
      title: evtForm.title,
      starts_at: evtForm.starts_at,
      ends_at: evtForm.ends_at || null,
    });
    setEvtForm({ title: '', starts_at: '', ends_at: '' });
    setAddingEvt(false);
    load();
  }

  return (
    <>
      {/* --- Deadlines --- */}
      <div className="card">
        <h3>Deadlines</h3>
        <table>
          <thead><tr><th>Type</th><th>Label</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {deadlines.map(d => {
              const overdue = !d.satisfied && d.due_at < today;
              return (
                <tr key={d.id}>
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
            {deadlines.length === 0 && <tr><td colSpan={4} className="muted">No deadlines recorded.</td></tr>}
          </tbody>
        </table>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: 14, fontFamily: 'var(--sans)', fontWeight: 600, marginBottom: 8 }}>Add deadline</h4>
          <div className="row">
            <div>
              <label>Type</label>
              <select value={dlForm.type} onChange={e => setDlForm(f => ({ ...f, type: e.target.value }))}>
                {DEADLINE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label>Due date</label>
              <input type="date" value={dlForm.due_at} onChange={e => setDlForm(f => ({ ...f, due_at: e.target.value }))} />
            </div>
            <div>
              <label>Label</label>
              <input value={dlForm.label} onChange={e => setDlForm(f => ({ ...f, label: e.target.value }))} placeholder="Optional description" />
            </div>
          </div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={addDeadline} disabled={addingDl || !dlForm.due_at}>
            {addingDl ? 'Saving...' : 'Add deadline'}
          </button>
        </div>
      </div>

      {/* --- Tasks --- */}
      <div className="card">
        <h3>Tasks</h3>
        <table>
          <thead><tr><th>Title</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td className="small">{t.title}</td>
                <td className="small">{t.due_at ? new Date(t.due_at).toLocaleDateString() : '--'}</td>
                <td><span className={`tag tiny ${t.status === 'done' ? 'good' : t.status === 'snoozed' ? 'gold' : 'warn'}`}>{t.status}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {t.status !== 'done' && (
                    <button className="btn sm ghost" style={{ marginRight: 4 }} onClick={() => setTaskStatus(t.id, 'done')}>Done</button>
                  )}
                  {t.status === 'open' && (
                    <button className="btn sm ghost" onClick={() => setTaskStatus(t.id, 'snoozed')}>Snooze</button>
                  )}
                  {t.status === 'snoozed' && (
                    <button className="btn sm ghost" onClick={() => setTaskStatus(t.id, 'open')}>Reopen</button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={4} className="muted">No tasks recorded.</td></tr>}
          </tbody>
        </table>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: 14, fontFamily: 'var(--sans)', fontWeight: 600, marginBottom: 8 }}>Add task</h4>
          <div className="row">
            <div>
              <label>Title</label>
              <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task description" />
            </div>
            <div>
              <label>Due (optional)</label>
              <input type="datetime-local" value={taskForm.due_at} onChange={e => setTaskForm(f => ({ ...f, due_at: e.target.value }))} />
            </div>
          </div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={addTask} disabled={addingTask || !taskForm.title}>
            {addingTask ? 'Saving...' : 'Add task'}
          </button>
        </div>
      </div>

      {/* --- Calendar events --- */}
      <div className="card">
        <h3>Calendar events</h3>
        <p className="muted small" style={{ marginTop: 0 }}>Google Calendar sync coming later — events are local only.</p>
        <table>
          <thead><tr><th>Title</th><th>Starts</th><th>Ends</th></tr></thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id}>
                <td className="small">{e.title}</td>
                <td className="small">{e.starts_at ? new Date(e.starts_at).toLocaleString() : '--'}</td>
                <td className="small">{e.ends_at ? new Date(e.ends_at).toLocaleString() : '--'}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={3} className="muted">No events recorded.</td></tr>}
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
          <button className="btn sm" style={{ marginTop: 8 }} onClick={addEvent} disabled={addingEvt || !evtForm.title || !evtForm.starts_at}>
            {addingEvt ? 'Saving...' : 'Add event'}
          </button>
        </div>
      </div>
    </>
  );
}
