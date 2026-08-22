-- Top-3 rankings, so each player can see what the other ranked highest.
-- This table was in the original schema but is missing from the live database,
-- which made submitRankings/getRankings fail silently (404s).
create table if not exists rankings (
  id          uuid default gen_random_uuid() primary key,
  room_id     text references rooms(id) on delete cascade,
  user_token  text not null,
  item_id     integer not null,
  rank        integer not null,
  created_at  timestamp with time zone default now()
);

alter table rankings enable row level security;

drop policy if exists "Anyone can create rankings" on rankings;
create policy "Anyone can create rankings" on rankings for insert with check (true);

drop policy if exists "Anyone can read rankings" on rankings;
create policy "Anyone can read rankings" on rankings for select using (true);

drop policy if exists "Anyone can delete rankings" on rankings;
create policy "Anyone can delete rankings" on rankings for delete using (true);

create index if not exists rankings_room_idx on rankings (room_id);

-- Enable realtime so both players get the partner's Top 3 the instant it's
-- locked in (without this, only the second submitter sees it immediately and
-- the first has to wait for the fallback poll).
do $$ begin
  alter publication supabase_realtime add table rankings;
exception
  when duplicate_object then null;
end $$;
