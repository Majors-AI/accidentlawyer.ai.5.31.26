import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function Profile() {
  const { profile } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [form, setForm] = useState({ full_name: '', phone: '', address: '', health_insurer: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cl } = await supabase
        .from('clients').select('*')
        .eq('profile_id', profile?.id).maybeSingle();
      setClient(cl);
      if (cl) {
        setForm({
          full_name:      cl.full_name     ?? '',
          phone:          cl.phone         ?? '',
          address:        cl.address       ?? '',
          health_insurer: cl.health_insurer ?? '',
        });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!client) return;
    setBusy(true); setErr(''); setSaved(false);
    const { error } = await supabase.from('clients').update({
      full_name:      form.full_name.trim(),
      phone:          form.phone.trim(),
      address:        form.address.trim(),
      health_insurer: form.health_insurer.trim(),
    }).eq('id', client.id);
    if (error) setErr(error.message);
    else setSaved(true);
    setBusy(false);
  }

  const set = (k: string, v: string) => {
    setSaved(false);
    setForm(f => ({ ...f, [k]: v }));
  };

  const fmtDob = (d: string | null) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US',
      { month: 'long', day: 'numeric', year: 'numeric' }) : '—';

  if (loading) return <div className="muted">Loading…</div>;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>My profile</h1>
          <div className="sub">Keep your contact details up to date.</div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Contact information</h3>

          <label>Full name</label>
          <input value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
            placeholder="Your full legal name" />

          <label>Phone</label>
          <input value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="e.g. 602-555-0100" />

          <label>Address</label>
          <input value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="Street, city, state, ZIP" />

          <label>Health insurer</label>
          <input value={form.health_insurer}
            onChange={e => set('health_insurer', e.target.value)}
            placeholder="e.g. Blue Cross Blue Shield" />

          {err && <div className="err">{err}</div>}
          {saved && (
            <div style={{ color: 'var(--good)', fontSize: 13, marginTop: 10, fontWeight: 600 }}>
              Saved.
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn oxblood"
              disabled={busy || !form.full_name.trim()}
              onClick={save}
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Account details</h3>
          <dl className="kv" style={{ marginTop: 8 }}>
            <dt>Email</dt>
            <dd>{profile?.email ?? '—'}</dd>
            <dt>Date of birth</dt>
            <dd>{fmtDob(client?.dob ?? null)}</dd>
            <dt>Role</dt>
            <dd style={{ textTransform: 'capitalize' }}>{profile?.role ?? '—'}</dd>
          </dl>
          <p className="muted tiny" style={{ marginTop: 16 }}>
            To update your email or date of birth, contact your legal team.
          </p>
        </div>
      </div>
    </>
  );
}
