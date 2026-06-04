-- Phase 5: invite-based onboarding
-- Replaces handle_new_user so it also seeds firm_id from invite metadata.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role, firm_id)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.email),
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'client'),
          (new.raw_user_meta_data->>'firm_id')::uuid);
  return new;
end; $$;
