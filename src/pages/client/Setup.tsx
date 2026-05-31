import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function Setup() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [kase, setKase] = useState<any>(null);
  const [agree, setAgree] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: cl } = await supabase.from('clients').select('*').eq('profile_id', profile?.id).maybeSingle();
    setClient(cl);
    if (cl) {
      const { data } = await supabase.from('cases').select('*').eq('client_id', cl.id).order('created_at',{ascending:false}).limit(1);
      setKase(data?.[0] ?? null);
    }
  }
  useEffect(() => { load(); }, []);

  const accepted = kase && ['accepted','treating','demand','settlement','litigation','closed'].includes(kase.status);
  const registered = client?.registered;

  async function complete() {
    setBusy(true);
    await supabase.from('clients').update({
      agreed_to_hire: true, registered: true, engagement_signed_at: new Date().toISOString(),
    }).eq('id', client.id);
    setBusy(false);
    nav('/messages');
  }

  if (!client) return <div className="muted">Loading…</div>;

  return (
    <>
      <div className="page-h"><div><h1>Engagement & setup</h1>
        <div className="sub">Confirm representation and turn on secure in-app communication.</div></div></div>

      {registered ? (
        <div className="card"><span className="tag good">Registered</span>
          <p style={{marginTop:12}}>You’re all set. Your secure messaging with the firm is active.</p>
          <button className="btn oxblood" onClick={()=>nav('/messages')}>Go to messages</button>
        </div>
      ) : !accepted ? (
        <div className="card"><span className="tag gold">Pending review</span>
          <p style={{marginTop:12}}>Once an attorney accepts your case, you’ll be able to sign your engagement here and turn on messaging.</p>
        </div>
      ) : (
        <div className="card" style={{maxWidth:640}}>
          <h3>Agreement to hire</h3>
          <p className="small">Your case has been accepted. To activate in-app communication, please confirm:</p>
          <label style={{display:'flex',gap:10,alignItems:'flex-start',fontWeight:400,color:'var(--ink)'}}>
            <input type="checkbox" style={{width:18,marginTop:3}} checked={agree} onChange={e=>setAgree(e.target.checked)} />
            <span>I agree to retain the firm to represent me on my personal-injury claim, as described in my fee agreement. I understand representation does not cover my property-damage claim, though the firm will help me track it.</span>
          </label>
          <label style={{display:'flex',gap:10,alignItems:'flex-start',fontWeight:400,color:'var(--ink)'}}>
            <input type="checkbox" style={{width:18,marginTop:3}} checked={consent} onChange={e=>setConsent(e.target.checked)} />
            <span>I consent to secure communication and document sharing through this app, and to be contacted by email and text about my case.</span>
          </label>
          <button className="btn oxblood" style={{marginTop:18}} disabled={!agree||!consent||busy} onClick={complete}>
            {busy?'Activating…':'Sign & activate communication'}
          </button>
        </div>
      )}
    </>
  );
}
