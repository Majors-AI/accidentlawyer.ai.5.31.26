// Client Consent — shared types (Stage 2, structure pass).
//
// A ConsentBlock is a PLACEHOLDER slot (see blocks.ts) — no operative legal
// wording lives in the app. A ConsentRecord is one captured acknowledgement and
// mirrors the client_consents row shape in supabase/13_client_consent.sql
// (NOT applied yet; the app does not query it this pass).

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

// One captured consent acknowledgement. Column-for-column with the
// client_consents table in 13_client_consent.sql.
export interface ConsentRecord {
  client_id: string;
  firm_id: string | null;
  agreement_kind: ConsentKind;
  agreement_version: string;
  signer_name: string;
  signer_title: string | null;
  signed_at: string;          // ISO 8601
  // signer_ip CANNOT be reliably self-reported from the browser. Left null here;
  // real capture is a server-side TODO (edge function / DB default from request).
  signer_ip: string | null;
  jurisdiction: string | null;
}
