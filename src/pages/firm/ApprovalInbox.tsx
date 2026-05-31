import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function ApprovalInbox() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase.from('communications')
      .select('*, cases(clients(full_name))')
      .in('status', ['draft','queued']).order('created_at', { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function release(id: string) {
    // Attorney sign-off. (Actual send wires to SendGrid/Twilio in a later pass.)
    await supabase.from('communications').update({
      status: 'sent', approved_by: profile?.id, sent_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  }
  async function discard(id: string) {
    await supabase.from('communications').delete().eq('id', id); load();
  }

  return (
    <>
      <div className="page-h">
        <div><h1>Approval inbox</h1>
          <div className="sub">Agents draft; you release. Nothing leaves the firm without your sign-off.</div></div>
      </div>

      {rows.length===0 && <div className="card"><span className="muted">Nothing waiting. Drafts appear here when an agent prepares an email, LOR, or demand.</span></div>}

      {rows.map(r => (
        <div className="card" key={r.id}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <span className="tag ink tiny" style={{marginRight:8}}>{r.channel}</span>
              <b>{r.subject}</b>
              <div className="muted small">For {r.cases?.clients?.full_name} · drafted by {r.drafted_by}</div>
            </div>
            <span className="tag gold tiny">awaiting release</span>
          </div>
          <pre className="small" style={{whiteSpace:'pre-wrap',background:'var(--paper)',padding:14,borderRadius:9,margin:'12px 0'}}>{r.body}</pre>
          <div style={{display:'flex',gap:10}}>
            <button className="btn oxblood sm" onClick={()=>release(r.id)}>Approve & release</button>
            <button className="btn ghost sm" onClick={()=>discard(r.id)}>Discard</button>
          </div>
        </div>
      ))}
    </>
  );
}
