import { useState } from 'react';
import { supabase } from '../../lib/supabase';

// ── Stage 1: Firm Registration (platform-admin onboarding) ──────────────────
// Captures firm details, fee structure, and platform agreements, then creates
// the firm for real (reuses the Firms.tsx insert + the "firm super manage" RLS
// path — is_super_admin() may insert). The first-admin email is captured but NO
// invite is sent: the invite-user edge function can't yet seed a NEW firm's
// first admin (it binds invitees to the CALLER's firm and rejects a firm-less
// platform admin). That auth-model change is a separate server step — so we
// surface the invite as pending, mirroring how Firms.tsx already defers it.
//
// No edge-function change, no new schema, no service_role.

const JURISDICTIONS = ['AZ', 'CA', 'NV', 'TX', 'NM', 'CO', 'UT'];

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function FirmRegistration() {
  const [name, setName] = useState('');
  const [marketingSource, setMarketingSource] = useState('');
  const [jurisdiction, setJurisdiction] = useState('AZ');
  const [feePreLit, setFeePreLit] = useState('0.3333');
  const [feeLit, setFeeLit] = useState('0.40');
  const [security, setSecurity] = useState(true);
  const [informed, setInformed] = useState(true);
  const [metrics, setMetrics] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; emailGiven: boolean } | null>(null);
  const [error, setError] = useState('');

  const adminEmailValid = !adminEmail.trim() || emailOk(adminEmail.trim());
  const canSubmit = !!name.trim() && security && adminEmailValid && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    // Same insert pattern + RLS path as Firms.tsx addFirm, PLUS the fee fields
    // (Firms.tsx omits fee_pre_lit / fee_lit). Numerics are parsed from the
    // string inputs; blank/invalid falls back to the schema defaults.
    const pre = parseFloat(feePreLit);
    const lit = parseFloat(feeLit);
    const { data, error: insErr } = await supabase
      .from('firms')
      .insert({
        name: name.trim(),
        marketing_source: marketingSource.trim() || null,
        default_jurisdiction: jurisdiction,
        fee_pre_lit: Number.isFinite(pre) ? pre : 0.3333,
        fee_lit: Number.isFinite(lit) ? lit : 0.40,
        data_security_agreed: security,
        clients_informed_agreed: informed,
        allow_platform_metrics: metrics,
      })
      .select()
      .single();
    setBusy(false);
    if (insErr || !data) {
      setError(insErr?.message ?? 'Could not create the firm.');
      return;
    }
    setDone({ name: data.name, emailGiven: !!adminEmail.trim() });
  }

  function reset() {
    setName(''); setMarketingSource(''); setJurisdiction('AZ');
    setFeePreLit('0.3333'); setFeeLit('0.40');
    setSecurity(true); setInformed(true); setMetrics(true);
    setAdminEmail(''); setDone(null); setError('');
  }

  if (done) {
    return (
      <>
        <div className="page-h"><div><h1>Firm Registration</h1></div></div>
        <div className="card" style={{ maxWidth: 620 }}>
          <h3 style={{ marginTop: 0 }}>
            <span className="tag good tiny" style={{ marginRight: 8 }}>created</span>
            {done.name}
          </h3>
          <p className="small" style={{ color: 'var(--ink)' }}>
            Firm created. First-admin invite is <b>pending</b> — the invite seam doesn’t yet
            support seeding a new firm’s first admin (server step). Once that server step is
            enabled, {done.emailGiven
              ? `the invite to ${adminEmail.trim()} can be sent.`
              : 'add the first admin and send the invite.'}
          </p>
          <button className="btn oxblood" style={{ marginTop: 12 }} onClick={reset}>
            Register another firm
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Firm Registration</h1>
          <div className="sub">Onboard a new firm to the platform</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3 style={{ marginTop: 0 }}>Firm details</h3>
        <label>Firm name *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Smith & Associates" />
        <label>Marketing source</label>
        <input value={marketingSource} onChange={e => setMarketingSource(e.target.value)}
          placeholder="Google Ads, referral, LSA…" />
        <label>Default jurisdiction</label>
        <select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}>
          {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3 style={{ marginTop: 0 }}>Fee structure</h3>
        <div className="grid two" style={{ gap: 14 }}>
          <div>
            <label>Contingency fee — pre-litigation</label>
            <input type="number" step="0.0001" min="0" max="1"
              value={feePreLit} onChange={e => setFeePreLit(e.target.value)} />
            <span className="muted tiny">Default 0.3333 (33.33%)</span>
          </div>
          <div>
            <label>Contingency fee — litigation</label>
            <input type="number" step="0.01" min="0" max="1"
              value={feeLit} onChange={e => setFeeLit(e.target.value)} />
            <span className="muted tiny">Default 0.40 (40%)</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3 style={{ marginTop: 0 }}>Platform agreements</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {([
            ['security', security, setSecurity, 'The firm agrees its client data will be kept secured and isolated.'],
            ['informed', informed, setInformed, 'The firm agrees its clients will be informed they are using this platform.'],
            ['metrics', metrics, setMetrics, 'The firm agrees to share caseload, settlement, and marketing metrics with the platform.'],
          ] as const).map(([k, val, set, label]) => (
            <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 400, color: 'var(--ink)' }}>
              <input type="checkbox" style={{ width: 18, marginTop: 2 }}
                checked={val} onChange={e => set(e.target.checked)} />
              <span className="small">{label}</span>
            </label>
          ))}
        </div>
        <p className="muted tiny" style={{ marginTop: 8 }}>
          Data-security agreement is required to create the firm.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3 style={{ marginTop: 0 }}>First firm admin</h3>
        <label>Admin email</label>
        <input value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
          placeholder="admin@firm.com" />
        {!adminEmailValid && <span className="tag bad tiny" style={{ marginTop: 6 }}>Enter a valid email</span>}
        <p className="muted tiny" style={{ marginTop: 8 }}>
          Captured for the first-admin invite. The invite is a pending server step — seeding a
          new firm’s first admin isn’t supported by the invite seam yet, so no invite is sent now.
        </p>
      </div>

      {error && <div className="card" style={{ maxWidth: 620, borderColor: 'var(--bad, #b00)' }}>
        <span className="tag bad tiny" style={{ marginRight: 8 }}>error</span>
        <span className="small">{error}</span>
      </div>}

      <button className="btn oxblood" style={{ maxWidth: 620 }}
        disabled={!canSubmit} onClick={submit}>
        {busy ? 'Creating…' : 'Create firm'}
      </button>
    </>
  );
}
