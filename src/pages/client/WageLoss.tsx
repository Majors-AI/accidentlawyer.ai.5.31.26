import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

function today() { return new Date().toISOString().slice(0, 10); }

export default function WageLoss() {
  const { profile } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [rateForm, setRateForm] = useState({ type: 'hourly', value: '' });
  const [editingRate, setEditingRate] = useState(false);
  const [form, setForm] = useState({ entry_date: today(), hours_missed: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: cl } = await supabase
        .from('clients').select('*').eq('profile_id', profile?.id).maybeSingle();
      setClient(cl);
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
      .eq('case_id', id).eq('kind', 'lost_wages')
      .order('entry_date', { ascending: false });
    setEntries(data ?? []);
  }

  // hourly_rate takes precedence; fall back to salary_annual ÷ 2080 (52 wks × 40 hrs)
  const effectiveRate: number | null =
    client?.hourly_rate != null ? Number(client.hourly_rate)
    : client?.salary_annual != null ? Number(client.salary_annual) / 2080
    : null;

  async function saveRate() {
    if (!client || !rateForm.value) return;
    const val = parseFloat(rateForm.value);
    if (isNaN(val) || val <= 0) return;
    setBusy(true);
    await supabase.from('clients').update(
      rateForm.type === 'hourly'
        ? { hourly_rate: val, salary_annual: null }
        : { hourly_rate: null, salary_annual: val }
    ).eq('id', client.id);
    const { data: cl } = await supabase.from('clients').select('*').eq('id', client.id).single();
    setClient(cl);
    setEditingRate(false);
    setBusy(false);
  }

  async function logEntry() {
    if (!caseId || effectiveRate == null) return;
    const hours = parseFloat(form.hours_missed);
    if (isNaN(hours) || hours <= 0 || !form.reason.trim()) return;
    setErr(''); setBusy(true);
    const amount = +(hours * effectiveRate).toFixed(2);
    const { error } = await supabase.from('journal_entries').insert({
      case_id: caseId,
      kind: 'lost_wages',
      entry_date: form.entry_date,
      content: form.reason,
      amount,
    });
    if (error) setErr(error.message);
    else { setForm({ entry_date: today(), hours_missed: '', reason: '' }); load(caseId!); }
    setBusy(false);
  }

  const total = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const previewLoss = form.hours_missed && effectiveRate != null
    ? (parseFloat(form.hours_missed) * effectiveRate)
    : null;

  const needsRate = effectiveRate == null || editingRate;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Wage loss</h1>
          <div className="sub">Track income lost due to your injury — logged entries support your damages claim.</div>
        </div>
      </div>

      {/* ---- Rate setup ---- */}
      {needsRate && (
        <div className="card" style={{ maxWidth: 500 }}>
          <h3>{editingRate ? 'Update your pay rate' : 'Set your pay rate'}</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            Your declared rate lets us calculate losses automatically.
          </p>
          <div className="row">
            <div>
              <label>Rate type</label>
              <select value={rateForm.type}
                onChange={e => setRateForm(r => ({ ...r, type: e.target.value }))}>
                <option value="hourly">Hourly rate</option>
                <option value="salary">Annual salary</option>
              </select>
            </div>
            <div>
              <label>{rateForm.type === 'hourly' ? 'Hourly rate ($)' : 'Annual salary ($)'}</label>
              <input
                type="number" min="0" step="0.01"
                value={rateForm.value}
                onChange={e => setRateForm(r => ({ ...r, value: e.target.value }))}
                placeholder={rateForm.type === 'hourly' ? '25.00' : '52000'}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn oxblood sm" disabled={busy || !rateForm.value} onClick={saveRate}>
              Save rate
            </button>
            {editingRate && (
              <button className="btn ghost sm" onClick={() => setEditingRate(false)}>Cancel</button>
            )}
          </div>
        </div>
      )}

      {/* ---- Log form ---- */}
      {!needsRate && (
        <>
          <div className="card" style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Log missed time</h3>
              <span className="small muted">
                Rate: <b>${effectiveRate!.toFixed(2)}/hr</b>
                {client?.salary_annual && !client?.hourly_rate && (
                  <span className="muted tiny" style={{ marginLeft: 4 }}>(salary ÷ 2080)</span>
                )}
                <button className="btn ghost sm" style={{ marginLeft: 10 }}
                  onClick={() => setEditingRate(true)}>Edit</button>
              </span>
            </div>

            <div className="row">
              <div>
                <label>Date</label>
                <input type="date" value={form.entry_date}
                  onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
              </div>
              <div>
                <label>Hours missed</label>
                <input type="number" min="0.25" step="0.25" value={form.hours_missed}
                  onChange={e => setForm(f => ({ ...f, hours_missed: e.target.value }))}
                  placeholder="4" />
              </div>
            </div>

            <label>Reason</label>
            <input value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="PT appointment, doctor visit, too much pain to work…" />

            {previewLoss != null && !isNaN(previewLoss) && previewLoss > 0 && (
              <div className="small muted" style={{ marginTop: 8 }}>
                Estimated loss: <b>${previewLoss.toFixed(2)}</b>
              </div>
            )}

            {err && <div className="err">{err}</div>}
            <button
              className="btn oxblood"
              style={{ marginTop: 14 }}
              disabled={busy || !form.hours_missed || !form.reason.trim()}
              onClick={logEntry}
            >
              {busy ? 'Logging…' : '+ Log missed time'}
            </button>
          </div>

          {/* ---- Entry table ---- */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Missed time log</h3>
              {entries.length > 0 && (
                <span className="tag good">
                  Total: ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {entries.length === 0 && (
              <span className="muted small">No entries yet — log missed time above.</span>
            )}

            {entries.length > 0 && (
              <table>
                <thead>
                  <tr><th>Date</th><th>Reason</th><th style={{ textAlign: 'right' }}>Loss</th></tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td className="small">
                        {new Date(e.entry_date + 'T12:00:00').toLocaleDateString()}
                      </td>
                      <td className="small">{e.content ?? '—'}</td>
                      <td className="small" style={{ textAlign: 'right' }}>
                        <b>${Number(e.amount).toFixed(2)}</b>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--paper-2)' }}>
                    <td colSpan={2} className="small"><b>Running total</b></td>
                    <td className="small" style={{ textAlign: 'right' }}>
                      <b>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
