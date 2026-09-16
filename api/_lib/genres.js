// One genre vocabulary for movies AND series, worked out when the catalog is
// built. The app offers the same chips on both create pages; this is what makes
// every chip mean something on both.
//
// TMDB keeps two different genre lists. The movie list is fine as it is. The TV
// list has no History, Horror, Romance, Thriller or Music at all, and lumps the
// rest into pairs ("Sci-Fi & Fantasy", "Action & Adventure", "War & Politics").
// Filtering series by the movie names used to find nothing - "History" had zero
// shows in every region - and the empty filter then quietly fell back to
// everything. What TV does have is keywords ("historical drama", "supernatural
// horror", "sports"), which arrive in the same detail call, so the missing
// genres are read from those.
//
// Every rule below was checked against the real catalog (2026-09-16); the
// exclusions each name the titles they keep out.

// Must match GENRES in src/lib/genres.js - a test holds the two together.
export const CATEGORIES = [
  'Action', 'Adventure', 'Animation', 'Anime', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
  'Romance', 'Sci-Fi', 'Sport', 'Thriller', 'War', 'Western',
]

// TMDB genres that carry straight over. Family, Kids, TV Movie, News, Talk,
// Soap and Reality are not offered as chips, so they are not labels either.
const DIRECT = {
  'Action': 'Action', 'Adventure': 'Adventure', 'Animation': 'Animation',
  'Comedy': 'Comedy', 'Crime': 'Crime', 'Documentary': 'Documentary',
  'Drama': 'Drama', 'Fantasy': 'Fantasy', 'History': 'History',
  'Horror': 'Horror', 'Music': 'Music', 'Mystery': 'Mystery',
  'Romance': 'Romance', 'Science Fiction': 'Sci-Fi', 'Thriller': 'Thriller',
  'War': 'War', 'Western': 'Western',
}

const any = (keywords, re) => keywords.some(k => re.test(k))

// ── Both kinds ───────────────────────────────────────────────────────────────
// TMDB has no Sport or Biography genre for either kind.
// The "sports" family of keywords is reliable ("sports", "sports documentary",
// "women's sports"). A single named sport is not: that is how Cast Away
// (volleyball), Mulan (cricket), Inside Out (ice hockey) and The Sopranos
// (football) got in - it takes two of those.
const SPORT = /\bsports?\b/
const NOT_SPORT = /sports car/
const NAMED_SPORT = /^(football \(soccer\).*|soccer|american football|basketball|baseball|boxing|boxer|ice hockey|tennis|golf|formula one \(f1\)|volleyball|rugby|cricket|athlete|professional athlete|wrestling)$/
// "fictional biography" is how The Queen's Gambit is tagged.
const BIOGRAPHY = /^(biography|biopic|.* biography|.* biopic)$/
const NOT_BIOGRAPHY = /^fictional biography$/

// ── TV only ──────────────────────────────────────────────────────────────────
// Decade keywords are left out on purpose: "1980s" is Stranger Things.
const HISTORY = /^(history|historical|historical drama|historical fiction|period drama|period piece|ancient (rome|greece|egypt|china)|([1-9]|1[0-9])(st|nd|rd|th) century)$/
const CENTURY = /^(ancient (rome|greece|egypt|china)|([1-9]|1[0-9])(st|nd|rd|th) century)$/
// Counts for both History and War - except on a crime show, where it is the
// backstory (Monster: The Ed Gein Story).
const WORLD_WAR = /^world war (i|ii)$/
const HORROR = /(^|\b)horror\b|^(zombie|zombie apocalypse|haunted house|slasher)$/
// Any flavour of thriller. "suspenseful" is a mood tag (Poirot, Desperate
// Housewives), so it doesn't count.
const THRILLER = /\bthriller\b/
// "bromance" is not romance.
const ROMANCE = /^(romance|romantic|romcom|romantic comedy|romantic drama|love triangle|teenage romance|first love|forbidden love|slow burn romance|interspecies romance|office romance|gothic romance|love at first sight)$/
// "based on play or musical" is The Crown and Fleabag.
const MUSIC = /^(musical|musical comedy|jukebox musical|music|musician|singer|aspiring singer|songwriter|band|rock band|boy band|girl group|pop star|rock star|hip-hop|rap music|k-pop|concert|music industry|opera singer|choir)$/
const WAR = /^(war|vietnam war|korean war|civil war|war on terror|afghanistan war|iraq war|military|us military|us army|soldier|special forces|navy seal|battle|epic battle|battlefield|trench warfare|war crimes|prisoner of war)$/
const WESTERN = /^(western|contemporary western|spaghetti western)$/

// "Sci-Fi & Fantasy" is split by what the keywords talk about. When they point
// both ways, or nowhere, the show keeps both - that is TMDB's own claim.
// "super power" is left out: it is on One Piece and Naruto as much as on
// superhero shows. Word boundaries keep "los angeles" and "self love" out.
const SCI_FI = /science fiction|sci-fi|\bspace\b|spacecraft|spaceship|\balien|time travel|dystopia|post-apocalyptic|artificial intelligence|\brobot|cyberpunk|\bandroid\b|cyborg|mecha\b|\bfuture\b|near future|distant future|superhero|mutant|\bvirus\b|\bclone|genetic|virtual reality|simulation|parallel world|multiverse|\bplanet\b|galaxy|interstellar|extraterrestrial|\bufo\b|technology|scientist|experiment|kaiju/
const FANTASY = /fantasy|\bmagic|\bwitch|wizard|sorcer|dragon|demon|vampire|werewolf|\bfairy|mytholog|\bgods?\b|demigod|isekai|reincarnat|supernatural|\bghost|\bcurse|\bspirits?\b|\belf\b|\belves\b|sword and sorcery|\bangels?\b|occult|shinigami|yokai/
// "Action & Adventure" the same way. "time travel" is not an adventure.
const ACTION = /\baction\b|martial arts|\bfight|combat|shootout|gunfight|assassin|hitman|\bspy\b|espionage|military|soldier|special forces|mercenar|vigilante|superhero|heist|car chase|police|\bswat\b|\bcop\b|bounty hunter|ninja|katana|samurai|\bbattle|gangster|terroris/
const ADVENTURE = /adventure|\bquest\b|journey|treasure|pirate|explor|expedition|survival|road trip|\bisland\b|jungle|(?<!time )\btravel|isekai|fantasy world|dungeon|voyage|wilderness|odyssey/

// { kind: 'movie' | 'tv', genres: TMDB genre names, keywords: TMDB keyword
// names, language: original_language } → categories, in CATEGORIES order.
export function categorize({ kind, genres = [], keywords = [], language = '' }) {
  const out = new Set()
  const kw = keywords.map(k => String(k).toLowerCase())
  const has = name => genres.includes(name)

  for (const g of genres) if (DIRECT[g]) out.add(DIRECT[g])

  if (has('Animation') && language === 'ja') out.add('Anime')
  if (kw.some(k => SPORT.test(k) && !NOT_SPORT.test(k)) || kw.filter(k => NAMED_SPORT.test(k)).length >= 2) out.add('Sport')
  if (kw.some(k => BIOGRAPHY.test(k) && !NOT_BIOGRAPHY.test(k))) out.add('Biography')

  if (kind === 'tv') {
    const sff = has('Sci-Fi & Fantasy')
    if (sff) {
      const sci = any(kw, SCI_FI), fan = any(kw, FANTASY)
      if (sci || !fan) out.add('Sci-Fi')
      if (fan || !sci) out.add('Fantasy')
    }
    if (has('Action & Adventure')) {
      const act = any(kw, ACTION), adv = any(kw, ADVENTURE)
      if (act || !adv) out.add('Action')
      if (adv || !act) out.add('Adventure')
    }
    // A historical keyword on a fantasy show is usually the setting of the
    // fantasy (InuYasha, Record of Ragnarok) - unless it names a real century,
    // which is how Outlander is tagged.
    const worldWar = any(kw, WORLD_WAR) && !has('Crime')
    if ((any(kw, HISTORY) || worldWar) && (!sff || any(kw, CENTURY))) out.add('History')
    if (any(kw, HORROR)) out.add('Horror')
    if (any(kw, THRILLER)) out.add('Thriller')
    // One romance keyword on a crime or action show is a subplot (Better Call
    // Saul, Sword Art Online); on anything else, or two of them, it's the show.
    const romance = kw.filter(k => ROMANCE.test(k)).length
    if (romance >= 2 || (romance === 1 && !has('Crime') && !has('Action & Adventure'))) out.add('Romance')
    if (any(kw, MUSIC)) out.add('Music')
    // "war" and "military" are also on Attack on Titan, Arcane and Stargate.
    if ((any(kw, WAR) || worldWar) && !sff) out.add('War')
    if (any(kw, WESTERN)) out.add('Western')
  }

  return CATEGORIES.filter(c => out.has(c))
}

// Extra discovery per category, so a chip has enough behind it to fill a deck.
// The regular discovery is ranked by rating and popularity, which is why the
// series catalog held three westerns and six documentaries. Each query uses the
// same genre or keywords as categorize() above, so a title found here lands in
// the category it was found for. TMDB ids: genres from /genre/{kind}/list,
// keywords from /search/keyword.
// The "sports" family only - see SPORT above: sports, sport, sports documentary,
// sports drama, sports comedy, professional sports, team sports, women's
// sports, extreme sports, sports biography.
const SPORT_KEYWORD_IDS = '6075|333328|159290|294708|335806|167882|300423|258625|2006|367784'

export const GENRE_DISCOVERY = {
  movie: {
    History: { with_genres: '36' },
    Horror: { with_genres: '27' },
    Western: { with_genres: '37' },
    War: { with_genres: '10752' },
    Music: { with_genres: '10402' },
    Documentary: { with_genres: '99' },
    Mystery: { with_genres: '9648' },
    Anime: { with_genres: '16', with_original_language: 'ja' },
    Sport: { with_keywords: SPORT_KEYWORD_IDS },
    Biography: { with_keywords: '5565|360939' },
  },
  tv: {
    History: { with_keywords: '192772|15060|15126|12995|286194|282633' },
    Horror: { with_keywords: '315058|256183|295907' },
    Romance: { with_keywords: '9840|9799|128|188237|157303' },
    Thriller: { with_keywords: '316362|12565' },
    Sport: { with_keywords: SPORT_KEYWORD_IDS },
    Biography: { with_keywords: '5565|360939' },
    Music: { with_keywords: '4344|283297|4048|10229|311916' },
    War: { with_keywords: '273967|1956|2504|2957|162365|13065' },
    Western: { with_genres: '37' },
    Documentary: { with_genres: '99' },
    Anime: { with_genres: '16', with_original_language: 'ja' },
  },
}
