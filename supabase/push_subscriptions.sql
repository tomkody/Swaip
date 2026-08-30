-- Web Push subscriptions per (room, user) — see src/lib/push.js + api/notify.js.
-- No anon SELECT: a subscription's endpoint+keys would let anyone push to that
-- browser directly. The server reads them with the service role.
create table if not exists push_subscriptions (
  room_id      text not null,
  user_token   text not null,
  subscription jsonb not null,
  created_at   timestamptz not null default now(),
  primary key (room_id, user_token)
);
alter table push_subscriptions enable row level security;
create policy "anon can insert" on push_subscriptions for insert to anon, authenticated with check (true);
create policy "anon can update own upsert" on push_subscriptions for update to anon, authenticated using (true) with check (true);
