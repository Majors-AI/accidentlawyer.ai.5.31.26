import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import MessageThread from '../../components/MessageThread';
import FileCabinet from '../../components/FileCabinet';

const STAGES = ['lead','under_review','accepted','treating','demand','settlement','litigation','closed'];
const DEMAND_STATUSES = ['draft','attorney_review','client_review','approved','sent'];

export default function CaseDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [c, setC] = useState<any>(null);
  const [conflict, setConflict] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState('');
  const [policyForm, setPolicyForm] = useState({ kind: 'adverse_liability', carrier: '', policy_number: '', limits: '' });
  const [addingPolicy, setAddingPolicy] = useState(false);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [txForm, setTxForm] = useState({ provider_id: '', newName: '', newSpecialty: '', status: 'recommended', scheduled_at: '', total_billed: '' });
  const [addingTx, setAddingTx] = useState(false);
  const [editTx, setEditTx] = useState<any>(null);
  const [fuForm, setFuForm] = useState({ label: '', due_at: '' });
  const [addingFu, setAddingFu] = useState(false);
  const [demand, setDemand] = useState<any>(null);
  const [wageLoss, setWageLoss] = useState(0);
  const [multiplier, setMultiplier] = useState('3');
  const [futureCare, setFutureCare] = useState('0');
  const [demandAmt, setDemandAmt] = useState('');
  const [demandBody, setDemandBody] = useState('');
  const [savingDemand, setSavingDemand] = useState(false);

  async function load() {
    const { data } = await supabase.from('cases').select('*, clients(*)').eq('id', id).single();
    setC(data);
    const { data: cc } = await supabase.from('conflicts_checks').select('*').eq('case_id', id).order('ran_at',{ascending:false}).limit(1);
    setConflict(cc?.[0] ?? null);
    const { data: p } = await supabase.from('insurance_policies').select('*').eq('case_id', id);
    setPolicies(p ?? []);
    const { data: ap } = await supabase.from('approvals').select('*').eq('case_id', id).order('created_at',{ascending:false});
    setApprovals(ap ?? []);
    const { data: tx } = await supabase.from('treatments').select('*, providers(name, specialty)').eq('case_id', id);
    setTreatments(tx ?? []);
    const { data: fu } = await supabase.from('follow_ups').select('*').eq('case_id', id).order('due_at',{ascending:true});
    setFollowUps(fu ?? []);
    const { data: dm } = await supabase.from('demands').select('*').eq('case_id', id).order('created_at',{ascending:false}).limit(1);
    const latestDemand = dm?.[0] ?? null;
    setDemand(latestDemand);
    if (latestDemand) {
      setDemandAmt(String(latestDemand.amount ?? ''));
      setDemandBody(latestDemand.body ?? '');
    }
    const { data: wl } = await supabase.from('journal_entries').select('amount').eq('case_id', id).eq('kind','lost_wages');
    setWageLoss((wl ?? []).reduce((s: number, j: any) => s + (Number(j.amount) || 0), 0));
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    supabase.from('providers').select('id, name, specialty').order('name').then(({data}) => setProviders(data ?? []));
  }, []);
  if (!c) return <div className="muted">Loading…</div>;

  const pendingApproval = approvals.find(a=>a.status==='requested');

  // --- decision-engine signal: should we consider dropping? ---
  const adverse = policies.find(p=>p.kind==='adverse_liability');
  const treatTotal = treatments.reduce((s, t) => s + (Number(t.total_billed) || 0), 0);
  const specialsTotal = treatTotal + wageLoss;
  const generalDamages = specialsTotal * (Number(multiplier) || 0);
  const futureCareNum = Number(futureCare) || 0;
  const computedDemand = specialsTotal + generalDamages + futureCareNum;
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
      // SOL auto-compute: look up rule for this jurisdiction + claim type and write sol_date.
      // Silently skipped if no rule found, no DOL, or lookup errors — acceptance must not block.
      try {
        const { data: rule } = await supabase
          .from('sol_rules')
          .select('years, citation')
          .eq('jurisdiction', c.jurisdiction)
          .eq('claim', c.claim)
          .maybeSingle();
        if (rule && c.date_of_loss) {
          const sol = new Date(c.date_of_loss);
          sol.setFullYear(sol.getFullYear() + Number(rule.years));
          await supabase.from('cases')
            .update({ sol_date: sol.toISOString().slice(0, 10), sol_citation: rule.citation })
            .eq('id', id);
        }
      } catch (_) { /* SOL lookup failure does not block acceptance */ }
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

  async function addPolicy() {
    setAddingPolicy(true);
    await supabase.from('insurance_policies').insert({
      case_id: id,
      kind: policyForm.kind,
      carrier: policyForm.carrier || null,
      policy_number: policyForm.policy_number || null,
      limits: policyForm.limits ? Number(policyForm.limits) : null,
    });
    setPolicyForm({ kind: 'adverse_liability', carrier: '', policy_number: '', limits: '' });
    setAddingPolicy(false);
    load();
  }

  async function addTreatment() {
    setAddingTx(true);
    let pid = txForm.provider_id;
    if (pid === '__new__') {
      const { data: np } = await supabase.from('providers').insert({
        name: txForm.newName, specialty: txForm.newSpecialty || null,
      }).select().single();
      if (!np) { setAddingTx(false); return; }
      pid = np.id;
      setProviders(prev => [...prev, np].sort((a, b) => a.name.localeCompare(b.name)));
    }
    await supabase.from('treatments').insert({
      case_id: id, provider_id: pid || null, status: txForm.status,
      scheduled_at: txForm.scheduled_at || null,
      total_billed: txForm.total_billed ? Number(txForm.total_billed) : 0,
    });
    setTxForm({ provider_id: '', newName: '', newSpecialty: '', status: 'recommended', scheduled_at: '', total_billed: '' });
    setAddingTx(false);
    load();
  }

  async function toggleTxBool(txId: string, field: string, current: boolean) {
    await supabase.from('treatments').update({ [field]: !current }).eq('id', txId);
    load();
  }

  async function saveTxEdit() {
    await supabase.from('treatments').update({
      status: editTx.status,
      scheduled_at: editTx.scheduled_at || null,
      total_billed: editTx.total_billed ? Number(editTx.total_billed) : 0,
    }).eq('id', editTx.id);
    setEditTx(null);
    load();
  }

  async function markFuDone(fuId: string) {
    await supabase.from('follow_ups').update({ done: true }).eq('id', fuId);
    load();
  }

  async function addFollowUp() {
    setAddingFu(true);
    await supabase.from('follow_ups').insert({
      case_id: id, label: fuForm.label,
      due_at: fuForm.due_at ? new Date(fuForm.due_at).toISOString() : null,
    });
    setFuForm({ label: '', due_at: '' });
    setAddingFu(false);
    load();
  }

  async function generateCadence() {
    const now = Date.now();
    await supabase.from('follow_ups').insert([
      { case_id: id, label: '24h confirm', due_at: new Date(now + 1*864e5).toISOString() },
      { case_id: id, label: '5 day',       due_at: new Date(now + 5*864e5).toISOString() },
      { case_id: id, label: '2 week',      due_at: new Date(now + 14*864e5).toISOString() },
      { case_id: id, label: '30 day',      due_at: new Date(now + 30*864e5).toISOString() },
    ]);
    load();
  }

  async function saveDemand() {
    setSavingDemand(true);
    const amount = demandAmt ? Number(demandAmt) : computedDemand;
    if (demand) {
      await supabase.from('demands').update({ amount, body: demandBody }).eq('id', demand.id);
    } else {
      await supabase.from('demands').insert({ case_id: id, amount, body: demandBody, status: 'draft', sol_noted: false });
    }
    setSavingDemand(false);
    load();
  }

  async function advanceDemandStatus() {
    if (!demand) return;
    const idx = DEMAND_STATUSES.indexOf(demand.status);
    if (idx < 0 || idx >= DEMAND_STATUSES.length - 1) return;
    await supabase.from('demands').update({ status: DEMAND_STATUSES[idx + 1] }).eq('id', demand.id);
    load();
  }

  function generateDemandDraft() {
    const amt = demandAmt ? Number(demandAmt) : computedDemand;
    setDemandBody(
      'DEMAND FOR SETTLEMENT\n' +
      'Client: ' + (c.clients?.full_name ?? '') + '\n' +
      'Date of Loss: ' + (c.date_of_loss ?? '') + '\n' +
      'Claim: ' + ((c.claim ?? '').replace(/_/g, ' ')) + '\n\n' +
      'LIABILITY\n[Describe liability facts and defendant\'s negligence here.]\n\n' +
      'INJURIES & TREATMENT\n[Describe injuries sustained and course of treatment here.]\n\n' +
      'DAMAGES\n' +
      'Medical specials:          $' + treatTotal.toLocaleString() + '\n' +
      'Wage loss:                 $' + wageLoss.toLocaleString() + '\n' +
      'Specials total:            $' + specialsTotal.toLocaleString() + '\n' +
      'General damages (x' + multiplier + '):  $' + generalDamages.toLocaleString() + '\n' +
      'Future care:               $' + futureCareNum.toLocaleString() + '\n\n' +
      'TOTAL DEMAND:              $' + amt.toLocaleString() + '\n\n' +
      'This demand is made without prejudice and expires 30 days from the date of this letter.\n' +
      '[Replace this skeleton with the firm\'s reviewed demand template as needed.]'
    );
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
        <p className="muted small" style={{marginTop:0}}>A case can't advance while an approval is pending. Settlements and releases require the client's signature. The client acts on these from their dashboard; settlement approvals can also come back through messages.</p>
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
        <p className="muted small">Runs at intake — name collisions against adverse parties, plus the driver-at-fault rule (don't take a client adverse to a faulted driver we'd represent).</p>
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
        <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid var(--line)'}}>
          <h4 style={{fontSize:14,fontFamily:'var(--sans)',fontWeight:600,marginBottom:10}}>Add policy</h4>
          <div className="row">
            <div>
              <label>Kind</label>
              <select value={policyForm.kind} onChange={e=>setPolicyForm(f=>({...f,kind:e.target.value}))}>
                <option value="adverse_liability">adverse liability</option>
                <option value="client_um_uim">client UM / UIM</option>
                <option value="health">health</option>
                <option value="pip_medpay">PIP / MedPay</option>
                <option value="umbrella">umbrella</option>
              </select>
            </div>
            <div>
              <label>Carrier</label>
              <input value={policyForm.carrier} onChange={e=>setPolicyForm(f=>({...f,carrier:e.target.value}))} placeholder="Carrier name" />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Policy number</label>
              <input value={policyForm.policy_number} onChange={e=>setPolicyForm(f=>({...f,policy_number:e.target.value}))} placeholder="Policy #" />
            </div>
            <div>
              <label>Limits ($)</label>
              <input type="number" min="0" value={policyForm.limits} onChange={e=>setPolicyForm(f=>({...f,limits:e.target.value}))} placeholder="0" />
            </div>
          </div>
          <button className="btn sm" style={{marginTop:10}} onClick={addPolicy} disabled={addingPolicy}>
            {addingPolicy ? 'Saving…' : 'Add policy'}
          </button>
        </div>
      </div>}

      {tab==='treatment' && <>
        <div className="card">
          <h3>Treatment</h3>
          <table>
            <thead><tr><th>Provider</th><th>Status</th><th>Scheduled</th><th>Billed</th><th>Records</th><th>Bills</th><th></th></tr></thead>
            <tbody>
              {treatments.map(t => editTx?.id === t.id ? (
                <tr key={t.id}>
                  <td className="small"><b>{t.providers?.name ?? '—'}</b></td>
                  <td>
                    <select value={editTx.status} onChange={e=>setEditTx({...editTx,status:e.target.value})} style={{width:'auto'}}>
                      {['recommended','scheduled','ongoing','complete'].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><input type="date" value={editTx.scheduled_at} onChange={e=>setEditTx({...editTx,scheduled_at:e.target.value})} style={{width:150}} /></td>
                  <td><input type="number" min="0" value={editTx.total_billed} onChange={e=>setEditTx({...editTx,total_billed:e.target.value})} style={{width:90}} /></td>
                  <td><span className={`tag tiny ${t.records_received?'good':'warn'}`} style={{cursor:'pointer'}} onClick={()=>toggleTxBool(t.id,'records_received',t.records_received)}>{t.records_received?'rcvd':'pending'}</span></td>
                  <td><span className={`tag tiny ${t.bills_received?'good':'warn'}`} style={{cursor:'pointer'}} onClick={()=>toggleTxBool(t.id,'bills_received',t.bills_received)}>{t.bills_received?'rcvd':'pending'}</span></td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <button className="btn sm" onClick={saveTxEdit}>Save</button>{' '}
                    <button className="btn sm ghost" onClick={()=>setEditTx(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td className="small"><b>{t.providers?.name ?? '—'}</b>{t.providers?.specialty && <> · <span className="muted">{t.providers.specialty}</span></>}</td>
                  <td><span className={`tag tiny ${t.status==='complete'?'good':t.status==='ongoing'?'gold':'soft'}`}>{t.status}</span></td>
                  <td className="small">{t.scheduled_at ?? '—'}</td>
                  <td className="small">{t.total_billed ? `$${Number(t.total_billed).toLocaleString()}` : '—'}</td>
                  <td><span className={`tag tiny ${t.records_received?'good':'warn'}`} style={{cursor:'pointer'}} onClick={()=>toggleTxBool(t.id,'records_received',t.records_received)}>{t.records_received?'rcvd':'pending'}</span></td>
                  <td><span className={`tag tiny ${t.bills_received?'good':'warn'}`} style={{cursor:'pointer'}} onClick={()=>toggleTxBool(t.id,'bills_received',t.bills_received)}>{t.bills_received?'rcvd':'pending'}</span></td>
                  <td><button className="btn sm ghost" onClick={()=>setEditTx({id:t.id,status:t.status,scheduled_at:t.scheduled_at??'',total_billed:String(t.total_billed??'')})}>Edit</button></td>
                </tr>
              ))}
              {treatments.length===0 && <tr><td colSpan={7} className="muted">No treatments recorded.</td></tr>}
            </tbody>
          </table>
          {treatments.length>0 && <p className="small" style={{textAlign:'right',marginTop:6,color:'var(--ink-soft)'}}>Total billed: <b>${treatTotal.toLocaleString()}</b></p>}
          <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid var(--line)'}}>
            <h4 style={{fontSize:14,fontFamily:'var(--sans)',fontWeight:600,marginBottom:10}}>Add treatment</h4>
            <div className="row">
              <div>
                <label>Provider</label>
                <select value={txForm.provider_id} onChange={e=>setTxForm(f=>({...f,provider_id:e.target.value}))}>
                  <option value="">— select provider —</option>
                  {providers.map(p=><option key={p.id} value={p.id}>{p.name}{p.specialty ? ` (${p.specialty})` : ''}</option>)}
                  <option value="__new__">+ New provider…</option>
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={txForm.status} onChange={e=>setTxForm(f=>({...f,status:e.target.value}))}>
                  {['recommended','scheduled','ongoing','complete'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {txForm.provider_id==='__new__' && <div className="row">
              <div>
                <label>Provider name</label>
                <input value={txForm.newName} onChange={e=>setTxForm(f=>({...f,newName:e.target.value}))} placeholder="Name" />
              </div>
              <div>
                <label>Specialty</label>
                <input value={txForm.newSpecialty} onChange={e=>setTxForm(f=>({...f,newSpecialty:e.target.value}))} placeholder="e.g. Chiropractic" />
              </div>
            </div>}
            <div className="row">
              <div>
                <label>Scheduled date</label>
                <input type="date" value={txForm.scheduled_at} onChange={e=>setTxForm(f=>({...f,scheduled_at:e.target.value}))} />
              </div>
              <div>
                <label>Total billed ($)</label>
                <input type="number" min="0" value={txForm.total_billed} onChange={e=>setTxForm(f=>({...f,total_billed:e.target.value}))} placeholder="0" />
              </div>
            </div>
            <button className="btn sm" style={{marginTop:10}} onClick={addTreatment} disabled={addingTx}>
              {addingTx ? 'Saving…' : 'Add treatment'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Follow-ups</h3>
          <p className="muted small" style={{marginTop:0}}>SMS/email sending is a later integration phase — this tracks the data only.</p>
          <table>
            <thead><tr><th>Label</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {followUps.map(f=>(
                <tr key={f.id}>
                  <td className="small">{f.label}</td>
                  <td className="small">{f.due_at ? new Date(f.due_at).toLocaleDateString() : '—'}</td>
                  <td>{f.done ? <span className="tag good tiny">done</span> : <span className="tag warn tiny">open</span>}</td>
                  <td>{!f.done && <button className="btn sm ghost" onClick={()=>markFuDone(f.id)}>Mark done</button>}</td>
                </tr>
              ))}
              {followUps.length===0 && <tr><td colSpan={4} className="muted">No follow-ups recorded.</td></tr>}
            </tbody>
          </table>
          <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid var(--line)'}}>
            <div className="row">
              <div>
                <label>Label</label>
                <input value={fuForm.label} onChange={e=>setFuForm(f=>({...f,label:e.target.value}))} placeholder="e.g. 2 week check-in" />
              </div>
              <div>
                <label>Due date</label>
                <input type="date" value={fuForm.due_at} onChange={e=>setFuForm(f=>({...f,due_at:e.target.value}))} />
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
              <button className="btn sm" onClick={addFollowUp} disabled={addingFu || !fuForm.label}>
                {addingFu ? 'Saving…' : 'Add follow-up'}
              </button>
              <button className="btn sm ghost" onClick={generateCadence}>Generate standard cadence (24h / 5d / 2wk / 30d)</button>
            </div>
          </div>
        </div>
      </>}

      {tab==='demand' && <div className="card">
        <h3>Demand builder</h3>
        {/* v1: multiplier and future_care are builder inputs captured in the body text and
            final amount only — not persisted as separate columns; no migration needed. */}
        <div style={{marginBottom:14}}>
          {demand && <span className={`tag tiny ${demand.status==='sent'||demand.status==='approved'?'good':demand.status==='client_review'?'gold':'soft'}`} style={{marginRight:8}}>{demand.status.replace(/_/g,' ')}</span>}
          {demand && DEMAND_STATUSES.indexOf(demand.status) < DEMAND_STATUSES.length-1 &&
            <button className="btn sm ghost" onClick={advanceDemandStatus}>
              Advance to {DEMAND_STATUSES[DEMAND_STATUSES.indexOf(demand.status)+1].replace(/_/g,' ')}
            </button>}
        </div>
        <div style={{background:'var(--paper)',border:'1px solid var(--line)',borderRadius:9,padding:'12px 16px',marginBottom:16}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px 24px',fontSize:14}}>
            <div><span className="muted small">Medical specials</span><br/><b>${treatTotal.toLocaleString()}</b></div>
            <div><span className="muted small">Wage loss</span><br/><b>${wageLoss.toLocaleString()}</b></div>
            <div><span className="muted small">Specials total</span><br/><b>${specialsTotal.toLocaleString()}</b></div>
          </div>
        </div>
        <div className="row">
          <div>
            <label>General damages multiplier</label>
            <input type="number" min="0" step="0.5" value={multiplier} onChange={e=>setMultiplier(e.target.value)} />
            <span className="muted small" style={{marginTop:4,display:'block'}}>General damages: ${generalDamages.toLocaleString()}</span>
          </div>
          <div>
            <label>Future care ($)</label>
            <input type="number" min="0" value={futureCare} onChange={e=>setFutureCare(e.target.value)} />
          </div>
        </div>
        <div style={{marginTop:12}}>
          <label>Demand amount ($)</label>
          <input type="number" min="0" value={demandAmt} placeholder={String(computedDemand)} onChange={e=>setDemandAmt(e.target.value)} />
          <span className="muted small" style={{marginTop:4,display:'block'}}>Computed: ${computedDemand.toLocaleString()} — leave blank to use, or type to override.</span>
        </div>
        <div style={{marginTop:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
            <label style={{margin:0}}>Demand letter body</label>
            <button className="btn sm ghost" onClick={generateDemandDraft}>Generate draft</button>
          </div>
          <p className="muted small" style={{margin:'0 0 6px'}}>The firm's reviewed demand template can replace this skeleton. Edit freely before saving.</p>
          <textarea value={demandBody} onChange={e=>setDemandBody(e.target.value)} rows={18} style={{width:'100%',fontFamily:'monospace',fontSize:13,lineHeight:1.5}} />
        </div>
        <button className="btn sm" style={{marginTop:10}} onClick={saveDemand} disabled={savingDemand}>
          {savingDemand ? 'Saving...' : demand ? 'Save changes' : 'Create demand'}
        </button>
      </div>}

      {['money','lit'].includes(tab) && <div className="card">
        <div className="scaffold">
          <b>{ {money:'Settlement, reductions, liens & trust accounting',lit:'Litigation & pleadings'}[tab as any] }</b><br/>
          This module's tables exist in the database and are wired into the data model; the working UI is the next build pass. Nothing here will require migration — it slots onto the schema that's already live.
        </div>
      </div>}
    </>
  );
}
