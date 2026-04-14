function seededRandom(seed) {
  let s = 0
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0
  }
  return function () {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) / 0xffffffff)
  }
}

export const FOOD_ITEMS = [
  { id: 901, title: 'Pizza',                  emoji: '🍕', overview: 'Neapolitan, NY slice, deep dish, or homemade — there is no wrong answer.' },
  { id: 902, title: 'American / Burgers',      emoji: '🍔', overview: 'Smash burgers, classic diners, loaded fries, and everything in between.' },
  { id: 903, title: 'Italian',                 emoji: '🍝', overview: 'Pasta, risotto, tiramisu, and the kind of bread you can\'t stop eating.' },
  { id: 904, title: 'Mexican',                 emoji: '🌮', overview: 'Tacos, burritos, guacamole, and a margarita to seal the deal.' },
  { id: 905, title: 'Japanese / Sushi',        emoji: '🍣', overview: 'Fresh sashimi, creative rolls, miso soup, and edamame.' },
  { id: 906, title: 'Chinese',                 emoji: '🥡', overview: 'Dim sum, noodles, dumplings, and crispy Peking duck.' },
  { id: 907, title: 'Indian',                  emoji: '🍛', overview: 'Rich curries, fluffy naan, fragrant biryani, and samosas.' },
  { id: 908, title: 'Thai',                    emoji: '🍜', overview: 'Pad thai, green curry, mango sticky rice, and bold flavours.' },
  { id: 909, title: 'Breakfast / Brunch',      emoji: '🥞', overview: 'Pancakes, eggs benedict, avocado toast — any time of day.' },
  { id: 910, title: 'Steakhouse',              emoji: '🥩', overview: 'Perfectly cooked cuts, garlic mash, creamed spinach, and red wine.' },
  { id: 911, title: 'Seafood',                 emoji: '🐟', overview: 'Grilled fish, shrimp, lobster, and the freshest catch of the day.' },
  { id: 912, title: 'Fast Food / Late Night',  emoji: '🍟', overview: 'Sometimes only fries and a burger at midnight will do.' },
  { id: 913, title: 'Vegan / Vegetarian',      emoji: '🌱', overview: 'Creative plant-based dishes that even meat lovers enjoy.' },
  { id: 914, title: 'Healthy / Salads',        emoji: '🥗', overview: 'Fresh bowls, grain salads, and food that makes you feel good.' },
  { id: 915, title: 'Dessert / Sweet Treats',  emoji: '🍦', overview: 'Ice cream, waffles, churros — because life\'s too short to skip dessert.' },
  { id: 916, title: 'Café / Bakery',           emoji: '☕', overview: 'Croissants, flat whites, cosy vibes, and afternoon cake.' },
]

export function getFoodItems(roomId) {
  const shuffled = [...FOOD_ITEMS]
  const rng = roomId ? seededRandom(roomId) : Math.random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
