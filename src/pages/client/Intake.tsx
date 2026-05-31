import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function Intake() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ claim:'mva', date_of_loss:'', location:'', narrative:'' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k:string,v:string)=>setF(s=>({...s,[k]:v}));

  async function submit() {
    setErr(''); setBusy(true);
    // In production the firm comes from the branded intake portal; for the demo we attach to the first firm.
    const { data: firmRow } = await supabase.from('firms').select('id').limit(1).maybeSingle();
    const firmId = firmRow?.id ?? null;
    // find this user's client record
    const { data: cl } = await supabase.from('clients').select('id').eq('profile_id', profile?.id).maybeSingle();
    let clientId = cl?.id;
    if (!clientId) {
      const { data: made } = await supabase.from('clients')
        .insert({ profile_id: profile?.id, full_name: profile?.full_name, email: profile?.email, firm_id: firmId }).select().single();
      clientId = made?.id;
    }
    const { data: kase, error } = await supabase.from('cases').insert({
      client_id: clientId, firm_id: firmId, status:'under_review', claim:f.claim, jurisdiction:'AZ',
      date_of_loss:f.date_of_loss || null, location:f.location, narrative:f.narrative,
    }).select().single();
    if (error) { setErr(error.message); setBusy(false); return; }
    // Conflicts review is created automatically by a DB trigger on case insert.
    setBusy(false);
    nav('/');
  }

  return (
    <>
      <div className="page-h"><div><h1>Tell us what happened</h1>
        <div className="sub">An attorney reviews every submission before we take a case.</div></div></div>

      <div className="card" style={{maxWidth:640}}>
        <label>Type of incident</label>
        <select value={f.claim} onChange={e=>set('claim',e.target.value)}>
          <option value="mva">Motor vehicle accident</option>
          <option value="slip_and_fall">Slip and fall</option>
          <option value="dog_bite">Dog bite</option>
          <option value="negligence">Negligence</option>
          <option value="wrongful_death">Wrongful death</option>
          <option value="other">Other</option>
        </select>
        <div className="row">
          <div><label>Date of loss</label><input type="date" value={f.date_of_loss} onChange={e=>set('date_of_loss',e.target.value)} /></div>
          <div><label>Where it happened</label><input value={f.location} onChange={e=>set('location',e.target.value)} placeholder="Intersection, address…" /></div>
        </div>
        <label>What happened?</label>
        <textarea rows={5} value={f.narrative} onChange={e=>set('narrative',e.target.value)} placeholder="Describe the accident, injuries, and anything important…" />
        <label className="muted">Photos & documents</label>
        <div className="scaffold">File upload connects to Supabase Storage in the next pass — the documents table and file cabinet are already in the schema.</div>
        {err && <div className="err">{err}</div>}
        <button className="btn oxblood" style={{marginTop:18}} disabled={busy} onClick={submit}>{busy?'Submitting…':'Submit for review'}</button>
      </div>
    </>
  );
}
