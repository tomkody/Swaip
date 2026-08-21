-- TV series catalog cache, refreshed nightly from TMDB by /api/refresh-movies.
-- Same shape as movie_catalog: one row per (show, region).
create table if not exists series_catalog (
  tmdb_id     integer     not null,
  region      text        not null,
  title       text        not null,
  year        text,
  rating      numeric,
  runtime     text,                          -- season count, e.g. "3 seasons"
  genres      text[]      default '{}',
  poster_url  text,
  overview    text,
  platforms   text[]      default '{}',      -- netflix, disney, max, prime, apple, paramount
  updated_at  timestamptz default now(),
  primary key (tmdb_id, region)
);

alter table series_catalog enable row level security;

drop policy if exists "series_catalog readable by anyone" on series_catalog;
create policy "series_catalog readable by anyone"
  on series_catalog for select
  using (true);

create index if not exists series_catalog_region_rating_idx
  on series_catalog (region, rating desc);
