import { placeIdToNumId } from './activities'

// numIds 2000–2013 — avoids collision with activity (1000–1011) and movie IDs
export const FOOD_CATEGORIES = [
  { id: 'pizza',         numId: 2000, label: 'Pizza',            emoji: '🍕', desc: 'Neapolitan, NY slice, deep dish',          types: ['pizza_restaurant'],                                          gradient: 'linear-gradient(135deg, #FF6B35, #FFA07A)' },
  { id: 'burgers',       numId: 2001, label: 'Burgers',          emoji: '🍔', desc: 'Smash burgers, classics, loaded fries',      types: ['hamburger_restaurant'],                                      gradient: 'linear-gradient(135deg, #D4600A, #F5A623)' },
  { id: 'sushi',         numId: 2002, label: 'Sushi & Japanese', emoji: '🍣', desc: 'Sashimi, rolls, ramen and udon',             types: ['japanese_restaurant', 'sushi_restaurant', 'ramen_restaurant'], gradient: 'linear-gradient(135deg, #C0392B, #F1948A)' },
  { id: 'chinese',       numId: 2003, label: 'Chinese',          emoji: '🥡', desc: 'Dim sum, noodles, dumplings, hot pot',       types: ['chinese_restaurant'],                                        gradient: 'linear-gradient(135deg, #E74C3C, #922B21)' },
  { id: 'mexican',       numId: 2004, label: 'Mexican',          emoji: '🌮', desc: 'Tacos, burritos, guacamole, elotes',         types: ['mexican_restaurant'],                                        gradient: 'linear-gradient(135deg, #27AE60, #F39C12)' },
  { id: 'italian',       numId: 2005, label: 'Italian',          emoji: '🍝', desc: 'Pasta, risotto, pizza, tiramisu',            types: ['italian_restaurant'],                                        gradient: 'linear-gradient(135deg, #2980B9, #27AE60)' },
  { id: 'indian',        numId: 2006, label: 'Indian',           emoji: '🍛', desc: 'Curries, naan, biryani, samosas',            types: ['indian_restaurant'],                                         gradient: 'linear-gradient(135deg, #E67E22, #F1C40F)' },
  { id: 'thai',          numId: 2007, label: 'Thai',             emoji: '🍜', desc: 'Pad thai, green curry, mango sticky rice',  types: ['thai_restaurant'],                                           gradient: 'linear-gradient(135deg, #1ABC9C, #2ECC71)' },
  { id: 'american',      numId: 2008, label: 'Steakhouse & BBQ', emoji: '🥩', desc: 'Steaks, BBQ, ribs, comfort food',            types: ['american_restaurant', 'steak_house', 'barbecue_restaurant'], gradient: 'linear-gradient(135deg, #2C3E50, #4CA1AF)' },
  { id: 'mediterranean', numId: 2009, label: 'Mediterranean',   emoji: '🫒', desc: 'Greek, Turkish, Lebanese, mezze',            types: ['mediterranean_restaurant', 'greek_restaurant'],              gradient: 'linear-gradient(135deg, #3498DB, #1A5276)' },
  { id: 'cafe',          numId: 2010, label: 'Café & Bakery',   emoji: '☕', desc: 'Coffee, croissants, brunch, cake',            types: ['cafe', 'bakery', 'brunch_restaurant'],                       gradient: 'linear-gradient(135deg, #6F4E37, #C9956C)' },
  { id: 'vegan',         numId: 2011, label: 'Vegan & Veggie',  emoji: '🌱', desc: 'Plant-based, fresh bowls, salads',           types: ['vegan_restaurant', 'vegetarian_restaurant'],                 gradient: 'linear-gradient(135deg, #27AE60, #82E0AA)' },
  { id: 'spanish',       numId: 2012, label: 'Spanish',         emoji: '🥘', desc: 'Tapas, paella, jamón, churros, sangría',     types: ['spanish_restaurant'],                                        gradient: 'linear-gradient(135deg, #C0392B, #F39C12)' },
]

// numId reserved for the dynamic "Local Cuisine" category
export const LOCAL_CUISINE_NUMID = 2013

// Country code (ISO 3166-1 alpha-2 uppercase) → local cuisine descriptor.
// types: Google Places API (new) cuisine types to search for.
// Falls back to ['restaurant'] for countries without a dedicated API type.
const COUNTRY_CUISINE_MAP = {
  // Western Europe
  FR: { label: 'French Cuisine',      emoji: '🥐', desc: 'Brasseries, bistros, coq au vin, crêpes',      types: ['french_restaurant'] },
  ES: { label: 'Spanish Cuisine',     emoji: '🥘', desc: 'Tapas, paella, jamón, churros, pintxos',       types: ['spanish_restaurant'] },
  IT: { label: 'Italian Cuisine',     emoji: '🍝', desc: 'Pasta, risotto, pizza, gelato, tiramisu',      types: ['italian_restaurant'] },
  PT: { label: 'Portuguese Cuisine',  emoji: '🐟', desc: 'Bacalhau, pastel de nata, bifanas, francesinha', types: ['seafood_restaurant'] },
  DE: { label: 'German Cuisine',      emoji: '🥨', desc: 'Schnitzel, bratwurst, pretzels, sauerbraten',  types: ['restaurant'] },
  AT: { label: 'Austrian Cuisine',    emoji: '🎂', desc: 'Wiener Schnitzel, strudel, Tafelspitz, Heuriger', types: ['restaurant'] },
  CH: { label: 'Swiss Cuisine',       emoji: '🧀', desc: 'Fondue, raclette, rösti, älplermagronen',      types: ['restaurant'] },
  NL: { label: 'Dutch Cuisine',       emoji: '🧀', desc: 'Stroopwafels, bitterballen, herring, stamppot', types: ['restaurant'] },
  BE: { label: 'Belgian Cuisine',     emoji: '🍟', desc: 'Moules-frites, waffles, chocolate, lambic beer', types: ['restaurant'] },
  GB: { label: 'British Cuisine',     emoji: '🫖', desc: 'Gastropubs, fish & chips, Sunday roast, pies', types: ['restaurant'] },
  IE: { label: 'Irish Cuisine',       emoji: '🥔', desc: 'Irish stew, soda bread, colcannon, seafood chowder', types: ['restaurant'] },

  // Northern Europe
  SE: { label: 'Swedish Cuisine',     emoji: '🦐', desc: 'Smörgåsbord, meatballs, gravlax, husmanskost', types: ['seafood_restaurant'] },
  NO: { label: 'Norwegian Cuisine',   emoji: '🐟', desc: 'Salmon, lutefisk, raspeballer, brown cheese',  types: ['seafood_restaurant'] },
  DK: { label: 'Danish Cuisine',      emoji: '🥐', desc: 'Smørrebrød, pastries, new Nordic cuisine',     types: ['restaurant'] },
  FI: { label: 'Finnish Cuisine',     emoji: '🫐', desc: 'Salmonsoup, rye bread, karjalanpiirakka, reindeer', types: ['seafood_restaurant'] },

  // Central & Eastern Europe
  CZ: { label: 'Czech Cuisine',       emoji: '🍺', desc: 'Svíčková, goulash, knedlíky, trdelník, pivo', types: ['restaurant'] },
  SK: { label: 'Slovak Cuisine',      emoji: '🍖', desc: 'Bryndzové halušky, kapustnica, šúľance',      types: ['restaurant'] },
  PL: { label: 'Polish Cuisine',      emoji: '🥟', desc: 'Pierogi, żurek, bigos, kielbasa, barszcz',    types: ['restaurant'] },
  HU: { label: 'Hungarian Cuisine',   emoji: '🍲', desc: 'Goulash, lángos, paprikás csirke, kürtőskalács', types: ['restaurant'] },
  RO: { label: 'Romanian Cuisine',    emoji: '🍖', desc: 'Sarmale, mici, mămăligă, cozonac, ciorbă',    types: ['restaurant'] },
  HR: { label: 'Croatian Cuisine',    emoji: '🐟', desc: 'Grilled fish, peka, black risotto, štrukli',  types: ['seafood_restaurant'] },
  RS: { label: 'Serbian Cuisine',     emoji: '🍖', desc: 'Ćevapi, pljeskavica, ajvar, sarma, kajmak',   types: ['restaurant'] },
  BG: { label: 'Bulgarian Cuisine',   emoji: '🥗', desc: 'Shopska salad, banitsa, kebapche, tarator',   types: ['restaurant'] },
  UA: { label: 'Ukrainian Cuisine',   emoji: '🥣', desc: 'Borscht, varenyky, holubtsi, salo, pampushky', types: ['restaurant'] },
  GR: { label: 'Greek Cuisine',       emoji: '🫒', desc: 'Mezze, souvlaki, moussaka, spanakopita',      types: ['greek_restaurant'] },

  // Mediterranean / Southern Europe
  TR: { label: 'Turkish Cuisine',     emoji: '🥙', desc: 'Kebabs, mezze, baklava, börek, çay',          types: ['turkish_restaurant'] },

  // Asia
  JP: { label: 'Japanese Cuisine',    emoji: '🍱', desc: 'Ramen, sushi, izakaya, wagyu, kaiseki',        types: ['japanese_restaurant', 'ramen_restaurant', 'sushi_restaurant'] },
  CN: { label: 'Chinese Cuisine',     emoji: '🥢', desc: 'Dim sum, noodles, dumplings, hot pot, Peking duck', types: ['chinese_restaurant'] },
  KR: { label: 'Korean Cuisine',      emoji: '🍲', desc: 'BBQ, bibimbap, kimchi, ramyeon, tteokbokki',   types: ['korean_restaurant'] },
  IN: { label: 'Indian Cuisine',      emoji: '🍛', desc: 'Curries, naan, biryani, dosa, chai',           types: ['indian_restaurant'] },
  TH: { label: 'Thai Cuisine',        emoji: '🌶️', desc: 'Pad thai, green curry, som tam, mango sticky rice', types: ['thai_restaurant'] },
  VN: { label: 'Vietnamese Cuisine',  emoji: '🍜', desc: 'Phở, bánh mì, fresh rolls, bún bò Huế',       types: ['vietnamese_restaurant'] },
  ID: { label: 'Indonesian Cuisine',  emoji: '🍚', desc: 'Nasi goreng, satay, rendang, gado-gado',       types: ['indonesian_restaurant'] },
  MY: { label: 'Malaysian Cuisine',   emoji: '🍜', desc: 'Nasi lemak, laksa, char kway teow, satay',     types: ['restaurant'] },
  SG: { label: 'Singaporean Cuisine', emoji: '🦞', desc: 'Chili crab, hawker food, laksa, kaya toast',   types: ['seafood_restaurant'] },
  PH: { label: 'Filipino Cuisine',    emoji: '🍚', desc: 'Adobo, sinigang, lechon, kare-kare, halo-halo', types: ['restaurant'] },
  TW: { label: 'Taiwanese Cuisine',   emoji: '🧋', desc: 'Beef noodle soup, scallion pancake, bubble tea', types: ['chinese_restaurant'] },

  // Middle East & North Africa
  LB: { label: 'Lebanese Cuisine',    emoji: '🫓', desc: 'Hummus, kibbeh, tabbouleh, fattoush, mezze',  types: ['lebanese_restaurant'] },
  IL: { label: 'Israeli Cuisine',     emoji: '🧆', desc: 'Falafel, shakshuka, hummus, sabich, shawarma', types: ['middle_eastern_restaurant'] },
  AE: { label: 'Emirati Cuisine',     emoji: '🫕', desc: 'Machboos, harees, luqaimat, al harees',       types: ['middle_eastern_restaurant'] },
  SA: { label: 'Saudi Cuisine',       emoji: '🍖', desc: 'Kabsa, jareesh, saleeg, mutabbaq, mandi',     types: ['middle_eastern_restaurant'] },
  EG: { label: 'Egyptian Cuisine',    emoji: '🫙', desc: 'Koshari, ful medames, kebda, taameya, molokhia', types: ['middle_eastern_restaurant'] },
  MA: { label: 'Moroccan Cuisine',    emoji: '🫕', desc: 'Tagine, couscous, pastilla, harira, mint tea', types: ['middle_eastern_restaurant'] },
  IR: { label: 'Persian Cuisine',     emoji: '🍚', desc: 'Ghormeh sabzi, kebabs, ash reshteh, saffron rice', types: ['middle_eastern_restaurant'] },

  // Americas
  US: { label: 'American Cuisine',    emoji: '🍔', desc: 'BBQ, steaks, comfort food, diners, wings',    types: ['american_restaurant', 'steak_house', 'barbecue_restaurant'] },
  CA: { label: 'Canadian Cuisine',    emoji: '🍁', desc: 'Poutine, butter tarts, Nanaimo bars, tourtière', types: ['american_restaurant'] },
  MX: { label: 'Mexican Cuisine',     emoji: '🌮', desc: 'Tacos, mole, tamales, elotes, pozole',         types: ['mexican_restaurant'] },
  BR: { label: 'Brazilian Cuisine',   emoji: '🥩', desc: 'Churrasco, feijoada, pão de queijo, caipirinha', types: ['brazilian_restaurant', 'steak_house'] },
  AR: { label: 'Argentine Cuisine',   emoji: '🥩', desc: 'Asado, empanadas, dulce de leche, mate',       types: ['steak_house', 'barbecue_restaurant'] },
  CL: { label: 'Chilean Cuisine',     emoji: '🥑', desc: 'Empanadas, cazuela, completo, chorrillana',    types: ['restaurant'] },
  CO: { label: 'Colombian Cuisine',   emoji: '🍗', desc: 'Bandeja paisa, arepas, sancocho, ajiaco',      types: ['restaurant'] },
  PE: { label: 'Peruvian Cuisine',    emoji: '🐟', desc: 'Ceviche, lomo saltado, aji de gallina, causa', types: ['seafood_restaurant'] },

  // Africa
  ZA: { label: 'South African Cuisine', emoji: '🍖', desc: 'Braai, boerewors, bunny chow, bobotie, biltong', types: ['restaurant'] },
  ET: { label: 'Ethiopian Cuisine',   emoji: '🫓', desc: 'Injera, tibs, doro wat, kitfo, berbere',       types: ['restaurant'] },
  NG: { label: 'Nigerian Cuisine',    emoji: '🍲', desc: 'Jollof rice, egusi soup, suya, puff-puff',     types: ['restaurant'] },

  // Oceania
  AU: { label: 'Australian Cuisine',  emoji: '🦘', desc: 'Seafood, BBQ, café culture, meat pies, pavlova', types: ['seafood_restaurant'] },
  NZ: { label: 'New Zealand Cuisine', emoji: '🥝', desc: 'Hangi, green-lipped mussels, lamingtons, L&P', types: ['seafood_restaurant'] },
}

// Default for countries not in the map
const LOCAL_CUISINE_DEFAULT = {
  label: 'Local Cuisine',
  emoji: '🏠',
  desc: 'Traditional local dishes and regional specialties',
  types: ['restaurant'],
}

// Build the dynamic "Local Cuisine" category for a given ISO country code
export function buildLocalCuisineCategory(countryCode) {
  const info = COUNTRY_CUISINE_MAP[(countryCode || '').toUpperCase()] || LOCAL_CUISINE_DEFAULT
  return {
    id: 'local',
    numId: LOCAL_CUISINE_NUMID,
    label: info.label,
    emoji: info.emoji,
    desc: info.desc,
    types: info.types,
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
    isLocal: true,
  }
}

// Re-export placeIdToNumId so FoodRoom can use the same hasher
export { placeIdToNumId }
