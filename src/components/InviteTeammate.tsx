import { useState } from 'react';
import { inviteUser } from '../lib/inviteUser';

export default function InviteTeammate() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'attorney' | 'staff'>('staff');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    const res = await inviteUser({ email, full_name: fullName, role });
    if (res.ok) {
      setResult({ ok: true, msg: 'Invite sent. They will receive an email to set their password.' });
      setEmail('');
      setFullName('');
      setRole('staff');
    } else {
      setResult({ ok: false, msg: res.error ?? 'Invite failed' });
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <h3>Invite teammate</h3>
      <div className="row">
        <div>
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@firm.com" />
        </div>
        <div>
          <label>Full name</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
        </div>
        <div>
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value as 'attorney' | 'staff')}>
            <option value="attorney">Attorney</option>
            <option value="staff">Staff</option>
          </select>
        </div>
      </div>
      <button
        className="btn sm oxblood"
        style={{ marginTop: 10 }}
        onClick={send}
        disabled={busy || !email || !fullName}
      >
        {busy ? 'Sending...' : 'Send invite'}
      </button>
      {result && (
        <p
          className={result.ok ? 'small' : 'small err'}
          style={{ marginTop: 8, color: result.ok ? 'var(--good)' : undefined }}
        >
          {result.msg}
        </p>
      )}
    </div>
  );
}
