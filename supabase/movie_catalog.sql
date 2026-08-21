-- Movie catalog cache, refreshed nightly from TMDB by /api/refresh-movies.
-- One row per (movie, region) so "where to watch" is region-accurate.
create table if not exists movie_catalog (
  tmdb_id     integer     not null,
  region      text        not null,
  title       text        not null,
  year        text,
  rating      numeric,
  runtime     text,
  genres      text[]      default '{}',
  poster_url  text,
  overview    text,
  platforms   text[]      default '{}',   -- our platform ids: netflix, disney, max, prime, apple, paramount
  updated_at  timestamptz default now(),
  primary key (tmdb_id, region)
);

-- App reads the catalog with the anon key; the nightly job writes with the
-- service-role key (which bypasses RLS), so only a read policy is needed.
alter table movie_catalog enable row level security;

drop policy if exists "movie_catalog readable by anyone" on movie_catalog;
create policy "movie_catalog readable by anyone"
  on movie_catalog for select
  using (true);

create index if not exists movie_catalog_region_rating_idx
  on movie_catalog (region, rating desc);
