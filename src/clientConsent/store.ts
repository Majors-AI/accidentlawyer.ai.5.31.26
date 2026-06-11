// Client Consent — capture seam (STUB, in-memory only) for Stage 2.
//
// Mirrors the staff-training swap seam
// (src/lawFirmSettings/staffTraining/store.ts): KEEP these signatures, swap the
// bodies to await Supabase once Dom applies supabase/13_client_consent.sql.
//
// No persistence this pass. The client_consents table does NOT exist until
// migration 13 is applied manually by Dom, and the app does NOT query it yet.
//
// TODO(real: Supabase) — replace the in-memory push with:
//   await supabase.from('client_consents').insert(record)
// (append-only; firm-staff read + client-self insert/read RLS via 13). signer_ip
// must be captured server-side at that point (see types.ts) — never client-side.

import type { ConsentRecord } from './types';

// In-memory sink so the flow is observable in dev without a backend. Cleared on
// reload. NOT a source of truth — real rows live in client_consents post-13.
const recorded: ConsentRecord[] = [];

// Swap seam: today pushes to memory; tomorrow inserts into client_consents.
export async function recordConsent(record: ConsentRecord): Promise<void> {
  recorded.push(record);
}

// Capture the full A–F set as one signing action — one row per block, exactly
// as the append-only table expects (one row per signed agreement_version).
export async function recordConsentSet(records: ConsentRecord[]): Promise<void> {
  for (const r of records) await recordConsent(r);
}

// Dev/inspection helper (no backend equivalent needed).
export function getRecordedConsents(): ConsentRecord[] {
  return recorded;
}
