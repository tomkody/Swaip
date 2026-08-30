-- Server-side cache for Google Places nearby searches (see api/places.js).
-- Written only with the service role; the anon key has no access.
create table if not exists places_cache (
  cache_key  text primary key,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
alter table places_cache enable row level security;
-- no policies: anon/authenticated can't touch it; service role bypasses RLS
