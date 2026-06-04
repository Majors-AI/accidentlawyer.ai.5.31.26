import { supabase } from './supabase';

export interface InviteParams {
  email: string;
  full_name: string;
  role: 'attorney' | 'staff' | 'client';
  client_id?: string;
}

export async function inviteUser(params: InviteParams): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const redirectTo = window.location.origin + '/accept-invite';
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { ...params, redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? 'Invite failed' };
  return { ok: true, userId: data.userId };
}
