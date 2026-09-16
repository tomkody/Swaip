-- Row-level security for Swaip — PART 1 of 2: the scaffolding.
--
-- This file changes NOTHING about who can read what. It only creates the pieces
-- the policies in rls.sql will use, so that clients can start registering their
-- membership BEFORE access is actually restricted. Run it, deploy the app, give
-- it a few minutes, then run rls.sql.
--
-- Doing it the other way round logs out everyone who is mid-room: nobody is a
-- member of a room created before membership existed.
--
-- Safe to run more than once.

-- ── Membership ───────────────────────────────────────────────────────────────

create table if not exists public.room_members (
  room_id   text not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_members_user_idx on public.room_members (user_id);

-- Who created a room: lets the creator read back the row they just inserted,
-- before any membership exists.
alter table public.rooms add column if not exists created_by uuid default auth.uid();

-- SECURITY DEFINER so that checking membership doesn't re-enter room_members'
-- own policies. STABLE so the planner can cache it within a statement.
create or replace function public.is_room_member(p_room_id text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(text) from public;
grant execute on function public.is_room_member(text) to anon, authenticated;


-- The table is created here, ahead of the rest of the policies, so lock it down
-- now rather than leave a window where anyone can read or forge memberships.
alter table public.room_members enable row level security;

drop policy if exists "see my own memberships" on public.room_members;
create policy "see my own memberships" on public.room_members
  for select to authenticated using (user_id = auth.uid());

-- Naming a room id is the whole credential — the same thing the invite link
-- hands out. The foreign key means the room has to actually exist.
drop policy if exists "join a room I have the id of" on public.room_members;
create policy "join a room I have the id of" on public.room_members
  for insert to authenticated with check (user_id = auth.uid());
