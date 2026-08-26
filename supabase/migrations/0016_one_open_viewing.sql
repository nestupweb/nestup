-- ===== one open viewing per chat =====
-- A conversation may hold at most one viewing that is still open (proposed or
-- confirmed and not yet ended). The composer hides the calendar button and
-- proposeViewingAction refuses with a message, but the trigger is the real
-- guard: two tabs, a retried request, or a stale client cannot slip a second
-- one in. To pick a new time, cancel the current viewing first.
-- Applied live on 2026-08-25 (version 20260825144903).
create or replace function public.viewings_one_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.viewings v
    where v.conversation_id = new.conversation_id
      and v.status in ('proposed', 'confirmed')
      and v.ends_at > now()
  ) then
    raise exception 'A viewing is already scheduled in this chat.';
  end if;
  return new;
end;
$$;

drop trigger if exists viewings_one_open on public.viewings;
create trigger viewings_one_open
  before insert on public.viewings
  for each row execute function public.viewings_one_open();
