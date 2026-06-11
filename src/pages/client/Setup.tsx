import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import { CONSENT_BLOCKS } from '../../clientConsent/blocks';
import { recordConsentSet } from '../../clientConsent/store';
import type { ConsentRecord } from '../../clientConsent/types';

export default function Setup() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [kase, setKase] = useState<any>(null);
  const [agree, setAgree] = useState(false);
  const [consent, setConsent] = useState(false);
  // Stage 2 consent step (additive): one e-signature covers the A–F slots.
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [ackBlocks, setAckBlocks] = useState(false);
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
    // Stage 2 capture — write the A–F acknowledgements through the consent seam
    // FIRST (one row per block), then run the existing engagement/registration
    // update so onboarding behaves exactly as before. recordConsentSet is an
    // in-memory STUB this pass (client_consents lands with migration 13).
    const signed_at = new Date().toISOString();
    const records: ConsentRecord[] = CONSENT_BLOCKS.map((b) => ({
      client_id: client.id,
      firm_id: client.firm_id ?? null,
      agreement_kind: b.kind,
      agreement_version: b.version,
      signer_name: signerName.trim(),
      signer_title: signerTitle.trim() || null,
      signed_at,
      signer_ip: null,                  // TODO: server-side capture — never client-reported
      jurisdiction: kase?.jurisdiction ?? null,
    }));
    await recordConsentSet(records);

    await supabase.from('clients').update({
      agreed_to_hire: true, registered: true, engagement_signed_at: signed_at,
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

          {/* Stage 2 consent step (additive). A–F are PLACEHOLDER slots — Dom's
              verbatim text drops in later; nothing operative is shown here. */}
          <h3 style={{marginTop:24}}>Required disclosures &amp; authorizations</h3>
          <p className="small">Please review each item below. Draft language shown is pending attorney review.</p>
          <div style={{display:'grid',gap:10,marginTop:8}}>
            {CONSENT_BLOCKS.map((b) => (
              <details key={b.slot} className="card" style={{padding:'10px 12px'}}>
                <summary style={{cursor:'pointer',fontWeight:600}}>
                  {b.slot}. {b.label} <span className="small muted">({b.version})</span>
                </summary>
                <pre style={{whiteSpace:'pre-wrap',fontSize:12,marginTop:8,color:'var(--ink)'}}>{b.body}</pre>
              </details>
            ))}
          </div>

          <div style={{display:'grid',gap:8,marginTop:16,maxWidth:380}}>
            <label className="small">Your full legal name (typing it is your electronic signature)
              <input value={signerName} onChange={e=>setSignerName(e.target.value)} placeholder="Full legal name" />
            </label>
            <label className="small">Title / capacity (optional — e.g. parent/guardian)
              <input value={signerTitle} onChange={e=>setSignerTitle(e.target.value)} placeholder="Optional" />
            </label>
          </div>
          <label style={{display:'flex',gap:10,alignItems:'flex-start',fontWeight:400,color:'var(--ink)',marginTop:12}}>
            <input type="checkbox" style={{width:18,marginTop:3}} checked={ackBlocks} onChange={e=>setAckBlocks(e.target.checked)} />
            <span>I have read the disclosures and authorizations above (items A–F) and adopt my typed name as my electronic signature for each.</span>
          </label>

          <button className="btn oxblood" style={{marginTop:18}} disabled={!agree||!consent||!ackBlocks||!signerName.trim()||busy} onClick={complete}>
            {busy?'Activating…':'Sign & activate communication'}
          </button>
        </div>
      )}
    </>
  );
}
