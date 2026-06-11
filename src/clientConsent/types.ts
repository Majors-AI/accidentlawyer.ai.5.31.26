// Client Consent — shared types (Stage 2).
//
// A ConsentBlock is a PLACEHOLDER slot (see blocks.ts) — no operative legal
// wording lives in the app. The captured-row shape lives server-side in the
// record-consent edge function (supabase/functions/record-consent) and the
// client_consents table (supabase/13_client_consent.sql); the browser only
// sends {agreement_kind, agreement_version, rendered_text} per block.

// Stable machine keys for each A–F slot. These become client_consents.agreement_kind.
export type ConsentKind =
  | 'no_attorney_client_relationship' // A
  | 'contingency_fee_disclosure'      // B
  | 'hipaa_authorization'             // C
  | 'records_insurer_authorization'  // D
  | 'electronic_comms_esign'         // E
  | 'privacy_notice';                // F

export interface ConsentBlock {
  slot: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  kind: ConsentKind;
  // Short, non-legal UI label only. The operative text is Dom's [VERBATIM] drop-in.
  label: string;
  // Placeholder agreement_version. Dom swaps this per jurisdiction at verbatim time.
  version: string;
  // DRAFT-banner skeleton — placeholder ONLY. Never real consent/HIPAA wording.
  body: string;
}
