import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function Intake() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({
    claim: 'mva', date_of_loss: '', location: '', narrative: '',
    adverse_name: '', adverse_carrier: '',
    um_uim_carrier: '', pip_carrier: '',
    health_insurer: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }));

  async function submit() {
    setErr(''); setBusy(true);
    // In production the firm comes from the branded intake portal; for the demo we attach to the first firm.
    const { data: firmRow } = await supabase.from('firms').select('id').limit(1).maybeSingle();
    const firmId = firmRow?.id ?? null;
    // find or create this user's client record
    const { data: cl } = await supabase.from('clients').select('id').eq('profile_id', profile?.id).maybeSingle();
    let clientId = cl?.id;
    if (!clientId) {
      const { data: made } = await supabase.from('clients')
        .insert({ profile_id: profile?.id, full_name: profile?.full_name, email: profile?.email, firm_id: firmId }).select().single();
      clientId = made?.id;
    }
    const { data: kase, error } = await supabase.from('cases').insert({
      client_id: clientId, firm_id: firmId, status: 'under_review', claim: f.claim, jurisdiction: 'AZ',
      date_of_loss: f.date_of_loss || null, location: f.location, narrative: f.narrative,
    }).select().single();
    if (error) { setErr(error.message); setBusy(false); return; }
    // Conflicts review is created automatically by a DB trigger on case insert.

    const caseId = kase.id;

    // Adverse party name → parties row
    if (f.adverse_name.trim())
      await supabase.from('parties').insert({ case_id: caseId, role: 'adverse', name: f.adverse_name.trim() });

    // Insurance policy rows — only insert when a carrier was provided
    if (f.adverse_carrier.trim())
      await supabase.from('insurance_policies').insert({ case_id: caseId, kind: 'adverse_liability', carrier: f.adverse_carrier.trim() });
    if (f.um_uim_carrier.trim())
      await supabase.from('insurance_policies').insert({ case_id: caseId, kind: 'client_um_uim', carrier: f.um_uim_carrier.trim() });
    if (f.pip_carrier.trim())
      await supabase.from('insurance_policies').insert({ case_id: caseId, kind: 'pip_medpay', carrier: f.pip_carrier.trim() });

    // Health insurer → clients.health_insurer (existing column; not duplicated as an insurance_policies row)
    // Covered by "client self update" policy from 02_platform.sql (profile_id = auth.uid()).
    if (clientId && f.health_insurer.trim())
      await supabase.from('clients').update({ health_insurer: f.health_insurer.trim() }).eq('id', clientId);

    setBusy(false);
    nav('/');
  }

  return (
    <>
      <div className="page-h"><div><h1>Tell us what happened</h1>
        <div className="sub">An attorney reviews every submission before we take a case.</div></div></div>

      <div className="card" style={{ maxWidth: 640 }}>
        <label>Type of incident</label>
        <select value={f.claim} onChange={e => set('claim', e.target.value)}>
          <option value="mva">Motor vehicle accident</option>
          <option value="slip_and_fall">Slip and fall</option>
          <option value="dog_bite">Dog bite</option>
          <option value="negligence">Negligence</option>
          <option value="wrongful_death">Wrongful death</option>
          <option value="other">Other</option>
        </select>
        <div className="row">
          <div><label>Date of loss</label><input type="date" value={f.date_of_loss} onChange={e => set('date_of_loss', e.target.value)} /></div>
          <div><label>Where it happened</label><input value={f.location} onChange={e => set('location', e.target.value)} placeholder="Intersection, address…" /></div>
        </div>
        <label>What happened?</label>
        <textarea rows={5} value={f.narrative} onChange={e => set('narrative', e.target.value)} placeholder="Describe the accident, injuries, and anything important…" />

        {/* ---- Adverse party ---- */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <div className="small" style={{ fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 2 }}>Adverse party</div>
          <div className="row">
            <div>
              <label>Other driver / party name</label>
              <input value={f.adverse_name} onChange={e => set('adverse_name', e.target.value)} placeholder="Full name (if known)" />
            </div>
            <div>
              <label>Their insurance carrier</label>
              <input value={f.adverse_carrier} onChange={e => set('adverse_carrier', e.target.value)} placeholder="e.g. State Farm (if known)" />
            </div>
          </div>
        </div>

        {/* ---- Your insurance ---- */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <div className="small" style={{ fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 2 }}>Your insurance</div>
          <label>Health insurer</label>
          <input value={f.health_insurer} onChange={e => set('health_insurer', e.target.value)} placeholder="e.g. Blue Cross Blue Shield (if applicable)" />
          <div className="row">
            <div>
              <label>UM / UIM carrier</label>
              <input value={f.um_uim_carrier} onChange={e => set('um_uim_carrier', e.target.value)} placeholder="Your auto carrier (if applicable)" />
            </div>
            <div>
              <label>PIP / MedPay carrier</label>
              <input value={f.pip_carrier} onChange={e => set('pip_carrier', e.target.value)} placeholder="If applicable" />
            </div>
          </div>
        </div>

        {/* ---- Photos deferred to storage phase ---- */}
        <label className="muted" style={{ marginTop: 16 }}>Photos &amp; documents</label>
        <div className="scaffold">File upload connects to Supabase Storage in the next pass — the documents table and file cabinet are already in the schema.</div>

        {err && <div className="err">{err}</div>}
        <button className="btn oxblood" style={{ marginTop: 18 }} disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit for review'}</button>
      </div>
    </>
  );
}
