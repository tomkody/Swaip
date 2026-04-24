-- Swaip database schema for Supabase
-- Run this in the Supabase SQL Editor

-- Rooms table
create table if not exists rooms (
  id text primary key,
  type text not null default 'movies',
  topic_id text,
  topic_name text,
  status text not null default 'waiting',
  phase text,
  matched_category text,
  places text,
  created_at timestamp with time zone default now()
);

-- Swipes table (movies, series, activities)
create table if not exists swipes (
  id uuid default gen_random_uuid() primary key,
  room_id text references rooms(id) on delete cascade,
  user_token text not null,
  item_id integer not null,
  direction text not null check (direction in ('left', 'right')),
  created_at timestamp with time zone default now()
);

-- Conversation selections table (for conversation rooms)
create table if not exists conversation_selections (
  id uuid default gen_random_uuid() primary key,
  room_id text references rooms(id) on delete cascade,
  user_token text not null,
  subtopic_id text not null,
  created_at timestamp with time zone default now(),
  unique(room_id, user_token, subtopic_id)
);

-- Rankings table (for top-3 picks after swiping)
create table if not exists rankings (
  id uuid default gen_random_uuid() primary key,
  room_id text references rooms(id) on delete cascade,
  user_token text not null,
  item_id integer not null,
  rank integer not null,
  created_at timestamp with time zone default now()
);

-- ── Migrations (run if tables already exist) ─────────────────────────────────
-- Activities phase columns on rooms table:
alter table rooms add column if not exists phase text;
alter table rooms add column if not exists matched_category text;
alter table rooms add column if not exists places text;

-- Indexes
create index if not exists idx_swipes_room_item on swipes(room_id, item_id, direction);
create index if not exists idx_swipes_room_user on swipes(room_id, user_token);
create index if not exists idx_conv_sel_room on conversation_selections(room_id);
create index if not exists idx_rankings_room on rankings(room_id);

-- Enable realtime (rooms table needed for activities phase transition)
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table swipes;
alter publication supabase_realtime add table conversation_selections;
alter publication supabase_realtime add table rankings;

-- Row-level security (permissive for MVP - no auth)
alter table rooms enable row level security;
alter table swipes enable row level security;
alter table conversation_selections enable row level security;
alter table rankings enable row level security;

create policy "Anyone can create rooms" on rooms for insert with check (true);
create policy "Anyone can read rooms" on rooms for select using (true);
create policy "Anyone can update rooms" on rooms for update using (true);

create policy "Anyone can create swipes" on swipes for insert with check (true);
create policy "Anyone can read swipes" on swipes for select using (true);

create policy "Anyone can create conversation_selections" on conversation_selections for insert with check (true);
create policy "Anyone can read conversation_selections" on conversation_selections for select using (true);

create policy "Anyone can create rankings" on rankings for insert with check (true);
create policy "Anyone can read rankings" on rankings for select using (true);
create policy "Anyone can delete rankings" on rankings for delete using (true);
