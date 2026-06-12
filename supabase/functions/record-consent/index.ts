import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// record-consent — server-side, append-only persistence of a client's A–F
// consent acknowledgements. Mirrors invite-user: verify_jwt true, a server-side
// admin (service_role) client, header-based auth. The service_role key stays in
// the Supabase env and is NEVER exposed to the browser.
//
// The browser sends ONLY: who signed (name/optional title), which blocks, and
// the exact text it displayed. EVERYTHING legally load-bearing is stamped here
// from the request context — signed_at, signer_ip, user_agent, consent_hash —
// and the signer's identity (client_id/firm_id) is resolved from the session,
// never trusted from the body. Any client-supplied timestamp/IP/id is ignored.
//
// ⚠️  NOT DEPLOYED YET. Deploy is deliberate/held (like invite-user). Requires
//     supabase/14_client_consent.sql applied first (the client_consents table).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// sha256(text) → lowercase hex, via Web Crypto (available in the Deno runtime).
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface ConsentBlockInput {
  agreement_kind?: string;
  agreement_version?: string;
  rendered_text?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Auth check: verify the caller's session → auth.uid().
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
    const jwt = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: 'Invalid or expired token' }, 401);

    // Resolve the signing client from the session — NEVER from the body.
    const { data: client, error: clientErr } = await admin
      .from('clients')
      .select('id, firm_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (clientErr) return json({ error: clientErr.message }, 500);
    if (!client) return json({ error: 'No client record for this account' }, 403);

    // Parse the body. Only signer_name, optional signer_title, and the blocks
    // (kind/version/rendered_text) are read; anything else is ignored.
    const body = await req.json();
    const { signer_name, signer_title, blocks } = body as {
      signer_name?: string;
      signer_title?: string;
      blocks?: ConsentBlockInput[];
    };

    const name = (signer_name ?? '').trim();
    if (!name) return json({ error: 'signer_name is required' }, 400);
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return json({ error: 'blocks must be a non-empty array' }, 400);
    }
    for (const b of blocks) {
      if (!b?.agreement_kind || !b?.agreement_version || !b?.rendered_text) {
        return json({ error: 'each block needs agreement_kind, agreement_version, rendered_text' }, 400);
      }
    }

    // Server-resolve jurisdiction from the client's most recent case (not trusted
    // from the body). Best-effort: null if none.
    const { data: latestCase } = await admin
      .from('cases')
      .select('jurisdiction')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ---- Server-stamped, request-derived facts (the whole point) ------------
    const signed_at = new Date().toISOString();
    const signer_ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const user_agent = req.headers.get('user-agent') ?? null;
    const signer_title_clean = (signer_title ?? '').trim() || null;
    const jurisdiction = latestCase?.jurisdiction ?? null;

    // One append-only row per block. consent_text is the exact wording shown;
    // consent_hash is its sha256, computed here.
    const rows = await Promise.all(
      blocks.map(async (b) => ({
        client_id: client.id,
        firm_id: client.firm_id,
        agreement_kind: b.agreement_kind,
        agreement_version: b.agreement_version,
        signer_name: name,
        signer_title: signer_title_clean,
        signed_at,
        signer_ip,
        user_agent,
        consent_text: b.rendered_text,
        consent_hash: await sha256Hex(b.rendered_text as string),
        jurisdiction,
      })),
    );

    const { error: insertErr } = await admin.from('client_consents').insert(rows);
    if (insertErr) return json({ error: insertErr.message }, 400);

    return json({ ok: true, count: rows.length, signed_at });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ error: message }, 500);
  }
});
