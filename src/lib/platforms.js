export const PLATFORMS = [
  { id: 'netflix',   name: 'Netflix',      color: '#E50914', bg: 'rgba(229,9,20,0.15)',   border: 'rgba(229,9,20,0.4)' },
  { id: 'disney',    name: 'Disney+',      color: '#0063E5', bg: 'rgba(0,99,229,0.15)',   border: 'rgba(0,99,229,0.4)' },
  { id: 'max',       name: 'Max',          color: '#731CF8', bg: 'rgba(115,28,248,0.15)', border: 'rgba(115,28,248,0.4)' },
  { id: 'prime',     name: 'Prime Video',  color: '#00A8E0', bg: 'rgba(0,168,224,0.15)',  border: 'rgba(0,168,224,0.4)' },
  { id: 'apple',     name: 'Apple TV+',    color: '#c8c8c8', bg: 'rgba(200,200,200,0.1)', border: 'rgba(200,200,200,0.3)' },
  { id: 'paramount', name: 'Paramount+',   color: '#0064FF', bg: 'rgba(0,100,255,0.15)',  border: 'rgba(0,100,255,0.4)' },
]

// Movie ID → platform IDs  (approximate, varies by region)
export const MOVIE_PLATFORMS = {
  // Netflix
  1:  ['netflix'],       // The Shawshank Redemption
  17: ['netflix'],       // GoodFellas
  26: ['netflix'],       // City of God
  27: ['netflix'],       // Life Is Beautiful
  28: ['netflix'],       // Terminator 2
  39: ['netflix'],       // The Departed
  40: ['netflix'],       // Whiplash
  45: ['netflix'],       // Spider-Man: Across the Spider-Verse
  48: ['netflix'],       // Intouchables
  51: ['netflix'],       // Django Unchained
  // Disney+
  15: ['disney'],        // Star Wars: The Empire Strikes Back
  29: ['disney'],        // Star Wars: A New Hope
  37: ['disney'],        // The Lion King
  50: ['disney'],        // Alien
  57: ['disney'],        // WALL·E
  // Max
  3:  ['max'],           // The Dark Knight
  6:  ['max'],           // LOTR: Return of the King
  8:  ['max'],           // LOTR: Fellowship of the Ring
  11: ['max'],           // LOTR: The Two Towers
  14: ['max'],           // Inception
  16: ['max'],           // The Matrix
  34: ['max'],           // Parasite
  42: ['max'],           // The Prestige
  47: ['max'],           // Casablanca
  59: ['max'],           // Dune: Part Two
  // Prime Video
  41: ['prime'],         // Kill Bill
  49: ['prime'],         // The Usual Suspects
  54: ['prime'],         // Once Upon a Time in the West
  58: ['prime'],         // Memento
  // Paramount+
  2:  ['paramount'],     // The Godfather
  4:  ['paramount'],     // The Godfather Part II
  12: ['paramount'],     // Forrest Gump
  18: ['paramount'],     // Interstellar
  33: ['paramount'],     // Gladiator
  60: ['paramount'],     // Raiders of the Lost Ark
}

// Series ID → platform IDs
export const SERIES_PLATFORMS = {
  // Netflix
  1:  ['netflix'],       // Breaking Bad
  12: ['netflix'],       // Our Planet
  16: ['netflix'],       // Fullmetal Alchemist: Brotherhood
  19: ['netflix'],       // The Last Dance
  25: ['netflix'],       // Better Call Saul
  26: ['netflix'],       // Arcane
  // Max (HBO)
  4:  ['max'],           // Band of Brothers
  5:  ['max'],           // Chernobyl
  6:  ['max'],           // The Wire
  8:  ['max'],           // The Sopranos
  13: ['max'],           // Game of Thrones
  22: ['max'],           // Rick and Morty
  // Disney+
  7:  ['disney'],        // Avatar: The Last Airbender
  14: ['disney'],        // Bluey
  // Prime Video
  29: ['prime'],         // Clarkson's Farm
  17: ['prime'],         // Attack on Titan
  // Apple TV+
  // Paramount+
}
