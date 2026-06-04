import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

// lien_type enum + values added in 06_enum_extensions.sql
const LIEN_TYPES = ['medicare','medicaid','erisa','hospital','pip_medpay','ahcccs','provider','other'];

interface Props {
  caseId: string;
  c: any;
  treatTotal: number;
  providers: any[];
}

export default function MoneyTab({ caseId, c, treatTotal, providers }: Props) {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [liens, setLiens] = useState<any[]>([]);
  const [reductions, setReductions] = useState<any[]>([]);
  const [disbursement, setDisbursement] = useState<any>(null);

  const [sfForm, setSfForm] = useState({ offer_amount: '', status: 'offered' });
  const [addingSf, setAddingSf] = useState(false);

  const [lienForm, setLienForm] = useState({ type: 'medicare', holder: '', amount: '' });
  const [addingLien, setAddingLien] = useState(false);

  const [redForm, setRedForm] = useState({ provider_id: '', original: '', requested: '' });
  const [addingRed, setAddingRed] = useState(false);
  const [editRed, setEditRed] = useState<any>(null);

  const [gross, setGross] = useState('');
  const [fees, setFees] = useState('');
  const [medical, setMedical] = useState('');
  const [savingDisb, setSavingDisb] = useState(false);

  async function load() {
    const { data: sf } = await supabase.from('settlements').select('*').eq('case_id', caseId).order('created_at',{ascending:false});
    setSettlements(sf ?? []);
    const { data: ln } = await supabase.from('liens').select('*').eq('case_id', caseId);
    setLiens(ln ?? []);
    const { data: rd } = await supabase.from('reductions').select('*, providers(name)').eq('case_id', caseId);
    setReductions(rd ?? []);
    const { data: db } = await supabase.from('disbursements').select('*').eq('case_id', caseId).order('created_at',{ascending:false}).limit(1);
    const latestDisb = db?.[0] ?? null;
    setDisbursement(latestDisb);
    if (latestDisb) {
      setGross(String(latestDisb.settlement_amount ?? ''));
      setFees(String(latestDisb.fees ?? ''));
      setMedical(String(latestDisb.medical ?? ''));
    }
  }
  useEffect(() => { load(); }, [caseId]);

  // Derived
  const liensTotal = liens.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const reductionsMedical = reductions.length > 0
    ? reductions.reduce((s, r) => s + (Number(r.agreed ?? r.original) || 0), 0)
    : null;
  const fundedOffer = settlements.find(s => s.status === 'funded')
    ?? settlements.find(s => s.status === 'approved')
    ?? null;
  const wsGross   = gross   !== '' ? Number(gross)   : (fundedOffer ? Number(fundedOffer.offer_amount) : 0);
  const wsFees    = fees    !== '' ? Number(fees)     : wsGross * (Number(c.fee_pct) || 0.3333);
  const wsMedical = medical !== '' ? Number(medical)  : (reductionsMedical !== null ? reductionsMedical : treatTotal);
  const wsNet     = wsGross - wsFees - wsMedical - liensTotal;

  const feeLabel = ((Number(c.fee_pct) || 0.3333) * 100).toFixed(1) + '%';

  // Settlement
  async function addSettlement() {
    setAddingSf(true);
    await supabase.from('settlements').insert({
      case_id: caseId,
      offer_amount: sfForm.offer_amount ? Number(sfForm.offer_amount) : null,
      status: sfForm.status,
    });
    setSfForm({ offer_amount: '', status: 'offered' });
    setAddingSf(false);
    load();
  }

  async function advanceSettlement(s: any, next: string) {
    await supabase.from('settlements').update({ status: next }).eq('id', s.id);
    load();
  }

  async function toggleSettlementApproved(s: any) {
    await supabase.from('settlements').update({ client_approved: !s.client_approved }).eq('id', s.id);
    load();
  }

  // Liens
  async function addLien() {
    setAddingLien(true);
    await supabase.from('liens').insert({
      case_id: caseId,
      type: lienForm.type,
      holder: lienForm.holder || null,
      amount: lienForm.amount ? Number(lienForm.amount) : null,
    });
    setLienForm({ type: 'medicare', holder: '', amount: '' });
    setAddingLien(false);
    load();
  }

  async function toggleLienBool(lienId: string, field: string, current: boolean) {
    await supabase.from('liens').update({ [field]: !current }).eq('id', lienId);
    load();
  }

  // Reductions
  async function addReduction() {
    setAddingRed(true);
    await supabase.from('reductions').insert({
      case_id: caseId,
      provider_id: redForm.provider_id || null,
      original: redForm.original ? Number(redForm.original) : null,
      requested: redForm.requested ? Number(redForm.requested) : null,
      status: 'pending',
    });
    setRedForm({ provider_id: '', original: '', requested: '' });
    setAddingRed(false);
    load();
  }

  async function saveReductionEdit() {
    await supabase.from('reductions').update({
      agreed: editRed.agreed ? Number(editRed.agreed) : null,
      status: editRed.status,
    }).eq('id', editRed.id);
    setEditRed(null);
    load();
  }

  // Disbursement
  async function saveDisbursement() {
    setSavingDisb(true);
    const payload = {
      case_id: caseId,
      settlement_amount: wsGross,
      fees: wsFees,
      medical: wsMedical,
      liens_total: liensTotal,
      net_to_client: wsNet,
      phase: c.fee_phase ?? 'pre_lit',
    };
    if (disbursement) {
      await supabase.from('disbursements').update(payload).eq('id', disbursement.id);
    } else {
      await supabase.from('disbursements').insert(payload);
    }
    setSavingDisb(false);
    load();
  }

  async function toggleDisbApproved() {
    if (!disbursement) return;
    await supabase.from('disbursements').update({ client_approved: !disbursement.client_approved }).eq('id', disbursement.id);
    load();
  }

  return (
    <>
      {/* --- a: Settlement offers --- */}
      <div className="card">
        <h3>Settlement offers</h3>
        <table>
          <thead><tr><th>Amount</th><th>Status</th><th>Client approved</th><th></th></tr></thead>
          <tbody>
            {settlements.map(s => (
              <tr key={s.id}>
                <td className="small"><b>{s.offer_amount ? '$' + Number(s.offer_amount).toLocaleString() : '--'}</b></td>
                <td><span className={`tag tiny ${s.status==='funded'||s.status==='approved'?'good':s.status==='rejected'?'bad':'gold'}`}>{s.status}</span></td>
                <td>
                  <span className={`tag tiny ${s.client_approved?'good':'warn'}`} style={{cursor:'pointer'}} onClick={()=>toggleSettlementApproved(s)}>
                    {s.client_approved ? 'yes' : 'no'}
                  </span>
                </td>
                <td style={{whiteSpace:'nowrap'}}>
                  {s.status === 'offered' && <>
                    <button className="btn sm ghost" style={{marginRight:4}} onClick={()=>advanceSettlement(s,'approved')}>Approve</button>
                    <button className="btn sm ghost" onClick={()=>advanceSettlement(s,'rejected')}>Reject</button>
                  </>}
                  {s.status === 'approved' && <button className="btn sm ghost" onClick={()=>advanceSettlement(s,'funded')}>Mark funded</button>}
                </td>
              </tr>
            ))}
            {settlements.length === 0 && <tr><td colSpan={4} className="muted">No offers recorded.</td></tr>}
          </tbody>
        </table>
        <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--line)'}}>
          <h4 style={{fontSize:14,fontFamily:'var(--sans)',fontWeight:600,marginBottom:8}}>Add offer</h4>
          <div className="row">
            <div>
              <label>Offer amount ($)</label>
              <input type="number" min="0" value={sfForm.offer_amount} onChange={e=>setSfForm(f=>({...f,offer_amount:e.target.value}))} placeholder="0" />
            </div>
            <div>
              <label>Status</label>
              <select value={sfForm.status} onChange={e=>setSfForm(f=>({...f,status:e.target.value}))}>
                {['offered','approved','rejected','funded'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button className="btn sm" style={{marginTop:8}} onClick={addSettlement} disabled={addingSf}>
            {addingSf ? 'Saving...' : 'Add offer'}
          </button>
        </div>
      </div>

      {/* --- b: Liens --- */}
      <div className="card">
        <h3>Liens</h3>
        <table>
          <thead><tr><th>Type</th><th>Holder</th><th>Amount</th><th>Recorded</th><th>Acknowledged</th></tr></thead>
          <tbody>
            {liens.map(l => (
              <tr key={l.id}>
                <td className="small">{l.type.replace(/_/g,' ')}</td>
                <td className="small">{l.holder ?? '--'}</td>
                <td className="small">{l.amount ? '$' + Number(l.amount).toLocaleString() : '--'}</td>
                <td>
                  <span className={`tag tiny ${l.recorded?'good':'warn'}`} style={{cursor:'pointer'}} onClick={()=>toggleLienBool(l.id,'recorded',l.recorded)}>
                    {l.recorded ? 'yes' : 'no'}
                  </span>
                </td>
                <td>
                  <span className={`tag tiny ${l.acknowledged?'good':'warn'}`} style={{cursor:'pointer'}} onClick={()=>toggleLienBool(l.id,'acknowledged',l.acknowledged)}>
                    {l.acknowledged ? 'yes' : 'no'}
                  </span>
                </td>
              </tr>
            ))}
            {liens.length === 0 && <tr><td colSpan={5} className="muted">No liens recorded.</td></tr>}
          </tbody>
        </table>
        <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--line)'}}>
          <h4 style={{fontSize:14,fontFamily:'var(--sans)',fontWeight:600,marginBottom:8}}>Add lien</h4>
          <div className="row">
            <div>
              <label>Type</label>
              <select value={lienForm.type} onChange={e=>setLienForm(f=>({...f,type:e.target.value}))}>
                {LIEN_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label>Holder</label>
              <input value={lienForm.holder} onChange={e=>setLienForm(f=>({...f,holder:e.target.value}))} placeholder="Lienholder name" />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Amount ($)</label>
              <input type="number" min="0" value={lienForm.amount} onChange={e=>setLienForm(f=>({...f,amount:e.target.value}))} placeholder="0" />
            </div>
            <div style={{display:'flex',alignItems:'flex-end'}}>
              <button className="btn sm" onClick={addLien} disabled={addingLien}>
                {addingLien ? 'Saving...' : 'Add lien'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- c: Medical bill reductions --- */}
      <div className="card">
        <h3>Medical bill reductions</h3>
        <table>
          <thead><tr><th>Provider</th><th>Original</th><th>Requested</th><th>Agreed</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {reductions.map(r => editRed?.id === r.id ? (
              <tr key={r.id}>
                <td className="small">{r.providers?.name ?? '--'}</td>
                <td className="small">{r.original ? '$' + Number(r.original).toLocaleString() : '--'}</td>
                <td className="small">{r.requested ? '$' + Number(r.requested).toLocaleString() : '--'}</td>
                <td><input type="number" min="0" value={editRed.agreed} onChange={e=>setEditRed({...editRed,agreed:e.target.value})} style={{width:90}} /></td>
                <td>
                  <select value={editRed.status} onChange={e=>setEditRed({...editRed,status:e.target.value})} style={{width:'auto'}}>
                    {['pending','requested','agreed','refused'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{whiteSpace:'nowrap'}}>
                  <button className="btn sm" onClick={saveReductionEdit}>Save</button>{' '}
                  <button className="btn sm ghost" onClick={()=>setEditRed(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td className="small">{r.providers?.name ?? '--'}</td>
                <td className="small">{r.original ? '$' + Number(r.original).toLocaleString() : '--'}</td>
                <td className="small">{r.requested ? '$' + Number(r.requested).toLocaleString() : '--'}</td>
                <td className="small">{r.agreed ? '$' + Number(r.agreed).toLocaleString() : '--'}</td>
                <td><span className={`tag tiny ${r.status==='agreed'?'good':r.status==='refused'?'bad':'gold'}`}>{r.status}</span></td>
                <td><button className="btn sm ghost" onClick={()=>setEditRed({id:r.id,agreed:String(r.agreed??''),status:r.status})}>Edit</button></td>
              </tr>
            ))}
            {reductions.length === 0 && <tr><td colSpan={6} className="muted">No reductions recorded.</td></tr>}
          </tbody>
        </table>
        <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--line)'}}>
          <h4 style={{fontSize:14,fontFamily:'var(--sans)',fontWeight:600,marginBottom:8}}>Add reduction</h4>
          <div className="row">
            <div>
              <label>Provider</label>
              <select value={redForm.provider_id} onChange={e=>setRedForm(f=>({...f,provider_id:e.target.value}))}>
                <option value="">-- select provider --</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label>Original billed ($)</label>
              <input type="number" min="0" value={redForm.original} onChange={e=>setRedForm(f=>({...f,original:e.target.value}))} placeholder="0" />
            </div>
            <div>
              <label>Requested ($)</label>
              <input type="number" min="0" value={redForm.requested} onChange={e=>setRedForm(f=>({...f,requested:e.target.value}))} placeholder="0" />
            </div>
          </div>
          <button className="btn sm" style={{marginTop:8}} onClick={addReduction} disabled={addingRed}>
            {addingRed ? 'Saving...' : 'Add reduction'}
          </button>
        </div>
      </div>

      {/* --- d: Settlement worksheet --- */}
      <div className="card">
        <h3>Settlement worksheet</h3>
        {disbursement && (
          <div style={{marginBottom:12}}>
            <span
              className={`tag tiny ${disbursement.client_approved?'good':'warn'}`}
              style={{cursor:'pointer'}}
              onClick={toggleDisbApproved}
            >
              Client {disbursement.client_approved ? 'approved' : 'approval pending'}
            </span>
          </div>
        )}
        <div className="row">
          <div>
            <label>Gross settlement ($){fundedOffer ? ' — auto from funded/approved offer' : ''}</label>
            <input type="number" min="0" value={gross} placeholder={String(wsGross)} onChange={e=>setGross(e.target.value)} />
          </div>
          <div>
            <label>Attorney fees ($) — {feeLabel}</label>
            <input type="number" min="0" value={fees} placeholder={String(Math.round(wsFees))} onChange={e=>setFees(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div>
            <label>Medical {reductionsMedical !== null ? '— from reductions' : '— from treatment total'} ($)</label>
            <input type="number" min="0" value={medical} placeholder={String(wsMedical)} onChange={e=>setMedical(e.target.value)} />
          </div>
          <div>
            <label>Liens total ($) — sum of liens above</label>
            <input type="number" readOnly value={liensTotal} style={{background:'var(--paper)',color:'var(--ink-soft)'}} />
          </div>
        </div>
        <div style={{background:'var(--paper)',border:'1px solid var(--line)',borderRadius:9,padding:'14px 16px',margin:'14px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <span className="muted small">Net to client</span>
            <span style={{fontSize:22,fontFamily:'var(--serif)',fontWeight:600,color:wsNet>=0?'var(--good)':'var(--bad)'}}>
              ${wsNet.toLocaleString(undefined,{maximumFractionDigits:0})}
            </span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:10,fontSize:13}}>
            <div><span className="muted">Gross</span><br/>${wsGross.toLocaleString()}</div>
            <div><span className="muted">Fees</span><br/>${Math.round(wsFees).toLocaleString()}</div>
            <div><span className="muted">Medical</span><br/>${wsMedical.toLocaleString()}</div>
            <div><span className="muted">Liens</span><br/>${liensTotal.toLocaleString()}</div>
          </div>
        </div>
        <button className="btn sm" onClick={saveDisbursement} disabled={savingDisb}>
          {savingDisb ? 'Saving...' : disbursement ? 'Update worksheet' : 'Save worksheet'}
        </button>
      </div>
    </>
  );
}
