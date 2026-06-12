import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import { CONSENT_BLOCKS } from '../../clientConsent/blocks';

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

  // One acknowledgement covers the A–F consent slots (see clientConsent/blocks.ts).
  const [ackBlocks, setAckBlocks] = useState(false);

  const [signature, setSignature] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

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

  const canSubmit = ackBlocks && signature.trim().length > 1 && !busy;

  async function submit() {
    if (!client || !canSubmit) return;
    setBusy(true);
    setErr('');
    // Persist the A–F consents SERVER-SIDE first. The browser sends only its
    // identity-light inputs (typed signature as signer_name, optional capacity)
    // plus which blocks + the exact text it displayed; the record-consent edge
    // function stamps signed_at, signer_ip, user_agent and consent_hash and
    // resolves the client from the session. Registration is GATED on this
    // succeeding — the engagement flags are written only after consent persists.
    const blocks = CONSENT_BLOCKS.map((b) => ({
      agreement_kind: b.kind,
      agreement_version: b.version,
      rendered_text: b.body,
    }));
    const { data, error } = await supabase.functions.invoke('record-consent', {
      body: { signer_name: signature.trim(), signer_title: signerTitle.trim() || null, blocks },
    });
    if (error || (data && (data as any).error)) {
      setErr('We couldn’t record your consent — please try again.');
      setBusy(false);
      return; // do NOT register — consent did not persist
    }
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
        {/* A–F PLACEHOLDER consent slots — Dom's verbatim text drops in via
            clientConsent/blocks.ts; nothing operative is shown here. */}
        <p className="small">Please review each item below. Draft language shown is pending attorney review.</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          {CONSENT_BLOCKS.map((b) => (
            <details key={b.slot} className="card" style={{ padding: '10px 12px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                {b.slot}. {b.label} <span className="small muted">({b.version})</span>
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 8, color: 'var(--ink)' }}>{b.body}</pre>
            </details>
          ))}
        </div>
        <label style={cbRow}>
          <input type="checkbox" style={cbBox} checked={ackBlocks} onChange={e => setAckBlocks(e.target.checked)} />
          <span>I have read the disclosures and authorizations above (items A–F) and adopt my typed name below as my electronic signature for each.</span>
        </label>
      </div>

      <div className="card" style={{ maxWidth: 680, marginTop: 16 }}>
        <h3>Electronic signature</h3>
        <p className="small">Type your full legal name to sign. This is your legally binding electronic signature, dated {new Date().toLocaleDateString()}.</p>
        <input style={fld} placeholder="Type your full name to sign" value={signature} onChange={e => setSignature(e.target.value)} />
        <label style={{ display: 'block', marginTop: 10 }}>Signing on someone’s behalf? Your capacity, e.g. parent/guardian (optional)
          <input style={fld} placeholder="Optional" value={signerTitle} onChange={e => setSignerTitle(e.target.value)} />
        </label>
        <button className="btn oxblood" style={{ marginTop: 18 }} disabled={!canSubmit} onClick={submit}>
          {busy ? 'Signing…' : 'Sign & complete registration'}
        </button>
        {err && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--bad, #b3261e)' }}>{err}</div>
        )}
        {!canSubmit && !busy && (
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>Acknowledge the disclosures above and type your name to continue.</div>
        )}
      </div>
    </>
  );
}
