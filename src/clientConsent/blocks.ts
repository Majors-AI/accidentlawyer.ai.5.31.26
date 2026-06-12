// Client Consent — A–F PLACEHOLDER blocks (Stage 2, structure pass).
//
// These are versioned SLOTS, not legal text. Each body mirrors the
// src/lib/letters.ts DEFAULT_BODIES shape:
//   [DRAFT — ATTORNEY REVIEW REQUIRED…] banner
//   + a [VERBATIM — DOM] note marking exactly what Dom drops in
//   + a structural skeleton with {{merge_tokens}}
//
// HARD RULE: no operative consent/HIPAA/authorization wording is written here.
// Every block defers the real language to Dom via [VERBATIM — DOM]. The fee % ,
// SOL, and lien/subrogation values are Decision #2 (LFS) drop-ins — block B
// references the fee STRUCTURALLY ({{contingency_fee_terms}}) and hardcodes no %.
//
// agreement_version is a placeholder ('PLACEHOLDER-vX'); Dom assigns the real
// per-jurisdiction version at verbatim-swap time.

import type { ConsentBlock } from './types';

// Single placeholder version string for the structure pass. Dom replaces per
// jurisdiction (e.g. 'AZ-2026.1') when the verbatim text lands.
const PLACEHOLDER_VERSION = 'PLACEHOLDER-vX';

// Ordered A → F. A is highest priority (gates the rest conceptually).
export const CONSENT_BLOCKS: ConsentBlock[] = [
  {
    slot: 'A',
    kind: 'no_attorney_client_relationship',
    label: 'No attorney–client relationship (pre-engagement)',
    version: PLACEHOLDER_VERSION,
    body: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]
[VERBATIM — DOM: replace this entire skeleton with the firm's reviewed
"no attorney–client relationship yet" guardrail. No operative wording is
provided here on purpose.]

Re: Acknowledgement — No Attorney–Client Relationship (Pre-Engagement)
Prospective client: {{client_name}}
Firm: {{firm_name}}
Date of loss: {{date_of_loss}}
Jurisdiction: {{jurisdiction}}

[VERBATIM — DOM: statement that submitting information does not by itself create
an attorney–client relationship, and that none exists until the firm formally
accepts the matter.]

[Acknowledged by {{signer_name}} on {{signed_date}}.]`,
  },
  {
    slot: 'B',
    kind: 'contingency_fee_disclosure',
    label: 'Contingency-fee disclosure acknowledgement',
    version: PLACEHOLDER_VERSION,
    body: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]
[VERBATIM — DOM: replace with the firm's reviewed contingency-fee disclosure.]

Re: Acknowledgement — Contingency-Fee Disclosure
Client: {{client_name}}
Firm: {{firm_name}}

[VERBATIM — DOM: disclosure that the firm's fee is a contingency fee (a share of
any recovery). DO NOT state a percentage here — the fee %, costs treatment, and
lien/subrogation handling are Decision #2 / LFS reference values, injected via
the token below, never hardcoded in this block.]

Fee structure: {{contingency_fee_terms}}   [LFS / Decision #2 drop-in]

[Acknowledged by {{signer_name}} on {{signed_date}}.]`,
  },
  {
    slot: 'C',
    kind: 'hipaa_authorization',
    label: 'HIPAA authorization',
    version: PLACEHOLDER_VERSION,
    body: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]
[VERBATIM — DOM: replace with the firm's reviewed, HIPAA-compliant authorization.]

Re: HIPAA Authorization
Patient / client: {{client_name}}
Firm: {{firm_name}}
Date of loss: {{date_of_loss}}

[VERBATIM — DOM: HIPAA authorization for use/disclosure of protected health
information — covered providers, scope of records, purpose, and expiration all
go here. No operative wording placed in the skeleton.]

[Acknowledged by {{signer_name}} on {{signed_date}}.]`,
  },
  {
    slot: 'D',
    kind: 'records_insurer_authorization',
    label: 'Records & insurer authorization',
    version: PLACEHOLDER_VERSION,
    body: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]
[VERBATIM — DOM: replace with the firm's reviewed records/insurer authorization.]

Re: Authorization — Records & Insurer Communications
Client: {{client_name}}
Firm: {{firm_name}}

[VERBATIM — DOM: authorization permitting the firm to request records and to
communicate with insurers and providers on the client's behalf. Scope and
named parties go here.]

[Acknowledged by {{signer_name}} on {{signed_date}}.]`,
  },
  {
    slot: 'E',
    kind: 'electronic_comms_esign',
    label: 'Electronic communications & e-signature consent',
    version: PLACEHOLDER_VERSION,
    body: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]
[VERBATIM — DOM: replace with the firm's reviewed e-comms / e-signature consent.]

Re: Electronic Communications & Electronic Signature Consent
Client: {{client_name}}
Firm: {{firm_name}}

[VERBATIM — DOM: consent to electronic communications and to the use of
electronic signatures (E-SIGN / UETA-style), including how to withdraw consent.]

[Acknowledged by {{signer_name}} on {{signed_date}}.]`,
  },
  {
    slot: 'F',
    kind: 'privacy_notice',
    label: 'Privacy notice',
    version: PLACEHOLDER_VERSION,
    body: `[DRAFT — ATTORNEY REVIEW REQUIRED BEFORE RELEASE]
[VERBATIM — DOM: replace with the firm's reviewed privacy notice.]

Re: Privacy Notice
Client: {{client_name}}
Firm: {{firm_name}}

[VERBATIM — DOM: privacy notice describing the firm as data controller and the
platform as data processor. DO NOT include FCRA / consumer-report / credit-pull
disclosures here — out of scope for this block.]

[Acknowledged by {{signer_name}} on {{signed_date}}.]`,
  },
];
