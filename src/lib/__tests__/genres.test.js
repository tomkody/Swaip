import { describe, it, expect } from 'vitest'
import { GENRES, LABEL_ORDER, normalizeGenres, matchesGenres } from '../genres'
import { categorize, CATEGORIES, GENRE_DISCOVERY } from '../../../api/_lib/genres.js'
import { filterMoviePool } from '../tmdb'
// Real TMDB genres and keywords for a few titles, as fetched on 2026-09-16.
import fixtures from './fixtures/tmdb-genres.json'

const tagsFor = (kind, title) => {
  const t = fixtures[kind].find(x => x.title === title)
  return categorize({ kind, genres: t.genres, keywords: t.keywords, language: t.language })
}

// ── One vocabulary ────────────────────────────────────────────────────────────
// Movies and series had two chip lists, and the series one offered History,
// Horror, Romance, Thriller, Fantasy, Anime and Sport - none of which any show
// in the catalog carried.
describe('genre vocabulary', () => {
  it('offers exactly the genres the catalog build tags titles with', () => {
    expect(GENRES.map(g => g.name)).toEqual(CATEGORIES)
  })

  it('orders card labels over every genre, once each', () => {
    expect([...LABEL_ORDER].sort()).toEqual([...CATEGORIES].sort())
  })

  it('only discovers titles for genres that exist', () => {
    for (const kind of ['movie', 'tv']) {
      for (const name of Object.keys(GENRE_DISCOVERY[kind])) expect(CATEGORIES).toContain(name)
    }
  })
})

describe('categorize - series', () => {
  it('reads History and War from keywords, which TMDB TV genres do not have', () => {
    expect(tagsFor('tv', 'Band of Brothers')).toEqual(expect.arrayContaining(['History', 'War', 'Drama']))
  })

  it('splits "Sci-Fi & Fantasy" by what the show is about', () => {
    expect(tagsFor('tv', 'Star Trek: The Next Generation')).toContain('Sci-Fi')
    expect(tagsFor('tv', 'Star Trek: The Next Generation')).not.toContain('Fantasy')
    expect(tagsFor('tv', 'Game of Thrones')).toContain('Fantasy')
    expect(tagsFor('tv', 'Game of Thrones')).not.toContain('Sci-Fi')
  })

  it('finds anime and sport', () => {
    expect(tagsFor('tv', 'Haikyu!!')).toEqual(expect.arrayContaining(['Anime', 'Animation', 'Sport']))
  })

  it('finds horror and romance', () => {
    expect(tagsFor('tv', 'The Haunting of Hill House')).toContain('Horror')
    expect(tagsFor('tv', 'Heartstopper')).toContain('Romance')
  })

  it('keeps a subplot keyword from becoming the genre', () => {
    expect(tagsFor('tv', 'The Sopranos')).not.toContain('Sport')          // "football (soccer)"
    expect(tagsFor('tv', 'Better Call Saul')).not.toContain('Romance')     // "romance", on a crime show
    expect(tagsFor('tv', 'Attack on Titan')).not.toContain('War')          // "military", on a fantasy show
    expect(tagsFor('tv', 'InuYasha')).not.toContain('History')             // "historical", the fantasy's setting
    expect(tagsFor('tv', 'Monster: The Ed Gein Story')).not.toContain('War')
  })

  it('still counts a real century on a fantasy show as history', () => {
    expect(tagsFor('tv', 'Outlander')).toContain('History')
  })
})

describe('categorize - movies', () => {
  it('keeps TMDB movie genres, with the app names', () => {
    expect(tagsFor('movie', 'Interstellar')).toEqual(['Adventure', 'Drama', 'Sci-Fi'])
  })

  it('adds the genres TMDB has no movie genre for', () => {
    expect(tagsFor('movie', 'Spirited Away')).toContain('Anime')
    expect(tagsFor('movie', 'Rocky')).toContain('Sport')
    expect(tagsFor('movie', 'Oppenheimer')).toEqual(expect.arrayContaining(['Biography', 'History']))
  })

  it('needs more than one named sport - Cast Away has a volleyball', () => {
    expect(tagsFor('movie', 'Cast Away')).not.toContain('Sport')
  })
})

// ── On the client ─────────────────────────────────────────────────────────────
describe('normalizeGenres', () => {
  it('orders a card label most specific first', () => {
    expect(normalizeGenres(['Animation', 'Comedy', 'Drama', 'Anime', 'Sport'])).toEqual(['Anime', 'Sport', 'Comedy', 'Animation', 'Drama'])
  })

  it('reads the names old rooms and the fallback lists use', () => {
    expect(normalizeGenres(['Musical'])).toEqual(['Music'])
    expect(normalizeGenres(['Film Noir', 'Noir'])).toEqual(['Crime'])
    expect(normalizeGenres(['Anime', 'Action'])).toEqual(['Anime', 'Animation', 'Action'])
  })

  it('drops genres that are no longer offered', () => {
    expect(normalizeGenres(['Reality', 'Family', 'TV Movie', 'Kids', 'Drama'])).toEqual(['Drama'])
  })
})

describe('genre filter', () => {
  const pool = [
    { id: 1, genres: ['Music', 'Drama'], platforms: ['netflix'] },
    { id: 2, genres: ['History', 'Drama'], platforms: ['netflix'] },
    { id: 3, genres: ['Horror'], platforms: ['max'] },
  ]

  it('matches whole genre names, any of the selected ones', () => {
    expect(matchesGenres(['Anime', 'Animation'], ['Anime'])).toBe(true)
    expect(matchesGenres(['Animation'], ['Anime'])).toBe(false)
    expect(filterMoviePool(pool, [], ['History', 'Horror']).map(t => t.id)).toEqual([2, 3])
  })

  it('still honours a room saved with the old "Musical" chip', () => {
    expect(filterMoviePool(pool, [], ['Musical']).map(t => t.id)).toEqual([1])
  })
})
