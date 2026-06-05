import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface Props {
  caseId: string;
  c: any;
  onClosed: () => void;
}

export default function CaseClosure({ caseId, c, onClosed }: Props) {
  const [liens, setLiens] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [disbursement, setDisbursement] = useState<any>(null);
  const [closing, setClosing] = useState(false);

  async function load() {
    const { data: ln } = await supabase.from('liens').select('*').eq('case_id', caseId);
    setLiens(ln ?? []);
    const { data: tx } = await supabase.from('treatments').select('*').eq('case_id', caseId);
    setTreatments(tx ?? []);
    const { data: db } = await supabase.from('disbursements').select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(1);
    setDisbursement(db?.[0] ?? null);
  }

  useEffect(() => { load(); }, [caseId]);

  const allLiensAck       = liens.length > 0 && liens.every(l => l.acknowledged);
  const allBillsRcvd      = treatments.length > 0 && treatments.every(t => t.bills_received);
  const disbApproved      = disbursement?.client_approved === true;
  const allLiensSatisfied = liens.length > 0 && liens.every(l => l.satisfied);
  const allZeroBalance    = treatments.length > 0 && treatments.every(t => t.zero_balance_confirmed);

  async function closeFile() {
    setClosing(true);
    // Agent drafts the closing letter and queues it for attorney release in the communications inbox.
    // Replace the default body below with the firm's reviewed closing-letter template when available.
    await supabase.from('communications').insert({
      case_id: caseId,
      channel: 'email',
      requires_approval: true,
      status: 'queued',
      drafted_by: 'agent',
      subject: 'Your case is closed -- ' + (c.clients?.full_name ?? 'client'),
      body: [
        'Dear ' + (c.clients?.full_name ?? 'client') + ',',
        '',
        'We are writing to confirm that your personal-injury matter arising from the incident on ' +
          (c.date_of_loss ?? 'the date of loss') +
          ' has been fully resolved and your file is now closed. All proceeds have been disbursed and all outstanding liens have been addressed.',
        '',
        'Thank you for trusting us to represent you. If you have any remaining questions, please do not hesitate to reach out.',
        '',
        'Sincerely,',
        'Your legal team',
      ].join('\n'),
    });
    await supabase.from('cases').update({ status: 'closed' }).eq('id', caseId);
    setClosing(false);
    onClosed();
  }

  if (c.status === 'closed') {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tag good">File closed</span>
          <span className="muted small">This case has been closed. The closing letter is queued in communications.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Close file</h3>
      <p className="muted small" style={{ marginTop: 0 }}>Pre-closure checklist -- informational only, not a hard block.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`tag tiny ${allLiensAck ? 'good' : 'warn'}`}>{allLiensAck ? 'check' : 'warn'}</span>
          <span className="small">
            All liens acknowledged
            {liens.length === 0 && <span className="muted"> (none recorded)</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`tag tiny ${allBillsRcvd ? 'good' : 'warn'}`}>{allBillsRcvd ? 'check' : 'warn'}</span>
          <span className="small">
            All treatment bills received
            {treatments.length === 0 && <span className="muted"> (none recorded)</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`tag tiny ${disbApproved ? 'good' : 'warn'}`}>{disbApproved ? 'check' : 'warn'}</span>
          <span className="small">
            Disbursement client-approved
            {!disbursement && <span className="muted"> (none recorded)</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`tag tiny ${allLiensSatisfied ? 'good' : 'warn'}`}>{allLiensSatisfied ? 'check' : 'warn'}</span>
          <span className="small">
            All liens satisfied
            {liens.length === 0 && <span className="muted"> (none recorded)</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`tag tiny ${allZeroBalance ? 'good' : 'warn'}`}>{allZeroBalance ? 'check' : 'warn'}</span>
          <span className="small">
            All provider balances zero-confirmed
            {treatments.length === 0 && <span className="muted"> (none recorded)</span>}
          </span>
        </div>
      </div>
      <button className="btn oxblood sm" onClick={closeFile} disabled={closing}>
        {closing ? 'Closing...' : 'Close file'}
      </button>
    </div>
  );
}
