-- Street + building number shown on the listing detail page ("Ahuza 23").
alter table public.listings
  add column address text not null default '' check (char_length(address) <= 120);
