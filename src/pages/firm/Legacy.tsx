import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function Legacy() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [bulk, setBulk] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('clients').select('*').eq('legacy', true).order('created_at',{ascending:false});
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function importClients() {
    // One client per line: "Full Name, email, claim type". Lightweight legacy import.
    const lines = bulk.split('\n').map(l=>l.trim()).filter(Boolean);
    let n = 0;
    for (const line of lines) {
      const [name, email] = line.split(',').map(s=>s?.trim());
      if (!name) continue;
      const { data: cl } = await supabase.from('clients').insert({
        full_name: name, email: email || null, firm_id: profile?.firm_id, legacy: true,
      }).select().single();
      if (cl) {
        await supabase.from('cases').insert({ firm_id: profile?.firm_id, client_id: cl.id, status:'treating', claim:'mva', lead_source:'legacy' });
        n++;
      }
    }
    setMsg(`Imported ${n} legacy client(s). Upload their documents from each case file cabinet.`);
    setBulk(''); load();
  }

  return (
    <>
      <div className="page-h"><div><h1>Legacy import</h1>
        <div className="sub">Bring previous clients and matters onto the platform.</div></div></div>

      <div className="card" style={{maxWidth:640}}>
        <label>Paste clients — one per line as <code>Full Name, email</code></label>
        <textarea rows={6} value={bulk} onChange={e=>setBulk(e.target.value)}
          placeholder={"Jane Doe, jane@example.com\nJohn Smith, john@example.com"} />
        {msg && <div className="flag warn" style={{background:'#e3efe6',color:'var(--good)'}}>{msg}</div>}
        <button className="btn oxblood" style={{marginTop:14}} disabled={!bulk.trim()} onClick={importClients}>Import clients</button>
        <p className="muted tiny" style={{marginTop:8}}>Each becomes an open case you can flesh out; upload prior documents into the per-client file cabinet.</p>
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table><thead><tr><th>Legacy client</th><th>Email</th><th>Added</th></tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.id}><td><b>{r.full_name}</b></td><td className="small">{r.email||'—'}</td>
            <td className="small">{new Date(r.created_at).toLocaleDateString()}</td></tr>
          ))}{rows.length===0 && <tr><td colSpan={3} className="muted">No legacy clients imported yet.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}
