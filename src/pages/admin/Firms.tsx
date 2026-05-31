import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Firms() {
  const [firms, setFirms] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name:'', marketing_source:'', metrics:true, security:true, informed:true });

  async function load() {
    const { data: fr } = await supabase.from('firms').select('*').order('created_at',{ascending:false});
    setFirms(fr ?? []);
    const { data: m } = await supabase.rpc('platform_metrics');
    setMetrics(m ?? []);
  }
  useEffect(() => { load(); }, []);

  async function addFirm() {
    if (!f.name.trim()) return;
    await supabase.from('firms').insert({
      name: f.name, marketing_source: f.marketing_source,
      allow_platform_metrics: f.metrics, data_security_agreed: f.security,
      clients_informed_agreed: f.informed, default_jurisdiction: 'AZ',
    });
    setF({ name:'', marketing_source:'', metrics:true, security:true, informed:true });
    setAdding(false); load();
  }

  const metricFor = (id:string) => metrics.find(m => m.firm_id === id);

  return (
    <>
      <div className="page-h">
        <div><h1>Firms & metrics</h1><div className="sub">{firms.length} firms on the platform</div></div>
        <button className="btn oxblood" onClick={()=>setAdding(a=>!a)}>{adding?'Cancel':'Onboard a firm'}</button>
      </div>

      {adding && <div className="card" style={{maxWidth:560}}>
        <h3>New firm</h3>
        <label>Firm name</label>
        <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Smith & Associates" />
        <label>Marketing source</label>
        <input value={f.marketing_source} onChange={e=>setF({...f,marketing_source:e.target.value})} placeholder="Google Ads, referral, LSA…" />
        <div style={{marginTop:14,display:'grid',gap:8}}>
          {[
            ['security','The firm agrees its client data will be kept secured and isolated.'],
            ['informed','The firm agrees its clients will be informed they are using this platform.'],
            ['metrics','The firm agrees to share caseload, settlement, and marketing metrics with the platform.'],
          ].map(([k,label])=>(
            <label key={k} style={{display:'flex',gap:10,alignItems:'flex-start',fontWeight:400,color:'var(--ink)'}}>
              <input type="checkbox" style={{width:18,marginTop:2}} checked={(f as any)[k]} onChange={e=>setF({...f,[k]:e.target.checked})} />
              <span className="small">{label}</span>
            </label>
          ))}
        </div>
        <button className="btn oxblood" style={{marginTop:16}} disabled={!f.name||!f.security} onClick={addFirm}>Create firm</button>
        <p className="muted tiny" style={{marginTop:8}}>Inviting the firm’s first attorney login is a server-side step (edge function), wired once integrations are configured.</p>
      </div>}

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead><tr><th>Firm</th><th>Consents</th><th>Caseload</th><th>Open</th><th>Settled (funded)</th><th>Marketing</th></tr></thead>
          <tbody>
            {firms.map(fr => { const m = metricFor(fr.id); return (
              <tr key={fr.id}>
                <td><b>{fr.name}</b><div className="muted tiny">{fr.status}</div></td>
                <td>
                  {fr.data_security_agreed && <span className="tag good tiny" style={{marginRight:3}}>secured</span>}
                  {fr.clients_informed_agreed && <span className="tag good tiny" style={{marginRight:3}}>informed</span>}
                  {fr.allow_platform_metrics ? <span className="tag gold tiny">metrics</span> : <span className="tag soft tiny">no metrics</span>}
                </td>
                <td>{m?m.caseload:<span className="muted tiny">—</span>}</td>
                <td>{m?m.open_cases:<span className="muted tiny">—</span>}</td>
                <td>{m?`$${Number(m.total_settled).toLocaleString()}`:<span className="muted tiny">opted out</span>}</td>
                <td className="small">{fr.marketing_source||'—'}</td>
              </tr>
            );})}
            {firms.length===0 && <tr><td colSpan={6} className="muted">No firms yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted tiny">Metrics are aggregates only — client names and case details never leave a firm’s boundary.</p>
    </>
  );
}
