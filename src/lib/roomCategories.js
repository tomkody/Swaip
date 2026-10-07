import { seededShuffle } from './random'
import { FOOD_CATEGORIES, buildLocalCuisineCategory } from './foodCategories'
import { ACTIVITY_CATEGORIES } from './activities'

// The category grid's order for one room, shared by the grid itself and the
// invitee's welcome screen, so the three tiles teased there are the first three
// they then see (food used to shuffle a list without the Local Cuisine tile, so
// the order differed). Module cache: stable identity, no hook-dependency fights.
const cache = new Map()

export function roomCategories(type, roomId, countryCode) {
  const key = `${type}:${roomId}:${type === 'food' ? countryCode || '' : ''}`
  if (!cache.has(key)) {
    cache.set(key, type === 'food'
      ? seededShuffle([...FOOD_CATEGORIES, buildLocalCuisineCategory(countryCode)], roomId)
      : seededShuffle(ACTIVITY_CATEGORIES, roomId))
  }
  return cache.get(key)
}
