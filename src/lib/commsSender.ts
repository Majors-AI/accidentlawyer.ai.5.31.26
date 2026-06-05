// SEAM — real transmission (SendGrid email / Twilio SMS) swaps in here without
// changing ApprovalInbox call sites. Mirrors accidentDoctorBridge.ts. Inert
// until a firm connects a provider; real send must go through a server-side
// edge function so the provider secret never reaches the client.

export interface CommToSend { id: string; channel: string; subject: string; body: string; }
export interface FirmIntegration { provider: string; connected: boolean; config: any; }
export interface SendResult { transmitted: boolean; provider: string | null; detail: string; }

const PROVIDER_FOR_CHANNEL: Record<string, string> = { email: 'sendgrid', sms: 'twilio' };

export async function sendCommunication(
  comm: CommToSend, integrations: FirmIntegration[],
): Promise<SendResult> {
  const want = PROVIDER_FOR_CHANNEL[comm.channel];
  if (!want) return { transmitted: false, provider: null,
    detail: `Channel "${comm.channel}" has no transmission provider — recorded as approved, not transmitted.` };
  const integ = integrations.find(i => i.provider === want && i.connected);
  if (!integ) return { transmitted: false, provider: null,
    detail: `No ${want} integration connected — approved and recorded, not transmitted. Connect ${want} to enable sending.` };
  // ---- SEAM: when wired, invoke the server-side edge function that holds the
  // secret, e.g. await supabase.functions.invoke('send-communication', { body: { commId: comm.id } });
  // Until then, a connected provider is treated as not-yet-wired:
  return { transmitted: false, provider: want,
    detail: `${want} connected, but server-side transmission is not wired yet.` };
}
