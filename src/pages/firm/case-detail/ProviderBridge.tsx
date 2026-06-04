import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { syncProviderUpdates, detectDischarge } from '../../../lib/accidentDoctorBridge';

interface Props {
  caseId: string;
  c: any;
  onChange: () => void;
}

export default function ProviderBridge({ caseId, c, onChange }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleSync() {
    setSyncing(true);
    setMsg('');
    const visits = await syncProviderUpdates(caseId);
    for (const visit of visits) {
      // Query-then-insert: providers has no unique constraint on name
      const { data: existing } = await supabase
        .from('providers')
        .select('id')
        .eq('name', visit.providerName)
        .limit(1)
        .maybeSingle();
      let providerId = existing?.id ?? null;
      if (!providerId) {
        const { data: created } = await supabase
          .from('providers')
          .insert({ name: visit.providerName, specialty: visit.specialty })
          .select('id')
          .single();
        providerId = created?.id ?? null;
      }
      await supabase.from('treatments').insert({
        case_id: caseId,
        provider_id: providerId,
        status: 'ongoing',
        scheduled_at: visit.visitDate,
        total_billed: visit.charge,
      });
      await supabase.from('journal_entries').insert({
        case_id: caseId,
        kind: 'treatment',
        entry_date: visit.visitDate,
        content: '[' + visit.cptCode + '] ' + visit.summary,
      });
    }
    setMsg('Synced ' + visits.length + ' visit(s) from AccidentDoctor.AI (demo data).');
    setSyncing(false);
    onChange();
  }

  async function handleDischarge() {
    setDischarging(true);
    setMsg('');
    const event = await detectDischarge(caseId);
    await supabase
      .from('treatments')
      .update({ status: 'complete', records_received: true, bills_received: true })
      .eq('case_id', caseId);
    await supabase.from('communications').insert({
      case_id: caseId,
      channel: 'email',
      requires_approval: true,
      status: 'queued',
      drafted_by: 'agent',
      subject: 'Your treatment is complete -- please confirm',
      body: [
        'Dear ' + (c.clients?.full_name ?? 'client') + ',',
        '',
        'Our records show that ' + event.providerName + ' has discharged you as of ' + event.dischargeDate + '.',
        '',
        'Please confirm that your treatment is complete and that you have no outstanding appointments.',
        'Once confirmed, we will begin preparing your demand package.',
        '',
        '-- Your legal team',
      ].join('\n'),
    });
    setMsg('Discharge processed: all treatments marked complete. Confirmation email queued for attorney release.');
    setDischarging(false);
    onChange();
  }

  return (
    <div className="card" style={{ borderColor: 'var(--gold)', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ marginBottom: 2 }}>
            AccidentDoctor.AI provider bridge{' '}
            <span className="tag soft tiny" style={{ verticalAlign: 'middle' }}>demo</span>
          </h3>
          <p className="muted small" style={{ margin: 0 }}>
            Synthetic demo data only -- no live API call. Real implementation swaps in behind this panel with no UI change.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn sm ghost" onClick={handleSync} disabled={syncing || discharging}>
            {syncing ? 'Syncing...' : 'Sync provider updates'}
          </button>
          <button className="btn sm ghost" onClick={handleDischarge} disabled={syncing || discharging}>
            {discharging ? 'Processing...' : 'Mark discharged'}
          </button>
        </div>
      </div>
      {msg && <p className="small" style={{ margin: '10px 0 0', color: 'var(--good)' }}>{msg}</p>}
    </div>
  );
}
