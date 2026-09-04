-- TMDB popularity per title, used to front-load recognisable cards in the deck
-- (see src/lib/deck.js). Filled by the nightly refresh after this is applied;
-- the refresh keeps working without the column, it just can't rank yet.
alter table movie_catalog  add column if not exists popularity real;
alter table series_catalog add column if not exists popularity real;
