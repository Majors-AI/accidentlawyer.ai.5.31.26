import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

// Stage 2 — Client Registration. The new client's engagement step: confirm
// identity, review representation + the firm's contingency fee, grant the
// required authorizations, and sign electronically. Writes the engagement flags
// already on the clients row (registered / agreed_to_hire / engagement_signed_at).
//
// DRAFT LEGAL COPY — every block tagged "DRAFT — Dom verbatim" is placeholder
// language for Dom to replace. Not final legal text.

const cbRow = { display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 400, color: 'var(--ink)', marginTop: 12 } as const;
const cbBox = { width: 18, marginTop: 3 } as const;
const fld = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line, rgba(0,0,0,.15))', marginTop: 4 } as const;

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return (Math.round(n * 10000) / 100) + '%';
}

export default function ClientRegistration() {
  const { profile } = useAuth();
  const nav = useNavigate();

  const [client, setClient] = useState<any>(null);
  const [firm, setFirm] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [agreeRetain, setAgreeRetain] = useState(false);
  const [agreeHipaa, setAgreeHipaa] = useState(false);
  const [agreeComms, setAgreeComms] = useState(false);

  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: cl } = await supabase.from('clients').select('*').eq('profile_id', profile?.id).maybeSingle();
      if (!active) return;
      setClient(cl);
      setFullName((cl && cl.full_name) || profile?.full_name || '');
      setEmail((cl && cl.email) || profile?.email || '');
      setPhone((cl && cl.phone) || '');
      if (cl && cl.firm_id) {
        const { data: fm } = await supabase.from('firms').select('*').eq('id', cl.firm_id).maybeSingle();
        if (active) setFirm(fm);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [profile?.id]);

  const canSubmit = agreeRetain && agreeHipaa && agreeComms && signature.trim().length > 1 && !busy;

  async function submit() {
    if (!client || !canSubmit) return;
    setBusy(true);
    await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile?.id);
    await supabase.from('clients').update({
      registered: true,
      agreed_to_hire: true,
      engagement_signed_at: new Date().toISOString(),
    }).eq('id', client.id);
    setBusy(false);
    nav('/journey/client-portal');
  }

  if (loading) return <div className="muted">Loading…</div>;

  if (!client) {
    return (
      <>
        <div className="page-h"><div className="page-h-left"><h1>Client Registration</h1>
          <div className="sub">Your engagement with the firm.</div></div></div>
        <div className="card"><span className="tag gold">No client record yet</span>
          <p style={{ marginTop: 12 }}>We couldn’t find your client record. This step opens once the firm has set up your file. If you think this is a mistake, reach out to your firm contact.</p>
        </div>
      </>
    );
  }

  if (client.registered) {
    return (
      <>
        <div className="page-h"><div className="page-h-left"><h1>Client Registration</h1>
          <div className="sub">Your engagement with the firm.</div></div></div>
        <div className="card"><span className="tag good">Registered</span>
          <p style={{ marginTop: 12 }}>You’re all set — your engagement is signed and your secure portal is active.</p>
          <button className="btn oxblood" onClick={() => nav('/journey/client-portal')}>Go to my portal</button>
        </div>
      </>
    );
  }

  const preLit = firm ? pct(firm.fee_pre_lit) : '—';
  const lit = firm ? pct(firm.fee_lit) : '—';
  const firmName = (firm && firm.name) || 'the firm';

  return (
    <>
      <div className="page-h"><div className="page-h-left"><h1>Client Registration</h1>
        <div className="sub">Confirm your details, review your representation, and sign your engagement.</div></div></div>

      <div className="card" style={{ maxWidth: 680 }}>
        <h3>Your information</h3>
        <p className="small">Confirm these are correct before you sign.</p>
        <label style={{ display: 'block', marginTop: 10 }}>Full legal name
          <input style={fld} value={fullName} onChange={e => setFullName(e.target.value)} />
        </label>
        <label style={{ display: 'block', marginTop: 10 }}>Email
          <input style={{ ...fld, opacity: .7 }} value={email} readOnly />
        </label>
        <label style={{ display: 'block', marginTop: 10 }}>Phone
          <input style={fld} value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
      </div>

      <div className="card" style={{ maxWidth: 680, marginTop: 16 }}>
        <h3>Your representation</h3>
        {/* DRAFT — Dom verbatim */}
        <p className="small">{firmName} will represent you on your personal-injury claim on a contingency-fee basis. You owe no attorney fee unless the firm recovers compensation for you. The contingency fee is <b>{preLit}</b> of the recovery before a lawsuit is filed, and <b>{lit}</b> if the case proceeds into litigation. Case costs are handled as described in your full fee agreement. Representation covers your personal-injury claim and does not include your property-damage claim, though the firm will help you track it.</p>
        <p className="small" style={{ opacity: .6, marginTop: 8 }}><i>Draft summary — your full written fee agreement controls.</i></p>
      </div>

      <div className="card" style={{ maxWidth: 680, marginTop: 16 }}>
        <h3>Authorizations & consent</h3>
        {/* DRAFT — Dom verbatim */}
        <label style={cbRow}>
          <input type="checkbox" style={cbBox} checked={agreeRetain} onChange={e => setAgreeRetain(e.target.checked)} />
          <span>I agree to retain {firmName} to represent me on my personal-injury claim, as described in my fee agreement, including the contingency fee shown above.</span>
        </label>
        {/* DRAFT — Dom verbatim (HIPAA medical-records authorization) */}
        <label style={cbRow}>
          <input type="checkbox" style={cbBox} checked={agreeHipaa} onChange={e => setAgreeHipaa(e.target.checked)} />
          <span>I authorize my healthcare providers to release medical records and bills related to my injuries to {firmName} for the purpose of pursuing my claim (HIPAA authorization). I understand I may revoke this in writing.</span>
        </label>
        {/* DRAFT — Dom verbatim (communications consent) */}
        <label style={cbRow}>
          <input type="checkbox" style={cbBox} checked={agreeComms} onChange={e => setAgreeComms(e.target.checked)} />
          <span>I consent to secure communication and document sharing through this portal, and to be contacted by {firmName} by email and text about my case. Message/data rates may apply; I can opt out at any time.</span>
        </label>
      </div>

      <div className="card" style={{ maxWidth: 680, marginTop: 16 }}>
        <h3>Electronic signature</h3>
        <p className="small">Type your full legal name to sign. This is your legally binding electronic signature, dated {new Date().toLocaleDateString()}.</p>
        <input style={fld} placeholder="Type your full name to sign" value={signature} onChange={e => setSignature(e.target.value)} />
        <button className="btn oxblood" style={{ marginTop: 18 }} disabled={!canSubmit} onClick={submit}>
          {busy ? 'Signing…' : 'Sign & complete registration'}
        </button>
        {!canSubmit && !busy && (
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>Check all three authorizations and type your name to continue.</div>
        )}
      </div>
    </>
  );
}
