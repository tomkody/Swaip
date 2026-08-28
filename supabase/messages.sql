-- Swaip post-match chat.
-- Run once in the Supabase dashboard → SQL Editor. Safe to re-run (idempotent).
-- Until this table exists, the chat UI hides itself, so nothing breaks.

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    text not null,
  user_token text not null,
  name       text,
  body       text not null check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at);

alter table public.messages enable row level security;

-- Same public-anon model as the rest of Swaip: the (unguessable) room id is the
-- capability. Anyone in a room can read and post; nobody can update/delete.
drop policy if exists "messages_read"   on public.messages;
drop policy if exists "messages_insert" on public.messages;
create policy "messages_read"   on public.messages for select using (true);
create policy "messages_insert" on public.messages for insert with check (true);

-- Live updates for subscribeToMessages(). Ignored if already added.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
