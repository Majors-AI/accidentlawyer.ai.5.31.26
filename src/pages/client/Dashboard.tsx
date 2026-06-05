import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

const JOURNEY = [
  ['under_review','Case review',"We're reviewing your submission."],
  ['accepted','Accepted',"We're representing you. Watch for your fee agreement."],
  ['treating','Treatment','Keep all appointments and journal your pain and lost wages.'],
  ['demand','Demand','We prepare and send your demand for settlement.'],
  ['settlement','Settlement','You review and approve any offer and your disbursement.'],
  ['closed','Resolved','Funds disbursed and your file is closed.'],
];
const order = JOURNEY.map(j=>j[0]);

const fmt = (n: any) =>
  n != null ? `$${Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}` : '—';

export default function ClientDashboard() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [kase, setKase] = useState<any>(null);
  const [follow, setFollow] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [settlement, setSettlement] = useState<any>(null);
  const [disbursement, setDisbursement] = useState<any>(null);
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
        const caseId = data[0].id;
        const { data: fu } = await supabase.from('follow_ups').select('*').eq('case_id', caseId).order('due_at');
        setFollow(fu ?? []);
        loadApprovals(caseId);
        const { data: trt } = await supabase.from('treatments').select('*').eq('case_id', caseId).order('scheduled_at', {ascending: true});
        setTreatments(trt ?? []);
        const { data: s } = await supabase.from('settlements').select('*').eq('case_id', caseId).order('created_at',{ascending:false}).limit(1);
        setSettlement(s?.[0] ?? null);
        const { data: d } = await supabase.from('disbursements').select('*').eq('case_id', caseId).order('created_at',{ascending:false}).limit(1);
        setDisbursement(d?.[0] ?? null);
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

  async function viewDoc(documentId: string) {
    const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', documentId).single();
    if (!doc?.storage_path) return;
    const { data } = await supabase.storage.from('case-files').createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  if (loading) return <div className="muted">Loading…</div>;
  if (!kase) return (
    <>
      <div className="page-h"><div><h1>Welcome, {profile?.full_name?.split(' ')[0]}</h1>
        <div className="sub">You don't have a case on file yet.</div></div></div>
      <div className="card"><p>Start by telling us about your accident.</p>
        <button className="btn oxblood" onClick={()=>nav('/intake')}>Start intake</button></div>
    </>
  );

  const idx = order.indexOf(kase.status === 'litigation' ? 'demand' : kase.status);

  // SOL countdown (days from today to sol_date)
  const solDays = kase.sol_date
    ? Math.ceil((new Date(kase.sol_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    : null;

  // Next upcoming treatment appointment
  const now = new Date();
  const nextAppt = treatments
    .filter(t => t.scheduled_at && new Date(t.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];

  // Running medical bills total
  const billsTotal = treatments.reduce((s, t) => s + (Number(t.total_billed) || 0), 0);

  const showSettlementCard = kase.status === 'settlement' || kase.status === 'closed';

  const settlementTagClass = (s: string) => {
    if (s === 'funded') return 'good';
    if (s === 'approved') return 'gold';
    if (s === 'rejected') return 'bad';
    return 'soft';
  };

  return (
    <>
      <div className="page-h"><div><h1>Your case</h1>
        <div className="sub">{(kase.claim??'').replace(/_/g,' ')} · filed {new Date(kase.created_at).toLocaleDateString()}</div></div>
        <span className="tag good">{kase.status.replace(/_/g,' ')}</span></div>

      {/* ---- At-a-glance metrics ---- */}
      <div className="grid three" style={{marginBottom:16}}>
        <div className="card" style={{marginBottom:0}}>
          <div className="muted tiny" style={{textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>SOL deadline</div>
          {solDays != null ? (
            <>
              <div style={{fontSize:22,fontWeight:600,fontFamily:'var(--serif)',color: solDays < 180 ? 'var(--bad)' : 'var(--good)'}}>
                {solDays.toLocaleString()} days
              </div>
              <div className="muted tiny">{new Date(kase.sol_date + 'T12:00:00').toLocaleDateString()}</div>
            </>
          ) : <span className="muted small">—</span>}
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="muted tiny" style={{textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Next appointment</div>
          {nextAppt ? (
            <>
              <div style={{fontSize:15,fontWeight:600}}>
                {new Date(nextAppt.scheduled_at).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
              </div>
              <div className="muted tiny" style={{marginTop:2}}>{nextAppt.status}</div>
            </>
          ) : <span className="muted small">None scheduled</span>}
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="muted tiny" style={{textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Bills to date</div>
          <div style={{fontSize:22,fontWeight:600,fontFamily:'var(--serif)'}}>
            ${billsTotal.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}
          </div>
          <div className="muted tiny">{treatments.length} provider record{treatments.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* ---- Quick links ---- */}
      <div className="grid three" style={{marginBottom:16}}>
        {([
          ['/journal',    'Injury journal',  'Log daily pain and symptoms.'],
          ['/wage-loss',  'Wage loss',        'Track income lost to your injury.'],
          ['/treatment',  'Treatment',        'Your providers and appointments.'],
        ] as [string,string,string][]).map(([to, title, desc]) => (
          <div key={to} className="card clickable" style={{marginBottom:0}} onClick={()=>nav(to)}>
            <div style={{fontWeight:600,fontFamily:'var(--serif)',fontSize:16,marginBottom:4}}>{title}</div>
            <div className="small muted">{desc}</div>
          </div>
        ))}
      </div>

      {/* ---- Approvals (with optional document-viewer button) ---- */}
      {approvals.filter(a=>a.status==='requested').length>0 && (
        <div className="card" style={{borderColor:'var(--oxblood)'}}>
          <h3>Needs your approval</h3>
          {approvals.filter(a=>a.status==='requested').map(a=>(
            <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--paper-2)'}}>
              <span className="small"><b>{a.title}</b>{a.requires_signature && <span className="tag soft tiny" style={{marginLeft:8}}>signature required</span>}</span>
              <div style={{display:'flex',gap:8,flexShrink:0}}>
                {a.document_id && (
                  <button className="btn ghost sm" onClick={()=>viewDoc(a.document_id)}>View document</button>
                )}
                {a.requires_signature
                  ? <button className="btn oxblood sm" onClick={()=>{const n=prompt('Type your full name to sign:'); if(n) act(a,n);}}>Review & sign</button>
                  : <button className="btn oxblood sm" onClick={()=>act(a)}>Approve</button>}
              </div>
            </div>
          ))}
          <p className="muted tiny" style={{marginTop:8}}>Your case can't move forward until these are handled. You can also discuss them in Messages.</p>
        </div>
      )}

      {/* ---- Settlement / disbursement summary (settlement or closed status only) ---- */}
      {showSettlementCard && (settlement || disbursement) && (
        <div className="card" style={{borderColor:'var(--good)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:14}}>
            <h3 style={{margin:0}}>Settlement</h3>
            {settlement && (
              <span className={`tag ${settlementTagClass(settlement.status)}`}>
                {settlement.status}
              </span>
            )}
          </div>

          {disbursement ? (
            <>
              <dl className="kv">
                <dt>Settlement amount</dt>
                <dd>{fmt(disbursement.settlement_amount)}</dd>
                <dt>Attorney fees</dt>
                <dd style={{color:'var(--ink-soft)'}}>− {fmt(disbursement.fees)}</dd>
                <dt>Medical deductions</dt>
                <dd style={{color:'var(--ink-soft)'}}>− {fmt(disbursement.medical)}</dd>
                {disbursement.liens_total != null && Number(disbursement.liens_total) > 0 && (
                  <>
                    <dt>Lien deductions</dt>
                    <dd style={{color:'var(--ink-soft)'}}>− {fmt(disbursement.liens_total)}</dd>
                  </>
                )}
              </dl>
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'baseline',
                borderTop:'1px solid var(--line)', paddingTop:12, marginTop:10,
              }}>
                <span style={{fontFamily:'var(--serif)',fontWeight:600,fontSize:15}}>Net to you</span>
                <span style={{fontFamily:'var(--serif)',fontWeight:700,fontSize:24,color:'var(--good)'}}>
                  {fmt(disbursement.net_to_client)}
                </span>
              </div>
              <div style={{marginTop:10}}>
                <span className="tag soft tiny">{disbursement.phase} fee schedule</span>
                {disbursement.client_approved && (
                  <span className="tag good tiny" style={{marginLeft:8}}>you approved</span>
                )}
              </div>
            </>
          ) : settlement ? (
            <>
              <dl className="kv">
                <dt>Offer amount</dt>
                <dd style={{fontWeight:600}}>{fmt(settlement.offer_amount)}</dd>
              </dl>
              <p className="muted small" style={{marginTop:12,marginBottom:0}}>
                Your attorney is finalizing the breakdown. Check back soon or ask in Messages.
              </p>
            </>
          ) : null}
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
            <p className="muted tiny">Representation covers your personal-injury claim. We'll also help you track your property-damage claim separately.</p>
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
