import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import MessageThread from '../../components/MessageThread';

export default function ClientMessages() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data: cl } = await supabase.from('clients').select('*').eq('profile_id', profile?.id).maybeSingle();
    setClient(cl);
    if (cl) {
      const { data } = await supabase.from('cases').select('id').eq('client_id', cl.id).order('created_at',{ascending:false}).limit(1);
      setCaseId(data?.[0]?.id ?? null);
    }
    setLoading(false);
  })(); }, []);

  if (loading) return <div className="muted">Loading…</div>;

  return (
    <>
      <div className="page-h"><div><h1>Messages</h1>
        <div className="sub">Secure messaging with your legal team.</div></div></div>
      {!client?.registered ? (
        <div className="card"><span className="tag gold">Locked</span>
          <p style={{marginTop:12}}>Complete your engagement & setup to turn on messaging.</p>
          <button className="btn oxblood" onClick={()=>nav('/setup')}>Go to setup</button>
        </div>
      ) : caseId ? (
        <div className="card"><MessageThread caseId={caseId} /></div>
      ) : (
        <div className="card"><span className="muted">No case on file yet.</span></div>
      )}
    </>
  );
}
