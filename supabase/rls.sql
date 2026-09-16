-- Row-level security for Swaip — PART 2 of 2: the policies.
--
-- THE PROBLEM THIS SOLVES
-- Every table is currently `using (true)`. The anon key is shipped inside the
-- JavaScript bundle, so it is public by definition — and with it anyone can run
--   GET /rest/v1/rooms?select=*
-- and page through every room in the database (including the coarse lat/lng
-- stored in topic_id for food and activity rooms), every swipe, every ranking
-- and everyone's saved-match history. Measured on 2026-09-16: 668 rooms,
-- 3408 swipes, 137 saved matches, all readable by anybody.
--
-- THE MODEL
-- A room id is the capability: whoever has the invite link may take part. So
-- each browser signs in anonymously (its own JWT) and claims membership of a
-- room by naming its id. Everything else — reading the room, its swipes, its
-- rankings — requires that membership. You can still join any room you have the
-- link to; you can no longer list the ones you don't.
--
-- RUN THIS LAST. In order:
--   1. Supabase dashboard → Authentication → Sign In / Providers →
--      enable "Anonymous sign-ins".
--   2. Run supabase/rls_prepare.sql.
--   3. Deploy the app build that signs in anonymously and registers membership
--      (src/lib/supabase.js ensureSession, src/lib/room.js ensureRoomMembership).
--   4. Wait a few minutes, then run this file.
--
-- Safe to run more than once.

-- ── Clear the permissive policies ────────────────────────────────────────────
-- By name, because most of these were created in the dashboard and their names
-- aren't recorded anywhere in the repo.

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('rooms', 'room_members', 'swipes', 'rankings',
                        'conversation_selections', 'saved_matches', 'push_subscriptions')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.rooms                   enable row level security;
alter table public.room_members            enable row level security;
alter table public.swipes                  enable row level security;
alter table public.rankings                enable row level security;
alter table public.conversation_selections enable row level security;
alter table public.saved_matches           enable row level security;
alter table public.push_subscriptions      enable row level security;

-- ── Membership: you may only speak for yourself ──────────────────────────────

create policy "see my own memberships" on public.room_members
  for select to authenticated using (user_id = auth.uid());

-- Naming a room id is the whole credential — the same thing the invite link
-- hands out. The foreign key means the room has to actually exist.
create policy "join a room I have the id of" on public.room_members
  for insert to authenticated with check (user_id = auth.uid());

-- ── Rooms ────────────────────────────────────────────────────────────────────

create policy "read rooms I'm in" on public.rooms
  for select to authenticated
  using (created_by = auth.uid() or public.is_room_member(id));

create policy "create my own rooms" on public.rooms
  for insert to authenticated with check (created_by = auth.uid());

-- Phase transitions (categories → places) and status = 'active' are written by
-- whichever player gets there first, so any member may update.
create policy "members update the room" on public.rooms
  for update to authenticated
  using (created_by = auth.uid() or public.is_room_member(id))
  with check (created_by = auth.uid() or public.is_room_member(id));

-- ── Swipes ───────────────────────────────────────────────────────────────────
-- Still append-only: no update, no delete. Undo works by inserting a newer row
-- and the newest row per player+item wins (see currentVotes in src/lib/room.js).

create policy "read swipes in my rooms" on public.swipes
  for select to authenticated using (public.is_room_member(room_id));

create policy "swipe in my rooms" on public.swipes
  for insert to authenticated with check (public.is_room_member(room_id));

-- ── Rankings ─────────────────────────────────────────────────────────────────
-- Delete is needed: locking in a new top 3 clears the previous one.

create policy "read rankings in my rooms" on public.rankings
  for select to authenticated using (public.is_room_member(room_id));

create policy "rank in my rooms" on public.rankings
  for insert to authenticated with check (public.is_room_member(room_id));

create policy "replace rankings in my rooms" on public.rankings
  for delete to authenticated using (public.is_room_member(room_id));

-- ── Conversation selections ──────────────────────────────────────────────────

create policy "read selections in my rooms" on public.conversation_selections
  for select to authenticated using (public.is_room_member(room_id));

create policy "submit selections in my rooms" on public.conversation_selections
  for insert to authenticated with check (public.is_room_member(room_id));

-- ── Saved matches ────────────────────────────────────────────────────────────
-- Personal history. device_key is client-supplied and proves nothing, so the
-- row is owned by the signed-in user instead. Rows written before this change
-- have a null user_id and become invisible — localStorage is the source of
-- truth for this feature, so nobody loses their list, only the remote copy.

alter table public.saved_matches add column if not exists user_id uuid default auth.uid();
create index if not exists saved_matches_user_idx on public.saved_matches (user_id);

create policy "read my saved matches" on public.saved_matches
  for select to authenticated using (user_id = auth.uid());

create policy "save my matches" on public.saved_matches
  for insert to authenticated with check (user_id = auth.uid());

create policy "update my saved matches" on public.saved_matches
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete my saved matches" on public.saved_matches
  for delete to authenticated using (user_id = auth.uid());

-- ── Push subscriptions ───────────────────────────────────────────────────────
-- Anyone could previously register a subscription against any room id and
-- receive that room's notifications. The fan-out itself runs with the service
-- role (api/notify.js), which bypasses RLS, so it is unaffected.

create policy "read push subs in my rooms" on public.push_subscriptions
  for select to authenticated using (public.is_room_member(room_id));

create policy "subscribe in my rooms" on public.push_subscriptions
  for insert to authenticated with check (public.is_room_member(room_id));

create policy "update my push sub" on public.push_subscriptions
  for update to authenticated
  using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));

create policy "unsubscribe in my rooms" on public.push_subscriptions
  for delete to authenticated using (public.is_room_member(room_id));

-- ── Catalogs stay public ─────────────────────────────────────────────────────
-- The deck has to load before anyone signs in, and it's public data anyway.
-- (movie_catalog.sql / series_catalog.sql already grant this; repeated here so
-- this file is a complete description of who can read what.)

drop policy if exists "movie_catalog readable by anyone" on public.movie_catalog;
create policy "movie_catalog readable by anyone" on public.movie_catalog
  for select to anon, authenticated using (true);

drop policy if exists "series_catalog readable by anyone" on public.series_catalog;
create policy "series_catalog readable by anyone" on public.series_catalog
  for select to anon, authenticated using (true);

-- places_cache deliberately has no policy at all: only api/places.js touches it,
-- with the service-role key.


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK — if something breaks, paste this into the SQL editor to put the
-- old behaviour back immediately. It reopens the database to anyone holding
-- the anon key, so treat it as a stopgap while the cause is found.
--
-- do $$
-- declare p record;
-- begin
--   for p in
--     select policyname, tablename from pg_policies
--     where schemaname = 'public'
--       and tablename in ('rooms','swipes','rankings','conversation_selections',
--                         'saved_matches','push_subscriptions')
--   loop
--     execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
--   end loop;
-- end $$;
--
-- create policy "open" on public.rooms                   for all to anon, authenticated using (true) with check (true);
-- create policy "open" on public.swipes                  for all to anon, authenticated using (true) with check (true);
-- create policy "open" on public.rankings                for all to anon, authenticated using (true) with check (true);
-- create policy "open" on public.conversation_selections for all to anon, authenticated using (true) with check (true);
-- create policy "open" on public.saved_matches           for all to anon, authenticated using (true) with check (true);
-- create policy "open" on public.push_subscriptions      for all to anon, authenticated using (true) with check (true);
-- ═══════════════════════════════════════════════════════════════════════════
