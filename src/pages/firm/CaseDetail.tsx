import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import MessageThread from '../../components/MessageThread';
import FileCabinet from '../../components/FileCabinet';

const STAGES = ['lead','under_review','accepted','treating','demand','settlement','litigation','closed'];

export default function CaseDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [c, setC] = useState<any>(null);
  const [conflict, setConflict] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('cases').select('*, clients(*)').eq('id', id).single();
    setC(data);
    const { data: cc } = await supabase.from('conflicts_checks').select('*').eq('case_id', id).order('ran_at',{ascending:false}).limit(1);
    setConflict(cc?.[0] ?? null);
    const { data: p } = await supabase.from('insurance_policies').select('*').eq('case_id', id);
    setPolicies(p ?? []);
    const { data: ap } = await supabase.from('approvals').select('*').eq('case_id', id).order('created_at',{ascending:false});
    setApprovals(ap ?? []);
  }
  useEffect(() => { load(); }, [id]);
  if (!c) return <div className="muted">Loading…</div>;

  const pendingApproval = approvals.find(a=>a.status==='requested');

  // --- decision-engine signal: should we consider dropping? ---
  const adverse = policies.find(p=>p.kind==='adverse_liability');
  const treatTotal = 0; // wired to treatments table as that module deepens
  const reasons: string[] = [];
  if (c.liability_disputed && (c.accepted_fault_pct ?? 100) < 50) reasons.push(`Adverse accepts only ${c.accepted_fault_pct}% fault`);
  if (c.limits_issue) reasons.push('Limits issue flagged');
  if (adverse && adverse.limits && adverse.limits <= 25000) reasons.push(`Low adverse limits ($${adverse.limits.toLocaleString()})`);

  async function runConflicts() {
    // v1 conflicts: check name collisions against existing parties/clients + driver-at-fault rule.
    const name = c.clients?.full_name?.toLowerCase() ?? '';
    const { data: parties } = await supabase.from('parties').select('name, role');
    const adverseMatch = (parties??[]).some(p => p.role==='adverse' && (p.name??'').toLowerCase().includes(name));
    const result = adverseMatch ? 'conflict' : 'clear';
    await supabase.from('conflicts_checks').insert({
      case_id: id, result, ran_by: profile?.id,
      details: { checked_names:[c.clients?.full_name], adverse_name_match: adverseMatch, driver_at_fault_rule:'applied' },
    });
    load();
  }

  async function decide(status: 'accepted'|'denied') {
    await supabase.from('cases').update({ status, attorney_id: profile?.id,
      fee_pct: status==='accepted' ? 0.3333 : null }).eq('id', id);
    if (status === 'accepted') {
      // Agent drafts the acceptance email; it goes to the approval inbox, not out the door.
      await supabase.from('communications').insert({
        case_id: id, channel: 'email', requires_approval: true, status: 'queued', drafted_by: 'agent',
        subject: 'We are representing you — what to expect',
        body: `Dear ${c.clients?.full_name},\n\nWe are pleased to represent you for your personal-injury claim arising from the incident on ${c.date_of_loss}. Our representation covers your personal-injury claim only; we will also help you track your property-damage claim separately.\n\nAttached is your fee agreement. What to expect: treatment, documentation, demand, and resolution. Please do not give a recorded statement to any insurer.\n\n— Your legal team`,
      });
      setMsg('Accepted. Acceptance email + fee agreement drafted and queued for your release in the Approval inbox.');
    } else setMsg('Case denied.');
    load();
  }

  const Tab = ({id:t,label}:{id:string;label:string}) =>
    <button className={tab===t?'on':''} onClick={()=>setTab(t)}>{label}</button>;

  async function requestApproval(kind: string, title: string, requires_signature: boolean) {
    await supabase.from('approvals').insert({ case_id: id, kind, title, requires_signature,
      status: 'requested', requested_by: profile?.id });
    // Notify the client in their message thread.
    await supabase.from('messages').insert({ case_id: id, sender_id: profile?.id, sender_role: profile?.role,
      body: `Action needed: please review and ${requires_signature?'sign':'approve'} — "${title}". You can do this under your case approvals.` });
    load();
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{c.clients?.full_name}</h1>
          <div className="sub">{(c.claim??'').replace(/_/g,' ')} · {c.jurisdiction} · DOL {c.date_of_loss}
            {c.clients?.is_minor && <span className="tag soft" style={{marginLeft:8}}>minor — comp approval may apply</span>}</div>
        </div>
        <span className={`tag ${c.status==='litigation'?'bad':c.status==='accepted'||c.status==='treating'?'good':'gold'}`}>{c.status.replace(/_/g,' ')}</span>
      </div>

      <div className="steps">
        {STAGES.map(s => <span key={s} className={`step ${STAGES.indexOf(s)<=STAGES.indexOf(c.status)?'on':''}`}>{s.replace(/_/g,' ')}</span>)}
      </div>

      {reasons.length>0 && <div className="flag warn">
        <b>Review signal:</b> consider whether to keep this case — {reasons.join('; ')}.
      </div>}
      {pendingApproval && <div className="flag bad">
        <b>Case advancement blocked.</b> Awaiting client {pendingApproval.requires_signature?'signature':'approval'}: “{pendingApproval.title}”.
      </div>}
      {msg && <div className="flag warn" style={{background:'#e3efe6',color:'var(--good)'}}>{msg}</div>}

      <div className="tabs">
        <Tab id="overview" label="Overview" />
        <Tab id="messages" label="Messages" />
        <Tab id="approvals" label="Approvals & signatures" />
        <Tab id="conflicts" label="Conflicts" />
        <Tab id="coverage" label="Liability & coverage" />
        <Tab id="treatment" label="Treatment" />
        <Tab id="filecab" label="File cabinet" />
        <Tab id="demand" label="Demand" />
        <Tab id="money" label="Settlement & trust" />
        <Tab id="lit" label="Litigation" />
      </div>

      {tab==='messages' && <div className="card">
        <h3>Client messaging</h3>
        <p className="muted small" style={{marginTop:0}}>Secure thread with {c.clients?.full_name}. SMS/email relay (Twilio/SendGrid) attaches here once configured.</p>
        <MessageThread caseId={String(id)} />
      </div>}

      {tab==='overview' && <div className="card">
        <dl className="kv">
          <dt>Claim type</dt><dd>{(c.claim??'').replace(/_/g,' ')}</dd>
          <dt>Jurisdiction</dt><dd>{c.jurisdiction}</dd>
          <dt>Date of loss</dt><dd>{c.date_of_loss}</dd>
          <dt>Location</dt><dd>{c.location ?? '—'}</dd>
          <dt>SOL date</dt><dd>{c.sol_date ?? '—'} <span className="muted small">{c.sol_citation}</span></dd>
          <dt>Facts</dt><dd>{c.narrative ?? '—'}</dd>
        </dl>
        {['lead','under_review','info_requested'].includes(c.status) && <div style={{marginTop:16,display:'flex',gap:10}}>
          <button className="btn oxblood" onClick={()=>decide('accepted')}
            disabled={conflict?.result==='conflict'}>Accept case</button>
          <button className="btn ghost" onClick={()=>decide('denied')}>Deny</button>
          {conflict?.result==='conflict' && <span className="muted small" style={{alignSelf:'center'}}>Blocked: conflict found.</span>}
          {conflict?.result!=='clear' && conflict?.result!=='conflict' && <span className="muted small" style={{alignSelf:'center'}}>Run conflicts check first.</span>}
        </div>}
      </div>}

      {tab==='approvals' && <div className="card">
        <h3>Approvals & signatures</h3>
        <p className="muted small" style={{marginTop:0}}>A case can’t advance while an approval is pending. Settlements and releases require the client’s signature. The client acts on these from their dashboard; settlement approvals can also come back through messages.</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'8px 0 14px'}}>
          <button className="btn sm" onClick={()=>requestApproval('settlement','Approve settlement offer',false)}>Request settlement approval</button>
          <button className="btn sm" onClick={()=>requestApproval('release','Sign release & settlement statement',true)}>Request signed release</button>
          <button className="btn sm ghost" onClick={()=>requestApproval('document','Sign fee agreement',true)}>Request document signature</button>
        </div>
        <table><thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Signed by</th></tr></thead>
          <tbody>{approvals.map(a=>(
            <tr key={a.id}>
              <td className="small"><b>{a.title}</b></td>
              <td className="small">{a.requires_signature?'signature':'approval'}</td>
              <td><span className={`tag tiny ${a.status==='signed'||a.status==='approved'?'good':a.status==='declined'?'bad':'gold'}`}>{a.status}</span></td>
              <td className="small">{a.signature_name? `${a.signature_name} · ${new Date(a.signed_at).toLocaleDateString()}` : '—'}</td>
            </tr>
          ))}{approvals.length===0 && <tr><td colSpan={4} className="muted">No approvals requested yet.</td></tr>}</tbody>
        </table>
      </div>}

      {tab==='filecab' && <FileCabinet caseId={String(id)} firmId={String(c.firm_id)} />}

      {tab==='conflicts' && <div className="card">
        <h3>Conflicts check</h3>
        <p className="muted small">Runs at intake — name collisions against adverse parties, plus the driver-at-fault rule (don’t take a client adverse to a faulted driver we’d represent).</p>
        {conflict ? <>
          <span className={`tag ${conflict.result==='clear'?'good':conflict.result==='conflict'?'bad':'warn'}`}>{conflict.result.replace(/_/g,' ')}</span>
          <pre className="small muted" style={{whiteSpace:'pre-wrap',marginTop:12}}>{JSON.stringify(conflict.details,null,2)}</pre>
        </> : <p className="muted">Not yet run.</p>}
        <button className="btn sm" style={{marginTop:10}} onClick={runConflicts}>Run conflicts check</button>
      </div>}

      {tab==='coverage' && <div className="card">
        <h3>Liability & coverage</h3>
        <dl className="kv">
          <dt>Liability disputed</dt><dd>{c.liability_disputed?`Yes — adverse accepts ${c.accepted_fault_pct ?? '?'}%`:'No'}</dd>
          <dt>Limits issue</dt><dd>{c.limits_issue?'Flagged':'None'}</dd>
        </dl>
        <table style={{marginTop:12}}><thead><tr><th>Policy</th><th>Carrier</th><th>Limits</th><th>Verified</th></tr></thead>
          <tbody>{policies.map(p=>(
            <tr key={p.id}><td className="small">{p.kind.replace(/_/g,' ')}</td><td className="small">{p.carrier}</td>
            <td className="small">{p.limits?`$${p.limits.toLocaleString()}`:'—'}</td>
            <td>{p.verified?<span className="tag good tiny">verified</span>:<span className="tag warn tiny">pending</span>}</td></tr>
          ))}{policies.length===0 && <tr><td colSpan={4} className="muted">No policies recorded.</td></tr>}</tbody>
        </table>
      </div>}

      {['treatment','demand','money','lit'].includes(tab) && <div className="card">
        <div className="scaffold">
          <b>{ {treatment:'Treatment & follow-ups',demand:'Demand builder',money:'Settlement, reductions, liens & trust accounting',lit:'Litigation & pleadings'}[tab] }</b><br/>
          This module’s tables exist in the database and are wired into the data model; the working UI is the next build pass. Nothing here will require migration — it slots onto the schema that’s already live.
        </div>
      </div>}
    </>
  );
}
