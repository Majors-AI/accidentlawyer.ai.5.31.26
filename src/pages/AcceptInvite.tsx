import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AcceptInvite() {
  const navigate = useNavigate();
  // undefined = detecting session, null = no valid session
  const [session, setSession] = useState<unknown>(undefined);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function setPassword() {
    if (!pw) { setErr('Please enter a password'); return; }
    if (pw !== pw2) { setErr('Passwords do not match'); return; }
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setErr(error.message); setBusy(false); return; }
    setDone(true);
    setTimeout(() => navigate('/'), 1500);
  }

  if (session === undefined) {
    return <div className="auth"><div className="muted">Loading...</div></div>;
  }

  if (!session) {
    return (
      <div className="auth">
        <div className="box">
          <div className="brand">
            Accident Lawyer<span style={{ color: 'var(--oxblood)' }}>.ai</span>
            <small>Case Intelligence</small>
          </div>
          <h1>Invite link expired</h1>
          <p className="muted small" style={{ marginTop: 0 }}>
            This invite link is no longer valid or has already been used. Contact your firm
            administrator for a new invitation.
          </p>
          <a href="/" className="btn ghost" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="box">
        <div className="brand">
          Accident Lawyer<span style={{ color: 'var(--oxblood)' }}>.ai</span>
          <small>Case Intelligence</small>
        </div>
        <h1>Set your password</h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          Welcome! Choose a password to complete your account setup.
        </p>
        {done ? (
          <div className="flag" style={{ background: '#e3efe6', color: 'var(--good)' }}>
            Password set. Taking you to the app...
          </div>
        ) : (
          <>
            <label>New password</label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="At least 8 characters"
            />
            <label>Confirm password</label>
            <input
              type="password"
              value={pw2}
              onChange={e => setPw2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setPassword()}
            />
            {err && <div className="err">{err}</div>}
            <button
              className="btn oxblood"
              style={{ width: '100%', marginTop: 18 }}
              onClick={setPassword}
              disabled={busy || !pw}
            >
              {busy ? 'Setting password...' : 'Set password & sign in'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
