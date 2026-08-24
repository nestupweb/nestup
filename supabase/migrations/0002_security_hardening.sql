-- Supabase's default privileges grant EXECUTE on new public functions to anon
-- explicitly, which "revoke ... from public" in 0001 does not undo.
-- respond_to_interest must only be callable by signed-in users (it also checks
-- listing ownership internally via auth.uid()).
revoke execute on function public.respond_to_interest(uuid, public.lister_response) from anon;

-- Supabase's own rls_auto_enable helper needs no API exposure at all.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from anon, authenticated;
  end if;
end $$;
