import { placeIdToNumId } from './activities'

// numIds 2000–2011 — avoids collision with activity (1000–1011) and movie IDs
export const FOOD_CATEGORIES = [
  { id: 'pizza',         numId: 2000, label: 'Pizza',            emoji: '🍕', desc: 'Neapolitan, NY slice, deep dish',          types: ['pizza_restaurant'],                              gradient: 'linear-gradient(135deg, #FF6B35, #FFA07A)' },
  { id: 'burgers',       numId: 2001, label: 'Burgers',          emoji: '🍔', desc: 'Smash burgers, classics, loaded fries',      types: ['hamburger_restaurant'],                          gradient: 'linear-gradient(135deg, #D4600A, #F5A623)' },
  { id: 'sushi',         numId: 2002, label: 'Sushi & Japanese', emoji: '🍣', desc: 'Sashimi, rolls, ramen and udon',             types: ['japanese_restaurant', 'sushi_restaurant', 'ramen_restaurant'], gradient: 'linear-gradient(135deg, #C0392B, #F1948A)' },
  { id: 'chinese',       numId: 2003, label: 'Chinese',          emoji: '🥡', desc: 'Dim sum, noodles, dumplings',               types: ['chinese_restaurant'],                            gradient: 'linear-gradient(135deg, #E74C3C, #922B21)' },
  { id: 'mexican',       numId: 2004, label: 'Mexican',          emoji: '🌮', desc: 'Tacos, burritos, guacamole',                types: ['mexican_restaurant'],                            gradient: 'linear-gradient(135deg, #27AE60, #F39C12)' },
  { id: 'italian',       numId: 2005, label: 'Italian',          emoji: '🍝', desc: 'Pasta, risotto, pizza, tiramisu',           types: ['italian_restaurant'],                            gradient: 'linear-gradient(135deg, #2980B9, #27AE60)' },
  { id: 'indian',        numId: 2006, label: 'Indian',           emoji: '🍛', desc: 'Curries, naan, biryani, samosas',           types: ['indian_restaurant'],                             gradient: 'linear-gradient(135deg, #E67E22, #F1C40F)' },
  { id: 'thai',          numId: 2007, label: 'Thai',             emoji: '🍜', desc: 'Pad thai, green curry, mango sticky rice', types: ['thai_restaurant'],                               gradient: 'linear-gradient(135deg, #1ABC9C, #2ECC71)' },
  { id: 'american',      numId: 2008, label: 'Steakhouse & BBQ', emoji: '🥩', desc: 'Steaks, BBQ, ribs, comfort food',           types: ['american_restaurant', 'steak_house'],            gradient: 'linear-gradient(135deg, #2C3E50, #4CA1AF)' },
  { id: 'mediterranean', numId: 2009, label: 'Mediterranean',   emoji: '🫒', desc: 'Greek, Turkish, Lebanese, mezze',           types: ['mediterranean_restaurant', 'greek_restaurant'],  gradient: 'linear-gradient(135deg, #3498DB, #1A5276)' },
  { id: 'cafe',          numId: 2010, label: 'Café & Bakery',   emoji: '☕', desc: 'Coffee, croissants, brunch, cake',           types: ['cafe', 'bakery', 'brunch_restaurant'],           gradient: 'linear-gradient(135deg, #6F4E37, #C9956C)' },
  { id: 'vegan',         numId: 2011, label: 'Vegan & Veggie',  emoji: '🌱', desc: 'Plant-based, fresh bowls, salads',          types: ['vegan_restaurant', 'vegetarian_restaurant'],     gradient: 'linear-gradient(135deg, #27AE60, #82E0AA)' },
]

// Re-export placeIdToNumId so FoodRoom can use the same hasher
export { placeIdToNumId }
