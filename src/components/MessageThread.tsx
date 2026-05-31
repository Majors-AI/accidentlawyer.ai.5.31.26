import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';

export default function MessageThread({ caseId }: { caseId: string }) {
  const { profile } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase.from('messages').select('*').eq('case_id', caseId).order('created_at');
    setMsgs(data ?? []);
  }
  useEffect(() => { load(); }, [caseId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send() {
    const body = text.trim(); if (!body) return;
    setText('');
    await supabase.from('messages').insert({
      case_id: caseId, sender_id: profile?.id, sender_role: profile?.role, body,
    });
    load();
  }

  return (
    <div>
      <div style={{maxHeight:360,overflowY:'auto',padding:'4px 2px',marginBottom:12}}>
        {msgs.length===0 && <p className="muted small">No messages yet. Say hello.</p>}
        {msgs.map(m => {
          const mine = m.sender_id === profile?.id;
          return (
            <div key={m.id} style={{display:'flex',justifyContent:mine?'flex-end':'flex-start',margin:'6px 0'}}>
              <div style={{maxWidth:'74%',padding:'9px 13px',borderRadius:13,fontSize:14,
                background: mine ? 'var(--oxblood)' : 'var(--paper-2)',
                color: mine ? '#fff' : 'var(--ink)',
                borderBottomRightRadius: mine?4:13, borderBottomLeftRadius: mine?13:4}}>
                <div className="tiny" style={{opacity:.7,marginBottom:2}}>{mine?'You':(m.sender_role||'team')}</div>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="row" style={{gap:8}}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message…"
          onKeyDown={e=>e.key==='Enter'&&send()} style={{flex:4}} />
        <button className="btn oxblood" style={{flex:1}} onClick={send}>Send</button>
      </div>
    </div>
  );
}
