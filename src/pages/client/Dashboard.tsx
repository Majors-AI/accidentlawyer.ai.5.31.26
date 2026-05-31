import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

const JOURNEY = [
  ['under_review','Case review','We’re reviewing your submission.'],
  ['accepted','Accepted','We’re representing you. Watch for your fee agreement.'],
  ['treating','Treatment','Keep all appointments and journal your pain and lost wages.'],
  ['demand','Demand','We prepare and send your demand for settlement.'],
  ['settlement','Settlement','You review and approve any offer and your disbursement.'],
  ['closed','Resolved','Funds disbursed and your file is closed.'],
];
const order = JOURNEY.map(j=>j[0]);

export default function ClientDashboard() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [kase, setKase] = useState<any>(null);
  const [follow, setFollow] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadApprovals(caseId: string) {
    const { data } = await supabase.from('approvals').select('*').eq('case_id', caseId).order('created_at',{ascending:false});
    setApprovals(data ?? []);
  }
  useEffect(() => { (async () => {
    const { data: cl } = await supabase.from('clients').select('id').eq('profile_id', profile?.id).maybeSingle();
    if (cl) {
      const { data } = await supabase.from('cases').select('*').eq('client_id', cl.id).order('created_at',{ascending:false}).limit(1);
      setKase(data?.[0] ?? null);
      if (data?.[0]) {
        const { data: fu } = await supabase.from('follow_ups').select('*').eq('case_id', data[0].id).order('due_at');
        setFollow(fu ?? []);
        loadApprovals(data[0].id);
      }
    }
    setLoading(false);
  })(); }, []);

  async function act(a: any, signature?: string) {
    await supabase.from('approvals').update(
      signature
        ? { status:'signed', signature_name:signature, signed_at:new Date().toISOString() }
        : { status:'approved' }
    ).eq('id', a.id);
    if (kase) loadApprovals(kase.id);
  }

  if (loading) return <div className="muted">Loading…</div>;
  if (!kase) return (
    <>
      <div className="page-h"><div><h1>Welcome, {profile?.full_name?.split(' ')[0]}</h1>
        <div className="sub">You don’t have a case on file yet.</div></div></div>
      <div className="card"><p>Start by telling us about your accident.</p>
        <button className="btn oxblood" onClick={()=>nav('/intake')}>Start intake</button></div>
    </>
  );

  const idx = order.indexOf(kase.status === 'litigation' ? 'demand' : kase.status);

  return (
    <>
      <div className="page-h"><div><h1>Your case</h1>
        <div className="sub">{(kase.claim??'').replace(/_/g,' ')} · filed {new Date(kase.created_at).toLocaleDateString()}</div></div>
        <span className="tag good">{kase.status.replace(/_/g,' ')}</span></div>

      {approvals.filter(a=>a.status==='requested').length>0 && (
        <div className="card" style={{borderColor:'var(--oxblood)'}}>
          <h3>Needs your approval</h3>
          {approvals.filter(a=>a.status==='requested').map(a=>(
            <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--paper-2)'}}>
              <span className="small"><b>{a.title}</b>{a.requires_signature && <span className="tag soft tiny" style={{marginLeft:8}}>signature required</span>}</span>
              {a.requires_signature
                ? <button className="btn oxblood sm" onClick={()=>{const n=prompt('Type your full name to sign:'); if(n) act(a,n);}}>Review & sign</button>
                : <button className="btn oxblood sm" onClick={()=>act(a)}>Approve</button>}
            </div>
          ))}
          <p className="muted tiny" style={{marginTop:8}}>Your case can’t move forward until these are handled. You can also discuss them in Messages.</p>
        </div>
      )}

      <div className="grid two">
        <div className="card">
          <h3>Where things stand</h3>
          <ul className="tl">
            {JOURNEY.map(([st,title,desc],i)=>(
              <li key={st} className={i<idx?'done':i===idx?'active':''}>
                <span className="dot" />
                <div><b>{title}</b><div className="muted small">{desc}</div></div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="card">
            <h3>What to expect next</h3>
            <p className="small">{JOURNEY[Math.min(idx+1,JOURNEY.length-1)]?.[2]}</p>
            <p className="muted tiny">Representation covers your personal-injury claim. We’ll also help you track your property-damage claim separately.</p>
          </div>
          <div className="card">
            <h3>Check-ins</h3>
            {follow.length===0 && <span className="muted small">No scheduled check-ins yet.</span>}
            {follow.map(fu=>(
              <div key={fu.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--paper-2)'}}>
                <span className="small">{fu.label}</span>
                <span className={`tag tiny ${fu.done?'good':'soft'}`}>{fu.done?'done':new Date(fu.due_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
