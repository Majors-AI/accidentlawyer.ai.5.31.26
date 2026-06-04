import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function Journal() {
  const { profile } = useAuth();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    content: '',
    pain_level: 5,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: cl } = await supabase
        .from('clients').select('id').eq('profile_id', profile?.id).maybeSingle();
      if (!cl) return;
      const { data } = await supabase
        .from('cases').select('id').eq('client_id', cl.id)
        .order('created_at', { ascending: false }).limit(1);
      if (data?.[0]) { setCaseId(data[0].id); load(data[0].id); }
    })();
  }, []);

  async function load(id: string) {
    const { data } = await supabase
      .from('journal_entries').select('*')
      .eq('case_id', id).eq('kind', 'pain')
      .order('entry_date', { ascending: false });
    setEntries(data ?? []);
  }

  async function save() {
    if (!caseId) return;
    setErr(''); setBusy(true);
    const { error } = await supabase.from('journal_entries').insert({
      case_id: caseId,
      kind: 'pain',
      entry_date: form.entry_date,
      content: form.content,
      pain_level: form.pain_level,
    });
    if (error) setErr(error.message);
    else { setForm(f => ({ ...f, content: '', pain_level: 5 })); load(caseId); }
    setBusy(false);
  }

  const levelColor = (n: number) =>
    n >= 7 ? 'var(--bad)' : n >= 4 ? 'var(--warn)' : 'var(--good)';

  const tagClass = (n: number) =>
    n >= 7 ? 'bad' : n >= 4 ? 'warn' : 'good';

  const fmtDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US',
      { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Injury journal</h1>
          <div className="sub">Log daily pain and symptoms — entries become evidence for your claim.</div>
        </div>
      </div>

      {!caseId ? (
        <div className="card"><span className="muted">No case on file yet.</span></div>
      ) : (
        <>
          <div className="card" style={{ maxWidth: 600 }}>
            <h3>New entry</h3>

            <div className="row">
              <div>
                <label>Date</label>
                <input type="date" value={form.entry_date}
                  onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
              </div>
              <div>
                <label>Pain level — {form.pain_level} / 10</label>
                <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                  {Array.from({ length: 10 }, (_, i) => {
                    const filled = i < form.pain_level;
                    const col = levelColor(form.pain_level);
                    return (
                      <span
                        key={i}
                        onClick={() => setForm(f => ({ ...f, pain_level: i + 1 }))}
                        style={{
                          width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                          background: filled ? col : 'var(--paper-2)',
                          border: `1.5px solid ${filled ? col : 'var(--line)'}`,
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <label>Pain locations, symptoms &amp; notes</label>
            <textarea rows={4} value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Where does it hurt? How are activities affected? How are you feeling today?" />

            {err && <div className="err">{err}</div>}
            <button
              className="btn oxblood"
              style={{ marginTop: 14 }}
              disabled={busy || !form.content.trim()}
              onClick={save}
            >
              {busy ? 'Saving…' : 'Save entry'}
            </button>
          </div>

          <div className="card">
            <h3>Journal history</h3>
            {entries.length === 0 && (
              <span className="muted small">No entries yet — start logging above.</span>
            )}
            {entries.map(e => (
              <div key={e.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--paper-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <b className="small">{fmtDate(e.entry_date)}</b>
                  {e.pain_level != null && (
                    <span className={`tag tiny ${tagClass(e.pain_level)}`}>
                      {e.pain_level} / 10
                    </span>
                  )}
                </div>
                <p className="small" style={{ margin: 0, color: 'var(--ink-soft)' }}>{e.content}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
