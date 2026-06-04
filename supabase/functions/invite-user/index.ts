import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Auth check: verify caller is a firm user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
    const jwt = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: 'Invalid or expired token' }, 401);

    const { data: callerProfile, error: profileErr } = await admin
      .from('profiles')
      .select('id, role, firm_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !callerProfile) return json({ error: 'Caller profile not found' }, 403);
    if (!['attorney', 'staff', 'admin'].includes(callerProfile.role) || !callerProfile.firm_id) {
      return json({ error: 'Not authorized to send invites' }, 403);
    }

    const callerFirmId = callerProfile.firm_id as string;

    // Parse and validate body
    const body = await req.json();
    const { email, full_name, role, client_id, redirectTo } = body as {
      email?: string;
      full_name?: string;
      role?: string;
      client_id?: string;
      redirectTo?: string;
    };

    if (!email || !full_name) {
      return json({ error: 'email and full_name are required' }, 400);
    }
    if (!['attorney', 'staff', 'client'].includes(role ?? '')) {
      return json({ error: 'role must be attorney, staff, or client' }, 400);
    }

    // Send the invite — firm_id from caller's profile (body's firm_id is ignored)
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role, firm_id: callerFirmId },
      redirectTo,
    });
    if (inviteErr || !inviteData?.user) {
      return json({ error: inviteErr?.message ?? 'Invite failed' }, 400);
    }

    const newUserId = inviteData.user.id;

    // If inviting a client and a client_id is provided, link the portal account
    if (role === 'client' && client_id) {
      // Scope check: confirm a case exists for this client_id under the caller's firm
      const { data: caseRow, error: caseErr } = await admin
        .from('cases')
        .select('id')
        .eq('client_id', client_id)
        .eq('firm_id', callerFirmId)
        .limit(1)
        .maybeSingle();

      if (caseErr || !caseRow) {
        return json({ error: 'Client does not belong to your firm' }, 403);
      }

      await admin.from('clients').update({ profile_id: newUserId }).eq('id', client_id);
    }

    return json({ ok: true, userId: newUserId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ error: message }, 500);
  }
});
