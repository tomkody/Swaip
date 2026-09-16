-- Swipes are append-only and the NEWEST row per player+item wins (that's what
-- makes undo work — see currentVotes in src/lib/room.js). The winner is decided
-- by created_at, which the public anon key can set to anything on insert.
--
-- So today a client can write created_at = '2999-01-01' and pin its vote
-- permanently: every later vote by that player, and every take-back, is ignored
-- because it looks older. Let the database stamp the time instead.
--
-- Safe to run more than once. No application change is needed — the client
-- never sends created_at, it just stops being able to.

create or replace function public.swipes_stamp_created_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists swipes_stamp_created_at on public.swipes;

create trigger swipes_stamp_created_at
  before insert or update on public.swipes
  for each row
  execute function public.swipes_stamp_created_at();
