import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const statusTag: Record<string,string> = {
  lead:'soft', under_review:'gold', info_requested:'warn', accepted:'good', denied:'soft',
  treating:'ink', demand:'gold', settlement:'good', litigation:'bad', closed:'soft',
};

export default function CaseList() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await supabase
      .from('cases')
      .select('*, clients(full_name, is_minor)')
      .order('updated_at', { ascending: false });
    setRows(data ?? []); setLoading(false);
  })(); }, []);

  const reviewing = rows.filter(r => ['lead','under_review','info_requested'].includes(r.status)).length;

  return (
    <>
      <div className="page-h">
        <div><h1>Caseload</h1><div className="sub">{rows.length} cases · {reviewing} awaiting review</div></div>
      </div>

      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead><tr>
            <th>Client</th><th>Claim</th><th>Status</th><th>DOL</th><th>Flags</th><th>SOL</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="muted">Loading…</td></tr>}
            {!loading && rows.length===0 && <tr><td colSpan={6} className="muted">No cases yet.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="clickable" onClick={()=>nav(`/cases/${r.id}`)}>
                <td><b>{r.clients?.full_name ?? '—'}</b>{r.clients?.is_minor && <span className="tag soft tiny" style={{marginLeft:8}}>minor</span>}</td>
                <td className="small">{(r.claim??'').replace(/_/g,' ')||'—'}</td>
                <td><span className={`tag ${statusTag[r.status]||'soft'}`}>{r.status.replace(/_/g,' ')}</span></td>
                <td className="small">{r.date_of_loss ?? '—'}</td>
                <td>
                  {r.liability_disputed && <span className="tag bad tiny" style={{marginRight:4}}>liability</span>}
                  {r.limits_issue && <span className="tag warn tiny">limits</span>}
                  {!r.liability_disputed && !r.limits_issue && <span className="muted tiny">—</span>}
                </td>
                <td className="small">{r.sol_date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
