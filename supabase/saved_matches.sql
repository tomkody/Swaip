-- Cross-session saved-match history (see src/lib/savedMatches.js).
-- Keyed by a per-device uuid stored in localStorage; the device id is the
-- capability (same trust model as room ids).
create table if not exists saved_matches (
  device_key   text not null,
  category     text not null,
  item_id      text not null,
  title        text not null,
  image        text,
  year         text,
  rating       text,
  date_matched timestamptz not null default now(),
  primary key (device_key, category, item_id)
);
alter table saved_matches enable row level security;
create policy "anon can read"   on saved_matches for select to anon, authenticated using (true);
create policy "anon can insert" on saved_matches for insert to anon, authenticated with check (true);
create policy "anon can delete" on saved_matches for delete to anon, authenticated using (true);
