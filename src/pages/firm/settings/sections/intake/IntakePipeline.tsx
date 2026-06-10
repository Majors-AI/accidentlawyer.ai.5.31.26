// Intake department specifics (PI). The shared Department framework renders
// separately via <DepartmentSection deptId="intake" />; this component adds the
// intake-specific workflow: the reference pipeline, a lead-lifecycle scaffold
// with the real GATES + STATUS TRANSITIONS, and the retention listing scaffold.
//
// Backend TODO seams (built as gates/transitions only, not transmission):
//   - e-sign send + signature webhook (the "Signature received" action fakes it)
//   - real leads from intake_leads/cases tables (these are in-memory samples)
//   - real File Cabinet entry, cross-portal listing, and notifications
import { useState } from 'react';
import { useAuth } from '../../../../../App';
import { CASE_TYPES } from '../../../../../lib/firmSettings';
import { derivePermissions } from '../../../../../lib/permissions';
import { logChange } from '../../../../../lib/auditLog';

const caseTypeLabel = (v: string) => CASE_TYPES.find(c => c.value === v)?.label ?? v;

// ---- the reference intake flow (Step A) ---------------------------------

export type IntakeStageId =
  | 'lead_scheduling' | 'conducting_intake' | 'case_evaluation'
  | 'presenting' | 'welcome' | 'completed';

export const INTAKE_STAGES: { id: IntakeStageId; label: string; captures: string }[] = [
  { id: 'lead_scheduling', label: 'Lead scheduling', captures: 'Book the initial consultation with the lead.' },
  { id: 'conducting_intake', label: 'Conducting intake', captures: 'Accident facts, injuries, parties, insurance/coverage, police report.' },
  { id: 'case_evaluation', label: 'Case evaluation / qualification', captures: 'Liability, damages, coverage.' },
  { id: 'presenting', label: 'Presenting / sign-up', captures: 'Present case acceptance; attorney-only legal-advice email.' },
  { id: 'welcome', label: 'Welcome call / text', captures: 'Required for every signed lead before the agreement link.' },
  { id: 'completed', label: 'Completed (transferred)', captures: 'Signed & transferred to Legal + Accounting.' },
];

const stageIndex = (id: IntakeStageId) => INTAKE_STAGES.findIndex(s => s.id === id);

// ---- lead lifecycle scaffold (Step B) -----------------------------------

interface IntakeLead {
  id: string;
  clientName: string;
  caseType: string;        // claim_type value
  state: string;
  stage: IntakeStageId;
  presented: boolean;
  legalAdviceEmailSent: boolean;
  welcomeComplete: boolean;
  agreementLinkSent: boolean;
  signatureReceived: boolean;
  transferDate: string | null;
}

// TODO(real leads): these come from the intake_leads / cases tables in
// production. In-memory samples positioned to showcase the gates.
const SEED_LEADS: IntakeLead[] = [
  {
    id: 'lead-1', clientName: 'Robert Chen', caseType: 'mva', state: 'AZ', stage: 'presenting',
    presented: false, legalAdviceEmailSent: false, welcomeComplete: false,
    agreementLinkSent: false, signatureReceived: false, transferDate: null,
  },
  {
    id: 'lead-2', clientName: 'Maria Lopez', caseType: 'slip_and_fall', state: 'AZ', stage: 'welcome',
    presented: true, legalAdviceEmailSent: true, welcomeComplete: false,
    agreementLinkSent: false, signatureReceived: false, transferDate: null,
  },
];

function Stepper({ stage }: { stage: IntakeStageId }) {
  const idx = stageIndex(stage);
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {INTAKE_STAGES.map((s, i) => (
        <span key={s.id} className={i === idx ? 'tag gold' : i < idx ? 'tag good' : 'tag soft'}>
          {i + 1}. {s.label}
        </span>
      ))}
    </div>
  );
}

export default function IntakePipeline() {
  const { profile } = useAuth();
  const perms = derivePermissions(profile);
  const isLawyer = perms.isLawyer;
  const isHandler = perms.canManageDepartment('intake');   // supervisor/owner/super-admin
  const actor = profile?.full_name || profile?.id || 'unknown';

  const [leads, setLeads] = useState<IntakeLead[]>(SEED_LEADS);

  // Audited transition: logs who/what/when (logChange stamps the timestamp).
  const act = (lead: IntakeLead, patch: Partial<IntakeLead>, action: string) => {
    const before = Object.fromEntries(Object.keys(patch).map(k => [k, (lead as unknown as Record<string, unknown>)[k]]));
    logChange({ actor, action, target: `intakeLead:${lead.id}`, before, after: patch });
    setLeads(ls => ls.map(l => (l.id === lead.id ? { ...l, ...patch } : l)));
  };

  const advance = (lead: IntakeLead, to: IntakeStageId) =>
    act(lead, { stage: to }, `advance-stage:${to}`);

  // Today's date for the transfer stamp (data-URL/webhook simulation only).
  const today = new Date().toISOString().slice(0, 10);

  const completed = leads.filter(l => l.stage === 'completed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      {/* Step A — pipeline overview (reference flow) */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Intake pipeline</h3>
        <p className="tiny muted" style={{ marginTop: 0 }}>The reference intake task flow for personal-injury matters.</p>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {INTAKE_STAGES.map(s => (
            <li key={s.id} style={{ marginBottom: 8 }}>
              <b style={{ fontSize: 14 }}>{s.label}</b>
              <div className="tiny muted">{s.captures}</div>
            </li>
          ))}
        </ol>
      </div>

      {/* Step B — lead lifecycle scaffold */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Leads</h3>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          {/* TODO(real leads): sourced from intake_leads / cases in production. */}
          In-memory sample leads — demonstrates the real gates &amp; transitions.
        </p>

        {leads.map(lead => {
          const idx = stageIndex(lead.stage);
          return (
            <div key={lead.id} className="well" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <b style={{ fontSize: 15 }}>{lead.clientName}</b>{' '}
                  <span className="muted small">· {caseTypeLabel(lead.caseType)} · {lead.state}</span>
                </div>
                <span className={lead.stage === 'completed' ? 'tag good' : 'tag gold'}>
                  {INTAKE_STAGES[idx].label}
                </span>
              </div>
              <Stepper stage={lead.stage} />

              {/* Early stages — walk the lead toward presenting (handler-gated) */}
              {idx < stageIndex('presenting') && (
                <div style={{ marginTop: 10 }}>
                  <button className="btn sm" style={{ width: 'auto' }} disabled={!isHandler}
                    onClick={() => advance(lead, INTAKE_STAGES[idx + 1].id)}>
                    Advance to {INTAKE_STAGES[idx + 1].label}
                  </button>
                  {!isHandler && <span className="tiny muted" style={{ marginLeft: 8 }}>handler / supervisor only</span>}
                </div>
              )}

              {/* Presenting / sign-up */}
              {lead.stage === 'presenting' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  {/* ANY firm user may present case acceptance */}
                  <button className="btn sm" style={{ width: 'auto' }} disabled={lead.presented}
                    onClick={() => act(lead, { presented: true }, 'present-case-acceptance')}>
                    {lead.presented ? '✓ Case acceptance presented' : 'Present case acceptance'}
                  </button>

                  {/* ATTORNEY-ONLY: case-specific legal-advice email */}
                  <button className="btn ghost sm" style={{ width: 'auto' }}
                    disabled={!isLawyer || lead.legalAdviceEmailSent}
                    onClick={() => act(lead, { legalAdviceEmailSent: true }, 'send-legal-advice-email')}>
                    {lead.legalAdviceEmailSent ? '✓ Legal-advice email sent' : 'Send case-specific legal-advice email'}
                  </button>
                  {!isLawyer && <span className="tiny muted">attorney only</span>}

                  {lead.presented && (
                    <button className="btn sm" style={{ width: 'auto' }} disabled={!isHandler}
                      onClick={() => advance(lead, 'welcome')}>
                      Advance to Welcome call / text
                    </button>
                  )}
                </div>
              )}

              {/* Welcome call / text + agreement link gate */}
              {lead.stage === 'welcome' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  {/* attorney OR the handler may complete the welcome step */}
                  <button className="btn sm" style={{ width: 'auto' }}
                    disabled={lead.welcomeComplete || !(isLawyer || isHandler)}
                    onClick={() => act(lead, { welcomeComplete: true }, 'welcome-complete')}>
                    {lead.welcomeComplete ? '✓ Welcome call/text complete' : 'Mark welcome call/text complete'}
                  </button>

                  {/* LOCKED until welcome complete */}
                  <button className="btn ghost sm" style={{ width: 'auto' }}
                    disabled={!lead.welcomeComplete || lead.agreementLinkSent}
                    onClick={() => act(lead, { agreementLinkSent: true }, 'send-agreement-link')}>
                    {lead.agreementLinkSent ? '✓ Agreement link sent' : 'Send representation / contingency-fee agreement link'}
                  </button>
                  {!lead.welcomeComplete && <span className="tiny muted">locked until welcome call/text is complete</span>}

                  {/* Retention pipeline — simulates the e-sign webhook */}
                  {lead.agreementLinkSent && (
                    <button className="btn sm" style={{ width: 'auto' }}
                      onClick={() => act(lead, { signatureReceived: true, stage: 'completed', transferDate: today }, 'signature-received')}>
                      Signature received (e-sign webhook — TODO)
                    </button>
                  )}
                </div>
              )}

              {/* Completed */}
              {lead.stage === 'completed' && (
                <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  Signed &amp; transferred {lead.transferDate}. Now listed in the Legal and Accounting portals below.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Step B — retention result: cross-portal listing scaffold */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>Retention result</h3>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          {/* TODO(real File Cabinet + cross-portal listing + notifications): on a
              real signature, the client gets a File Cabinet entry, appears in the
              Legal and Accounting portals, and triggers notifications. */}
          Scaffold — on signature a client appears in both portals. Real File Cabinet entry,
          cross-portal listing, and notifications are backend TODO seams.
        </p>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          {(['Legal portal', 'Accounting portal'] as const).map(portal => (
            <div key={portal} style={{ flex: 1 }}>
              <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{portal}</div>
              {completed.length === 0 && <p className="muted small">No transferred clients yet.</p>}
              {completed.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
                  <span>{l.clientName}</span>
                  <span className="muted small">{caseTypeLabel(l.caseType)} · transferred {l.transferDate}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
