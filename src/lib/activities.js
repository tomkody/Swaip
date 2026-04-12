export const ACTIVITIES = [
  // Active
  { id: 'hiking', name: 'Hiking', emoji: '🥾', category: 'Active', description: 'Explore trails and nature paths' },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', category: 'Active', description: 'Shoot hoops together' },
  { id: 'swimming', name: 'Swimming', emoji: '🏊', category: 'Active', description: 'Hit the pool or open water' },
  { id: 'cycling', name: 'Cycling', emoji: '🚴', category: 'Active', description: 'Ride bikes around the city or trails' },
  { id: 'dancing', name: 'Dancing', emoji: '💃', category: 'Active', description: 'Learn a dance style or just freestyle' },

  // Relaxing
  { id: 'movie-night', name: 'Movie Night', emoji: '🍿', category: 'Relaxing', description: 'Pick a film and chill' },
  { id: 'spa-day', name: 'Spa Day', emoji: '🧖', category: 'Relaxing', description: 'Face masks, candles, relaxation' },
  { id: 'stargazing', name: 'Stargazing', emoji: '🌌', category: 'Relaxing', description: 'Watch the night sky together' },
  { id: 'picnic', name: 'Picnic', emoji: '🧺', category: 'Relaxing', description: 'Pack food and find a nice spot' },
  { id: 'reading', name: 'Reading Together', emoji: '📖', category: 'Relaxing', description: 'Read side by side or the same book' },

  // Creative
  { id: 'cooking', name: 'Cooking', emoji: '👨‍🍳', category: 'Creative', description: 'Try a new recipe together' },
  { id: 'pottery', name: 'Pottery', emoji: '🏺', category: 'Creative', description: 'Get your hands dirty with clay' },
  { id: 'painting', name: 'Painting', emoji: '🎨', category: 'Creative', description: 'Canvas, watercolors, or digital art' },
  { id: 'music-jam', name: 'Music Jam', emoji: '🎸', category: 'Creative', description: 'Play instruments or make beats' },
  { id: 'photography', name: 'Photography Walk', emoji: '📸', category: 'Creative', description: 'Explore and capture cool shots' },

  // Mind-provoking
  { id: 'board-games', name: 'Board Games', emoji: '🎲', category: 'Mind-provoking', description: 'Strategy games, card games, classics' },
  { id: 'puzzles', name: 'Puzzles', emoji: '🧩', category: 'Mind-provoking', description: 'Jigsaw, crossword, or brain teasers' },
  { id: 'chess', name: 'Chess', emoji: '♟️', category: 'Mind-provoking', description: 'Classic battle of wits' },
  { id: 'trivia', name: 'Trivia Night', emoji: '🧠', category: 'Mind-provoking', description: 'Test your knowledge together' },
  { id: 'escape-room', name: 'Escape Room', emoji: '🔐', category: 'Mind-provoking', description: 'Solve puzzles under pressure' },

  // Social
  { id: 'karaoke', name: 'Karaoke', emoji: '🎤', category: 'Social', description: 'Sing your hearts out' },
  { id: 'volunteering', name: 'Volunteering', emoji: '🤝', category: 'Social', description: 'Give back to the community together' },
  { id: 'wine-tasting', name: 'Wine Tasting', emoji: '🍷', category: 'Social', description: 'Sample wines and learn about them' },
  { id: 'game-night', name: 'Video Game Night', emoji: '🎮', category: 'Social', description: 'Co-op or versus, your choice' },
  { id: 'cafe-hopping', name: 'Cafe Hopping', emoji: '☕', category: 'Social', description: 'Try different coffee spots' },

  // Outdoor
  { id: 'camping', name: 'Camping', emoji: '⛺', category: 'Outdoor', description: 'Sleep under the stars' },
  { id: 'kayaking', name: 'Kayaking', emoji: '🛶', category: 'Outdoor', description: 'Paddle through calm waters' },
  { id: 'rock-climbing', name: 'Rock Climbing', emoji: '🧗', category: 'Outdoor', description: 'Indoor wall or real rocks' },
  { id: 'gardening', name: 'Gardening', emoji: '🌱', category: 'Outdoor', description: 'Plant and grow something together' },
  { id: 'beach-day', name: 'Beach Day', emoji: '🏖️', category: 'Outdoor', description: 'Sun, sand, and waves' },
]

export function getActivitiesByCategory() {
  const groups = {}
  for (const a of ACTIVITIES) {
    if (!groups[a.category]) groups[a.category] = []
    groups[a.category].push(a)
  }
  return groups
}
