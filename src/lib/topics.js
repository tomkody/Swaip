export const TOPICS = [
  {
    id: 'sports-fitness',
    name: 'Sports & Fitness',
    emoji: '\u26bd',
    subtopics: [
      { id: 'running', name: 'Running & Marathons', emoji: '\ud83c\udfc3', desc: 'Training routines, best routes, and gear.' },
      { id: 'team-sports', name: 'Team Sports', emoji: '\ud83c\udfc8', desc: 'Football, Basketball, Ice Hockey, and Rugby.' },
      { id: 'martial-arts', name: 'Martial Arts & Combat', emoji: '\ud83e\udd4a', desc: 'Boxing, BJJ, MMA, and traditional disciplines.' },
      { id: 'mind-body', name: 'Mind & Body', emoji: '\ud83e\uddd8', desc: 'Yoga, Pilates, and meditation practices.' },
      { id: 'extreme-outdoor', name: 'Extreme & Outdoor', emoji: '\ud83e\uddd7', desc: 'Rock climbing, surfing, snowboarding, and mountain biking.' },
    ],
  },
  {
    id: 'travel-adventure',
    name: 'Travel & Adventure',
    emoji: '\u2708\ufe0f',
    subtopics: [
      { id: 'backpacking', name: 'Backpacking & Budget Travel', emoji: '\ud83c\udf92', desc: 'Hostels, hitchhiking, and cheap destinations.' },
      { id: 'luxury-resorts', name: 'Luxury & Resorts', emoji: '\ud83c\udfe8', desc: 'Fine hotels, cruises, and all-inclusive getaways.' },
      { id: 'cultural-immersion', name: 'Cultural Immersion', emoji: '\ud83c\udf0d', desc: 'Volunteering abroad, living like a local, and language barriers.' },
      { id: 'road-trips', name: 'Road Trips', emoji: '\ud83d\ude97', desc: 'Van life, scenic routes, and camping.' },
      { id: 'culinary-tourism', name: 'Culinary Tourism', emoji: '\ud83c\udf5c', desc: 'Traveling for food, wine tasting, and street food tours.' },
    ],
  },
  {
    id: 'literature',
    name: 'Literature & Reading',
    emoji: '\ud83d\udcda',
    subtopics: [
      { id: 'scifi-fantasy', name: 'Science Fiction & Fantasy', emoji: '\ud83d\udc7d', desc: 'World-building, futuristic concepts, and magic systems.' },
      { id: 'biographies', name: 'Biographies & Memoirs', emoji: '\ud83d\udc64', desc: 'Lessons from historical figures and celebrities.' },
      { id: 'thrillers-crime', name: 'Thrillers & True Crime', emoji: '\ud83d\udd75\ufe0f', desc: 'Unsolved mysteries, psychological thrillers, and detective novels.' },
      { id: 'self-help', name: 'Self-Help & Philosophy', emoji: '\ud83d\udca1', desc: 'Personal growth, stoicism, and habit building.' },
      { id: 'comics-manga', name: 'Comics & Manga', emoji: '\ud83e\uddb8', desc: 'Graphic novels, webtoons, and classic comic books.' },
    ],
  },
  {
    id: 'technology',
    name: 'Technology & The Future',
    emoji: '\ud83d\udcbb',
    subtopics: [
      { id: 'ai', name: 'Artificial Intelligence', emoji: '\ud83e\udd16', desc: 'ChatGPT, automation, and the ethics of AI.' },
      { id: 'space', name: 'Space Exploration', emoji: '\ud83d\ude80', desc: 'Mars missions, the James Webb telescope, and commercial spaceflight.' },
      { id: 'gadgets', name: 'Consumer Gadgets', emoji: '\ud83d\udcf1', desc: 'Smartphones, smart home setups, and wearables.' },
      { id: 'gaming', name: 'Gaming', emoji: '\ud83c\udfae', desc: 'PC building, console wars, indie games, and esports.' },
      { id: 'vr-ar', name: 'Virtual & Augmented Reality', emoji: '\ud83e\udd7d', desc: 'The metaverse, VR gaming, and practical applications.' },
    ],
  },
  {
    id: 'food-drink',
    name: 'Food & Drink',
    emoji: '\ud83c\udf54',
    subtopics: [
      { id: 'home-cooking', name: 'Home Cooking & Baking', emoji: '\ud83c\udf73', desc: 'Sourdough, meal prep, and family recipes.' },
      { id: 'street-food', name: 'Street Food Culture', emoji: '\ud83c\udf2e', desc: 'Night markets, food trucks, and regional delicacies.' },
      { id: 'fine-dining', name: 'Fine Dining', emoji: '\ud83c\udf77', desc: 'Michelin-star restaurants and tasting menus.' },
      { id: 'dietary', name: 'Dietary Lifestyles', emoji: '\ud83e\udd57', desc: 'Veganism, keto, gluten-free, and sustainable eating.' },
      { id: 'craft-beverages', name: 'Craft Beverages', emoji: '\u2615', desc: 'Specialty coffee, craft breweries, mixology, and wine.' },
    ],
  },
  {
    id: 'work-career',
    name: 'Work & Career',
    emoji: '\ud83d\udcbc',
    subtopics: [
      { id: 'remote-work', name: 'Remote Work & Digital Nomadism', emoji: '\ud83d\udcbb', desc: 'Home office setups, productivity, and working from abroad.' },
      { id: 'entrepreneurship', name: 'Entrepreneurship', emoji: '\ud83d\ude80', desc: 'Startups, side hustles, and venture capital.' },
      { id: 'office-dynamics', name: 'Office Dynamics', emoji: '\ud83c\udfe2', desc: 'Navigating corporate culture and workplace friendships.' },
      { id: 'career-transitions', name: 'Career Transitions', emoji: '\ud83d\udd04', desc: 'Going back to school, changing industries, and interviewing.' },
      { id: 'work-life-balance', name: 'Work-Life Balance', emoji: '\u2696\ufe0f', desc: 'Burnout prevention, four-day work weeks, and setting boundaries.' },
    ],
  },
  {
    id: 'arts-entertainment',
    name: 'Arts & Entertainment',
    emoji: '\ud83c\udfa8',
    subtopics: [
      { id: 'cinema-tv', name: 'Cinema & Television', emoji: '\ud83c\udf7f', desc: 'Binge-watching, classic films, and directing styles.' },
      { id: 'music-concerts', name: 'Music & Concerts', emoji: '\ud83c\udfb8', desc: 'Vinyl collecting, music production, and live festivals.' },
      { id: 'photography', name: 'Photography', emoji: '\ud83d\udcf7', desc: 'Film vs. digital, street photography, and editing techniques.' },
      { id: 'theater', name: 'Theater & Performing Arts', emoji: '\ud83c\udfad', desc: 'Broadway, stand-up comedy, and improv.' },
      { id: 'design-architecture', name: 'Design & Architecture', emoji: '\ud83c\udfdb\ufe0f', desc: 'Interior design, brutalism, and city planning.' },
    ],
  },
  {
    id: 'hobbies',
    name: 'Hobbies & Crafting',
    emoji: '\ud83e\udde9',
    subtopics: [
      { id: 'board-games', name: 'Tabletop & Board Games', emoji: '\ud83c\udfb2', desc: 'D&D, strategy games, and party games.' },
      { id: 'textile-arts', name: 'Textile Arts', emoji: '\ud83e\uddf6', desc: 'Knitting, crocheting, sewing, and fashion design.' },
      { id: 'diy-woodworking', name: 'DIY & Woodworking', emoji: '\ud83d\udd28', desc: 'Restoring furniture, home renovations, and tools.' },
      { id: 'gardening', name: 'Gardening', emoji: '\ud83c\udf31', desc: 'Houseplants, urban farming, and landscaping.' },
      { id: 'automotive', name: 'Automotive', emoji: '\ud83c\udfce\ufe0f', desc: 'Classic car restoration, Formula 1, and EVs.' },
    ],
  },
  {
    id: 'science-nature',
    name: 'Science & Nature',
    emoji: '\ud83e\udde0',
    subtopics: [
      { id: 'astronomy', name: 'Astronomy & The Cosmos', emoji: '\ud83d\udd2d', desc: 'Black holes, exoplanets, and the Fermi Paradox.' },
      { id: 'biology-genetics', name: 'Biology & Genetics', emoji: '\ud83e\uddec', desc: 'CRISPR, de-extinction, and human evolution.' },
      { id: 'natural-world', name: 'The Natural World', emoji: '\ud83c\udf0b', desc: 'Deep ocean, extreme weather, and bizarre plant life.' },
      { id: 'animal-behavior', name: 'Animal Behavior', emoji: '\ud83d\udc3e', desc: 'Animal intelligence, pet psychology, and conservation.' },
      { id: 'neuroscience', name: 'Neuroscience', emoji: '\ud83e\udde0', desc: 'Memory, dreaming, and neuroplasticity.' },
    ],
  },
  {
    id: 'history-mythology',
    name: 'History & Mythology',
    emoji: '\ud83c\udfdb\ufe0f',
    subtopics: [
      { id: 'ancient-civs', name: 'Ancient Civilizations', emoji: '\ud83c\udffa', desc: 'Everyday life in Rome, Pyramids, and lost cities.' },
      { id: 'modern-history', name: 'Modern History & Espionage', emoji: '\ud83d\udd75\ufe0f\u200d\u2642\ufe0f', desc: 'Cold War spy tactics, codebreaking, and famous heists.' },
      { id: 'mythology', name: 'Mythology & Folklore', emoji: '\ud83d\udc09', desc: 'Greek and Norse gods, urban legends, and cryptids.' },
      { id: 'alternate-history', name: 'Alternate History', emoji: '\ud83d\udd70\ufe0f', desc: 'What-if scenarios that reshape the world.' },
      { id: 'weird-history', name: 'Weird History', emoji: '\ud83d\udcdc', desc: 'Bizarre fashion, strange medicine, and forgotten figures.' },
    ],
  },
  {
    id: 'philosophy',
    name: 'Philosophy & Deep Thoughts',
    emoji: '\ud83d\udca1',
    subtopics: [
      { id: 'ethics', name: 'Ethics & Morality', emoji: '\u2696\ufe0f', desc: 'The Trolley Problem, cloning, and utilitarianism.' },
      { id: 'existentialism', name: 'Existentialism & Reality', emoji: '\ud83c\udf0c', desc: 'Simulation theory, meaning of life, and free will.' },
      { id: 'psychology', name: 'Human Psychology', emoji: '\ud83e\udde0', desc: 'Cognitive biases, happiness, and nature vs. nurture.' },
      { id: 'time', name: 'The Concept of Time', emoji: '\u23f3', desc: 'Time travel paradoxes and the butterfly effect.' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance & Economics',
    emoji: '\ud83d\udcb0',
    subtopics: [
      { id: 'personal-finance', name: 'Personal Finance', emoji: '\ud83d\udcb5', desc: 'FIRE movement, frugality, and budgeting hacks.' },
      { id: 'investing', name: 'Investing Strategies', emoji: '\ud83d\udcc8', desc: 'Real estate, stock market, and crypto.' },
      { id: 'global-economics', name: 'Global Economics', emoji: '\ud83c\udf0d', desc: 'UBI, inflation, and the diamond industry.' },
      { id: 'behavioral-econ', name: 'Behavioral Economics', emoji: '\ud83d\uded2', desc: 'How stores trick you and psychology of marketing.' },
    ],
  },
  {
    id: 'relationships',
    name: 'Relationships & Society',
    emoji: '\ud83e\udd1d',
    subtopics: [
      { id: 'modern-dating', name: 'Modern Dating', emoji: '\ud83d\udc98', desc: 'Dating apps, green/red flags, and LDRs.' },
      { id: 'friendship', name: 'Friendship Dynamics', emoji: '\ud83c\udf7b', desc: 'Making friends as an adult and chosen family.' },
      { id: 'generational', name: 'Generational Shifts', emoji: '\ud83d\udd04', desc: 'Gen Z vs. Millennials and the nostalgia cycle.' },
      { id: 'societal-norms', name: 'Societal Norms', emoji: '\ud83d\udde3\ufe0f', desc: 'Evolution of manners, cancel culture, and influencers.' },
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion & Aesthetics',
    emoji: '\ud83d\udc57',
    subtopics: [
      { id: 'streetwear', name: 'Streetwear & Sneaker Culture', emoji: '\ud83d\udc5f', desc: 'Psychology of hype, sneaker collecting, and vintage.' },
      { id: 'sustainable-fashion', name: 'Sustainable Fashion', emoji: '\u267b\ufe0f', desc: 'Fast fashion impact, upcycling, and capsule wardrobes.' },
      { id: 'high-fashion', name: 'High Fashion & History', emoji: '\ud83d\udc60', desc: 'Iconic runway moments and the Met Gala.' },
      { id: 'personal-style', name: 'Personal Style', emoji: '\u2728', desc: 'Color seasons, signature scents, and identity.' },
    ],
  },
  {
    id: 'home-lifestyle',
    name: 'Home & Lifestyle',
    emoji: '\ud83c\udfe0',
    subtopics: [
      { id: 'design-philosophy', name: 'Design Philosophies', emoji: '\ud83d\udecb\ufe0f', desc: 'Minimalism vs. Maximalism and color psychology.' },
      { id: 'sustainable-living', name: 'Sustainable Living', emoji: '\ud83c\udf0d', desc: 'Zero-waste, off-grid, and tiny house movement.' },
      { id: 'daily-routines', name: 'Daily Routines', emoji: '\u2615', desc: 'Biohacking, morning routines, and sleep hygiene.' },
      { id: 'pet-culture', name: 'Pet Culture', emoji: '\ud83d\udc36', desc: 'Breeding ethics, exotic pets, and brain chemistry.' },
    ],
  },
  {
    id: 'unexplained',
    name: 'The Unexplained & Mysticism',
    emoji: '\ud83d\udc7b',
    subtopics: [
      { id: 'paranormal', name: 'Paranormal Experiences', emoji: '\ud83c\udfe1', desc: 'Haunted locations, ghost hunting, and spooky stories.' },
      { id: 'ufos', name: 'UFOs & UAPs', emoji: '\ud83d\udef8', desc: 'Declassified documents, Roswell, and close encounters.' },
      { id: 'psych-mysteries', name: 'Psychological Mysteries', emoji: '\ud83c\udf00', desc: 'The Mandela Effect, d\u00e9j\u00e0 vu, and synchronicity.' },
      { id: 'astrology', name: 'Astrology & Divination', emoji: '\ud83d\udd2e', desc: 'Birth charts, tarot cards, and horoscopes.' },
    ],
  },
  {
    id: 'education',
    name: 'Education & Learning',
    emoji: '\ud83c\udf93',
    subtopics: [
      { id: 'alt-schooling', name: 'Alternative Schooling', emoji: '\ud83c\udfeb', desc: 'Homeschooling, Montessori, and unschooling.' },
      { id: 'languages', name: 'Language Acquisition', emoji: '\ud83d\udde3\ufe0f', desc: 'Immersion, hardest languages, and conlangs.' },
      { id: 'higher-ed', name: 'The Future of Higher Ed', emoji: '\ud83d\udcdc', desc: 'Is a degree still worth it? Trade schools and prestige.' },
      { id: 'lifelong-learning', name: 'Lifelong Learning', emoji: '\ud83e\udde0', desc: 'New skills as an adult, MasterClass, and YouTube.' },
      { id: 'memory', name: 'Memory & Cognition', emoji: '\ud83e\udde9', desc: 'Memory palaces, spaced repetition, and speed-reading.' },
    ],
  },
  {
    id: 'internet-culture',
    name: 'Internet Culture',
    emoji: '\ud83c\udf10',
    subtopics: [
      { id: 'viral', name: 'Viral Dynamics', emoji: '\ud83d\udcc8', desc: 'Meme life cycles, algorithms, and TikTok challenges.' },
      { id: 'content-creation', name: 'Content Creation', emoji: '\ud83c\udfa5', desc: 'YouTube, Twitch streaming, and influencer burnout.' },
      { id: 'online-communities', name: 'Niche Online Communities', emoji: '\ud83d\udc7e', desc: 'Reddit lore, rabbit holes, and extreme fandoms.' },
      { id: 'digital-privacy', name: 'Digital Privacy', emoji: '\ud83d\udd12', desc: 'Digital footprints, Dead Internet theory, and ads.' },
      { id: 'cybersecurity', name: 'Cybersecurity & Hacking', emoji: '\ud83d\udcbb', desc: 'Social engineering, data breaches, and the dark web.' },
    ],
  },
  {
    id: 'mental-health',
    name: 'Mental Health & Wellness',
    emoji: '\ud83e\uddd8',
    subtopics: [
      { id: 'therapy', name: 'Therapy & Counseling', emoji: '\ud83d\udecb\ufe0f', desc: 'CBT, EMDR, and breaking the stigma.' },
      { id: 'mindfulness', name: 'Mindfulness in Practice', emoji: '\ud83c\udf3f', desc: 'Breathwork, sound baths, and Vipassana retreats.' },
      { id: 'emotional-iq', name: 'Emotional Intelligence', emoji: '\u2764\ufe0f', desc: 'Attachment styles, shadow work, and boundaries.' },
      { id: 'alt-therapies', name: 'Alternative Therapies', emoji: '\ud83c\udfa8', desc: 'Music therapy, art therapy, and equine therapy.' },
      { id: 'stress', name: 'Stress Mechanics', emoji: '\ud83d\udc86', desc: 'Chronic stress, ASMR, and coping mechanisms.' },
    ],
  },
  {
    id: 'transportation',
    name: 'Transportation & Mobility',
    emoji: '\ud83d\ude97',
    subtopics: [
      { id: 'urban-transit', name: 'Urban Transit', emoji: '\ud83d\ude87', desc: '15-minute cities, high-speed rail, and subways.' },
      { id: 'aviation', name: 'Aviation & Aerospace', emoji: '\u2708\ufe0f', desc: 'Becoming a pilot, disasters, and supersonic flight.' },
      { id: 'auto-future', name: 'The Automotive Future', emoji: '\ud83d\udd0b', desc: 'Self-driving cars, hydrogen vs. electric, and manuals.' },
      { id: 'micromobility', name: 'Micromobility', emoji: '\ud83d\udef4', desc: 'E-bikes, scooters, and urban infrastructure.' },
      { id: 'maritime', name: 'Maritime Logistics', emoji: '\ud83d\udea2', desc: 'Megaships, cargo freighters, and global shipping.' },
    ],
  },
  {
    id: 'humor',
    name: 'Humor & Comedy',
    emoji: '\ud83c\udfad',
    subtopics: [
      { id: 'standup', name: 'Stand-up Culture', emoji: '\ud83c\udfa4', desc: 'Evolution of stand-up and writing a tight five.' },
      { id: 'satire', name: 'Satire & Parody', emoji: '\ud83e\udd21', desc: 'The Onion, satirical news, and spoof movies.' },
      { id: 'dark-comedy', name: 'Dark & Taboo Comedy', emoji: '\ud83d\udc80', desc: 'Where is the line? Morbid humor as coping.' },
      { id: 'improv', name: 'Improv & Sketch', emoji: '\ud83c\udfac', desc: 'The Yes-and philosophy and the history of SNL.' },
      { id: 'global-humor', name: 'Global Humor', emoji: '\ud83c\udf0d', desc: 'Lost in translation: British dry wit vs. slapstick.' },
    ],
  },
  {
    id: 'social-impact',
    name: 'Social Impact & Activism',
    emoji: '\ud83c\udf0d',
    subtopics: [
      { id: 'environmentalism', name: 'Modern Environmentalism', emoji: '\ud83c\udf31', desc: 'Ocean cleanup, carbon offsetting, and greenwashing.' },
      { id: 'community-action', name: 'Community Action', emoji: '\ud83e\udd1d', desc: 'Mutual aid, community fridges, and Peace Corps.' },
      { id: 'human-rights', name: 'Human Rights Debates', emoji: '\u2696\ufe0f', desc: 'Wealth inequality, free speech, and accessibility.' },
      { id: 'philanthropy', name: 'Philanthropy & Giving', emoji: '\ud83d\udcb8', desc: 'Effective Altruism, micro-lending, and billionaires.' },
      { id: 'animal-rights', name: 'Animal Rights', emoji: '\ud83d\udc3e', desc: 'Factory farming, animal testing, and the ivory trade.' },
    ],
  },
  {
    id: 'survival',
    name: 'Survival & Bushcraft',
    emoji: '\ud83c\udfd5\ufe0f',
    subtopics: [
      { id: 'wilderness', name: 'Wilderness Survival', emoji: '\ud83c\udf32', desc: 'Foraging, building shelters, and water purification.' },
      { id: 'doomsday', name: 'Prep & Doomsday', emoji: '\ud83c\udf92', desc: 'Bug-out bags, bunkers, and EMP preparation.' },
      { id: 'navigation', name: 'Old-World Navigation', emoji: '\ud83e\udded', desc: 'Orienteering, sextants, and topographical maps.' },
      { id: 'first-aid', name: 'First Aid & Rescue', emoji: '\ud83d\ude91', desc: 'Wilderness medicine and search-and-rescue ops.' },
      { id: 'primitive-skills', name: 'Primitive Skills', emoji: '\ud83d\udd25', desc: 'Friction fire, flint knapping, and trapping.' },
    ],
  },
  {
    id: 'language-comm',
    name: 'Language & Communication',
    emoji: '\ud83d\udde3\ufe0f',
    subtopics: [
      { id: 'linguistics', name: 'Linguistics & Evolution', emoji: '\ud83d\udc12', desc: 'How languages change, dead languages, and swear word origins.' },
      { id: 'nonverbal', name: 'Nonverbal Communication', emoji: '\ud83d\udc41\ufe0f', desc: 'Body language, micro-expressions, and cultural gestures.' },
      { id: 'public-speaking', name: 'Public Speaking', emoji: '\ud83c\udfa4', desc: 'Stage fright, TED Talks, and debate tactics.' },
      { id: 'dialects', name: 'Dialects & Accents', emoji: '\ud83d\uddfa\ufe0f', desc: 'Regional slang, code-switching, and old Hollywood.' },
      { id: 'translation', name: 'The Art of Translation', emoji: '\ud83d\udcd6', desc: 'Translating poetry and AI vs. human nuance.' },
    ],
  },
]

export function getTopicById(topicId) {
  return TOPICS.find((t) => t.id === topicId)
}

// Get subtopics across multiple topics
export function getSubtopicsForTopics(topicIds) {
  return TOPICS
    .filter((t) => topicIds.includes(t.id))
    .flatMap((t) => t.subtopics.map((s) => ({ ...s, topicId: t.id, topicName: t.name, topicEmoji: t.emoji })))
}
