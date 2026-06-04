import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../App';
import { subpoenaRecords } from '../../../lib/accidentDoctorBridge';

interface Props {
  caseId: string;
  c: any;
}

export default function LitTab({ caseId }: Props) {
  const { profile } = useAuth();
  const [lit, setLit] = useState<any>(null);
  const [pleadings, setPleadings] = useState<any[]>([]);
  const [mediation, setMediation] = useState<any>(null);

  const [litForm, setLitForm] = useState({ filing_date: '', court: '', cause_number: '' });
  const [savingLit, setSavingLit] = useState(false);

  const [pleadingForm, setPleadingForm] = useState({ type: '', status: 'draft', body: '' });
  const [addingPleading, setAddingPleading] = useState(false);

  const [medForm, setMedForm] = useState({ scheduled: '', resolution: '' });
  const [savingMed, setSavingMed] = useState(false);

  const [subpoenaing, setSubpoenaing] = useState(false);
  const [subpoenaMsg, setSubpoenaMsg] = useState('');

  const PLEADING_STATUSES = ['draft', 'filed', 'served'];

  async function load() {
    const { data: ln } = await supabase.from('litigation').select('*').eq('case_id', caseId).limit(1);
    const litRow = ln?.[0] ?? null;
    setLit(litRow);
    if (litRow) {
      setLitForm({
        filing_date: litRow.filing_date ?? '',
        court: litRow.court ?? '',
        cause_number: litRow.cause_number ?? '',
      });
    }

    const { data: pl } = await supabase.from('pleadings').select('*').eq('case_id', caseId);
    setPleadings(pl ?? []);

    const { data: md } = await supabase.from('mediations').select('*').eq('case_id', caseId).limit(1);
    const medRow = md?.[0] ?? null;
    setMediation(medRow);
    if (medRow) {
      setMedForm({
        scheduled: medRow.scheduled ?? '',
        resolution: medRow.resolution ?? '',
      });
    }
  }

  useEffect(() => { load(); }, [caseId]);

  async function saveLit() {
    setSavingLit(true);
    const payload = {
      case_id: caseId,
      filing_date: litForm.filing_date || null,
      court: litForm.court || null,
      cause_number: litForm.cause_number || null,
    };
    if (lit) {
      await supabase.from('litigation').update(payload).eq('id', lit.id);
    } else {
      await supabase.from('litigation').insert(payload);
    }
    setSavingLit(false);
    load();
  }

  async function addPleading() {
    setAddingPleading(true);
    await supabase.from('pleadings').insert({
      case_id: caseId,
      type: pleadingForm.type || null,
      status: pleadingForm.status,
      body: pleadingForm.body || null,
    });
    setPleadingForm({ type: '', status: 'draft', body: '' });
    setAddingPleading(false);
    load();
  }

  async function advancePleading(pl: any) {
    const idx = PLEADING_STATUSES.indexOf(pl.status);
    const next = PLEADING_STATUSES[Math.min(idx + 1, PLEADING_STATUSES.length - 1)];
    if (next === pl.status) return;
    await supabase.from('pleadings').update({ status: next }).eq('id', pl.id);
    load();
  }

  async function saveMed() {
    setSavingMed(true);
    const payload = {
      case_id: caseId,
      scheduled: medForm.scheduled || null,
      resolution: medForm.resolution || null,
    };
    if (mediation) {
      await supabase.from('mediations').update(payload).eq('id', mediation.id);
    } else {
      // offers jsonb left at default '[]' -- round-by-round mediation offers are a later enhancement
      await supabase.from('mediations').insert(payload);
    }
    setSavingMed(false);
    load();
  }

  async function handleSubpoena() {
    setSubpoenaing(true);
    setSubpoenaMsg('');
    const records = await subpoenaRecords(caseId);
    for (const rec of records) {
      await supabase.from('documents').insert({
        case_id: caseId,
        name: rec.name,
        category: 'medical',
        storage_path: null,
        uploaded_by: profile?.id ?? null,
      });
    }
    setSubpoenaMsg('Pulled ' + records.length + ' record(s) via subpoena (demo data). Visible in File cabinet.');
    setSubpoenaing(false);
    load();
  }

  async function toggleMedApproved() {
    if (!mediation) return;
    await supabase.from('mediations').update({ client_approved: !mediation.client_approved }).eq('id', mediation.id);
    load();
  }

  return (
    <>
      {/* a: Litigation record */}
      <div className="card">
        <h3>Litigation record</h3>
        <div className="row">
          <div>
            <label>Filing date</label>
            <input type="date" value={litForm.filing_date} onChange={e => setLitForm(f => ({ ...f, filing_date: e.target.value }))} />
          </div>
          <div>
            <label>Court</label>
            <input value={litForm.court} onChange={e => setLitForm(f => ({ ...f, court: e.target.value }))} placeholder="e.g. Maricopa County Superior Court" />
          </div>
          <div>
            <label>Cause number</label>
            <input value={litForm.cause_number} onChange={e => setLitForm(f => ({ ...f, cause_number: e.target.value }))} placeholder="CV-2024-000000" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={saveLit} disabled={savingLit}>
            {savingLit ? 'Saving...' : lit ? 'Update record' : 'Create record'}
          </button>
          <button className="btn sm ghost" onClick={handleSubpoena} disabled={subpoenaing}>
            {subpoenaing ? 'Pulling...' : 'Subpoena records (AccidentDoctor.AI) (demo)'}
          </button>
        </div>
        {subpoenaMsg && <p className="small" style={{ margin: '8px 0 0', color: 'var(--good)' }}>{subpoenaMsg}</p>}
      </div>

      {/* b: Pleadings */}
      <div className="card">
        <h3>Pleadings</h3>
        <table>
          <thead>
            <tr><th>Type</th><th>Status</th><th>Body preview</th><th></th></tr>
          </thead>
          <tbody>
            {pleadings.map(pl => (
              <tr key={pl.id}>
                <td className="small"><b>{pl.type ?? '--'}</b></td>
                <td>
                  <span className={`tag tiny ${pl.status === 'served' ? 'good' : pl.status === 'filed' ? 'gold' : 'soft'}`}>
                    {pl.status}
                  </span>
                </td>
                <td className="small muted" style={{ maxWidth: 280 }}>
                  {pl.body ? pl.body.slice(0, 80) + (pl.body.length > 80 ? '...' : '') : '--'}
                </td>
                <td>
                  {pl.status !== 'served' && (
                    <button className="btn sm ghost" onClick={() => advancePleading(pl)}>
                      {pl.status === 'draft' ? 'Mark filed' : 'Mark served'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {pleadings.length === 0 && (
              <tr><td colSpan={4} className="muted">No pleadings recorded.</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: 14, fontFamily: 'var(--sans)', fontWeight: 600, marginBottom: 10 }}>Add pleading</h4>
          <div className="row">
            <div>
              <label>Type</label>
              <input
                value={pleadingForm.type}
                onChange={e => setPleadingForm(f => ({ ...f, type: e.target.value }))}
                placeholder="e.g. Complaint, Answer, Motion"
              />
            </div>
            <div>
              <label>Status</label>
              <select value={pleadingForm.status} onChange={e => setPleadingForm(f => ({ ...f, status: e.target.value }))}>
                {PLEADING_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>Body</label>
            <textarea
              rows={4}
              value={pleadingForm.body}
              onChange={e => setPleadingForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Pleading body text..."
              style={{ resize: 'vertical' }}
            />
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={addPleading} disabled={addingPleading || !pleadingForm.type}>
            {addingPleading ? 'Saving...' : 'Add pleading'}
          </button>
        </div>
      </div>

      {/* c: Mediation */}
      <div className="card">
        <h3>Mediation</h3>
        <div className="row">
          <div>
            <label>Scheduled date</label>
            <input type="date" value={medForm.scheduled} onChange={e => setMedForm(f => ({ ...f, scheduled: e.target.value }))} />
          </div>
          <div>
            <label>Resolution</label>
            <input
              value={medForm.resolution}
              onChange={e => setMedForm(f => ({ ...f, resolution: e.target.value }))}
              placeholder="e.g. Settled, impasse, continued..."
            />
          </div>
        </div>
        {mediation && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="small" style={{ color: 'var(--ink-soft)' }}>Client approved</span>
            <span
              className={`tag tiny ${mediation.client_approved ? 'good' : 'warn'}`}
              style={{ cursor: 'pointer' }}
              onClick={toggleMedApproved}
            >
              {mediation.client_approved ? 'yes' : 'no'}
            </span>
          </div>
        )}
        <button className="btn sm" style={{ marginTop: 12 }} onClick={saveMed} disabled={savingMed}>
          {savingMed ? 'Saving...' : mediation ? 'Update mediation' : 'Create mediation'}
        </button>
      </div>
    </>
  );
}
