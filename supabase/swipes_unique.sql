-- One vote per (room, player, item). Makes recordSwipe's retry idempotent and
-- stops a reload-and-reswipe from stacking duplicate rows. Existing duplicates
-- (fast double taps before the client guard existed) are collapsed first,
-- keeping the earliest row.
delete from swipes s
using swipes d
where s.room_id = d.room_id
  and s.user_token = d.user_token
  and s.item_id = d.item_id
  and (s.created_at > d.created_at or (s.created_at = d.created_at and s.id > d.id));

create unique index if not exists swipes_one_vote_per_item
  on swipes (room_id, user_token, item_id);
