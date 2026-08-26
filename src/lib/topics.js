// Conversation topics for Swaip.
//
// Shape: TOPICS = [{ id, name, emoji, subtopics: [{ id, name, emoji, desc, questions: [] }] }]
// Flow: users pick top-level topics → swipe the subtopics → matched subtopics
// reveal their questions. Questions are the payoff, so they're written to spark
// a real back-and-forth between two people: provocative claims, moral dilemmas,
// would-you-rathers with stakes, and personal reveals — varied in form, not a
// single "is X or Y?" formula.

export const TOPICS = [
  {
    id: 'love-desire',
    name: 'Love & Desire',
    emoji: '💘',
    subtopics: [
      { id: 'what-love-is', name: 'What Love Really Is', emoji: '💞', desc: 'The nature of love itself.', questions: [
        'Do we love people for who they truly are, or for how they make us feel about ourselves?',
        'If a pill could make you instantly fall out of love with someone who was wrong for you, would you take it?',
        'Is it possible to love two people equally at the same time — and would you even want to be capable of that?',
      ] },
      { id: 'commitment', name: 'Commitment & Forever', emoji: '💍', desc: 'Monogamy, marriage, and staying.', questions: [
        'Is lifelong monogamy our natural state, or a beautiful thing we have to fight our own nature to keep?',
        'If you knew for certain a relationship would end in heartbreak in exactly five years, would you still begin it?',
        'Would you rather a partner who is brutally honest and sometimes hurts you, or kind and occasionally lies to protect you?',
      ] },
      { id: 'jealousy-trust', name: 'Jealousy & Trust', emoji: '🔥', desc: 'Betrayal, security, and forgiveness.', questions: [
        'Is jealousy proof of how much you care, or just a failure of your own security?',
        'Can trust ever fully return after one betrayal, or is it always quietly cracked from then on?',
        'Is an emotional affair worse than a physical one?',
      ] },
      { id: 'attraction', name: 'Attraction', emoji: '🧲', desc: 'Chemistry, type, and the spark.', questions: [
        'Could you fall for someone you found physically unremarkable but who understood you completely?',
        'How much of who we are attracted to is a real choice, versus wiring we never agreed to?',
        'Is "the spark" real and necessary, or a feeling we have been taught to overvalue?',
      ] },
      { id: 'dating-today', name: 'Dating Today', emoji: '📱', desc: 'Apps, honesty, and the past.', questions: [
        'Has endless choice on dating apps made us better at finding love, or worse at keeping it?',
        'Should you tell a partner every detail of your past, or is some mystery actually healthier?',
        'Would you want an honest list of everything a partner had ever done — or is some ignorance a gift?',
      ] },
    ],
  },
  {
    id: 'right-wrong',
    name: 'Right & Wrong',
    emoji: '⚖️',
    subtopics: [
      { id: 'dilemmas', name: 'Impossible Choices', emoji: '🚃', desc: 'Moral dilemmas with no clean answer.', questions: [
        'Would you kill one innocent stranger to save five? Does having to push them yourself change your answer?',
        'Is it ever right to break a promise to a dying person if keeping it would hurt the living?',
        'You find a wallet with a fortune inside and no way to be caught. What you do next — what does it say about you?',
      ] },
      { id: 'justice', name: 'Justice & Punishment', emoji: '🏛️', desc: 'Crime, revenge, and second chances.', questions: [
        'Should a genuinely reformed person still be punished for something terrible they did decades ago?',
        'Is revenge ever justice, or always just a second wrong dressed up as one?',
        'Would a world with no punishment — only rehabilitation — be more just, or more dangerous?',
      ] },
      { id: 'good-evil', name: 'Good & Evil', emoji: '😇', desc: 'Human nature at its roots.', questions: [
        'Are people born good and corrupted by the world, or born selfish and civilised by it?',
        'Could you have become a monster if you had been born into the wrong time and place?',
        'Is anyone ever truly beyond forgiveness?',
      ] },
      { id: 'honesty', name: 'Honesty & Lies', emoji: '🤥', desc: 'Truth, kindness, and self-deception.', questions: [
        'Is a lie that protects someone forever better than a truth that frees you but wounds them?',
        'Would you want to know a hard truth about yourself that everyone sees but no one will say?',
        'Is there any such thing as a truly selfless good deed?',
      ] },
      { id: 'money-ethics', name: 'Money & Conscience', emoji: '💸', desc: 'Wealth and where you draw the line.', questions: [
        'Is it possible to be extremely rich and fully ethical at the same time?',
        'Would you take a job that tripled your pay but made the world a little worse?',
        'Is buying your way out of guilt — offsets, donations — real virtue or just bought comfort?',
      ] },
    ],
  },
  {
    id: 'who-you-are',
    name: 'Who You Are',
    emoji: '🧠',
    subtopics: [
      { id: 'identity', name: 'Identity & Self', emoji: '🪞', desc: 'What makes you, you.', questions: [
        'If every one of your memories were erased, would you still be you?',
        'Which is the real you — how you act completely alone, or how you act around others?',
        'Are you the same person you were ten years ago, or just someone who shares their name?',
      ] },
      { id: 'fear-regret', name: 'Fears & Regret', emoji: '😰', desc: 'What haunts and holds you back.', questions: [
        'Would you rather live with the regret of something you did, or something you never dared to try?',
        'What is a fear you have that you know is irrational but still cannot shake?',
        'If you could erase your single most shameful memory, would the relief be worth losing what it taught you?',
      ] },
      { id: 'change-growth', name: 'Change & Growth', emoji: '🌱', desc: 'Whether people really change.', questions: [
        'What is a belief you once held with total certainty that you have completely abandoned?',
        'Can people truly change their core nature, or only get better at managing it?',
        'Is the person you are becoming someone your younger self would admire — or not even recognise?',
      ] },
      { id: 'the-mind', name: 'The Mind', emoji: '💭', desc: 'Copies, illusions, and control.', questions: [
        'If a perfect copy of you were made — memories and all — which one is the real you?',
        'Would you plug into a machine that gave you a perfect, happy life you knew was fake?',
        'Do you control your thoughts, or do they just happen to you and you take the credit?',
      ] },
      { id: 'worth', name: 'Success & Worth', emoji: '🏆', desc: 'How you measure a life.', questions: [
        'Is your worth measured by what you achieve, or by who you are when you achieve nothing?',
        'Would you rather be widely admired but privately lonely, or deeply loved by a few and unknown to everyone else?',
        'Whose definition of a "successful life" are you actually chasing — yours, or someone else’s?',
      ] },
    ],
  },
  {
    id: 'life-death',
    name: 'Life & Death',
    emoji: '⏳',
    subtopics: [
      { id: 'meaning', name: 'Meaning', emoji: '✨', desc: 'Why any of this matters.', questions: [
        'If there is no grand purpose to life, is that terrifying or freeing?',
        'Would a life of pure comfort and pleasure feel meaningful, or do you need struggle to make it matter?',
        'Do we find meaning, or do we invent it and then forget that we did?',
      ] },
      { id: 'mortality', name: 'Mortality', emoji: '💀', desc: 'Death, and how it shapes life.', questions: [
        'If you could know the exact date of your death, would you want to?',
        'Would you accept immortality if everyone you loved still aged and died around you?',
        'Does knowing life ends make it precious, or is that just a story we tell ourselves to cope?',
      ] },
      { id: 'time', name: 'Time', emoji: '🕰️', desc: 'The past, the moment, the future.', questions: [
        'Would you relive the best day of your life on loop forever, or never feel it again but keep moving forward?',
        'If you could send one sentence to your fifteen-year-old self — knowing it might erase who you became — would you?',
        'Do you live mostly in the past, the present, or the future — and did you ever choose that?',
      ] },
      { id: 'legacy', name: 'Legacy', emoji: '🌳', desc: 'What you leave behind.', questions: [
        'Would you rather be completely forgotten but have lived fully, or remembered for centuries for one thing you are not proud of?',
        'What do you want to be true about you after you are gone that is not quite true yet?',
        'Is wanting to "leave a mark" meaningful, or just the ego refusing to accept that it ends?',
      ] },
      { id: 'happiness', name: 'Happiness', emoji: '☀️', desc: 'What a good life feels like.', questions: [
        'Is it better to be a satisfied fool or a dissatisfied genius?',
        'Would you trade ten ordinary years for one extraordinary one?',
        'Can you be genuinely happy while the people around you are suffering?',
      ] },
    ],
  },
  {
    id: 'the-future',
    name: 'The Future',
    emoji: '🤖',
    subtopics: [
      { id: 'ai-and-us', name: 'AI & Us', emoji: '🧬', desc: 'Machines, minds, and meaning.', questions: [
        'If an AI wrote a poem that moved you to tears, would it matter that nothing actually felt it?',
        'Would you want an AI that knew you better than your partner does?',
        'When machines can do everything better than us, what is left that makes us matter?',
      ] },
      { id: 'simulation', name: 'Reality & Illusion', emoji: '🕳️', desc: 'What if none of this is real.', questions: [
        'If we are living in a simulation and everything feels exactly the same, does it change how you would live?',
        'Would you actually want to know the truth if reality turned out to be fake?',
        'Is a beautiful illusion always worse than an ugly truth?',
      ] },
      { id: 'connection', name: 'Screens & Connection', emoji: '📵', desc: 'What technology does to us.', questions: [
        'Has technology brought us closer together, or just made us better at being alone?',
        'Would you give up your phone for a whole year for a large sum of money — and what would you lose besides convenience?',
        'Should there be things about you the internet is simply never allowed to know?',
      ] },
      { id: 'progress', name: 'Progress', emoji: '⚙️', desc: 'Whether newer is really better.', questions: [
        'Is every technological advance worth it, or have some "improvements" quietly made life worse?',
        'Would you freeze technology at today’s level forever if it guaranteed stability?',
        'Just because we can build something, does it mean we should?',
      ] },
      { id: 'humanitys-path', name: "Humanity's Path", emoji: '🌍', desc: 'Where we are all headed.', questions: [
        'Are we the ancestors future generations will thank, or the ones they will blame?',
        'If you could press a button to reset civilisation and start over, would you?',
        'Is humanity genuinely getting better, or just better at hiding the same old flaws?',
      ] },
    ],
  },
  {
    id: 'society-power',
    name: 'Society & Power',
    emoji: '🏛️',
    subtopics: [
      { id: 'freedom-safety', name: 'Freedom vs Safety', emoji: '🔓', desc: 'What you would trade, and for what.', questions: [
        'Would you trade some freedom for a real guarantee of safety? How much?',
        'Should people be free to make choices that clearly harm only themselves?',
        'Is total freedom even desirable, or does it just hand the world to whoever is strongest?',
      ] },
      { id: 'fairness', name: 'Fairness', emoji: '⚖️', desc: 'Luck, merit, and what we owe.', questions: [
        'Is it fairer to treat everyone identically, or to give more to those who started with less?',
        'Does anyone truly "deserve" their success, or is most of it luck we quietly take credit for?',
        'Would you accept less for yourself if it genuinely meant a fairer world for everyone?',
      ] },
      { id: 'truth-belief', name: 'Truth & Belief', emoji: '📰', desc: 'How we decide what is real.', questions: [
        'Can facts actually change someone’s mind, or do we only ever believe what we already wanted to?',
        'Would you rather be comfortably wrong alongside your community, or lonely and right?',
        'Should any idea be off-limits, or is every idea worth arguing with?',
      ] },
      { id: 'individual-group', name: 'The One & The Many', emoji: '👥', desc: 'Belonging versus thinking for yourself.', questions: [
        'When does loyalty to your group become a refusal to think for yourself?',
        'Would you speak an unpopular truth if it cost you every friend you have?',
        'Are we more ourselves in a crowd, or more lost in one?',
      ] },
      { id: 'wealth-status', name: 'Wealth & Status', emoji: '💎', desc: 'Money, and what it says about us.', questions: [
        'Is a world with billionaires and deep poverty ever acceptable, no matter how it came about?',
        'Do we chase money for what it buys, or for what it says about us?',
        'Would you rather have status you did not earn, or excellence that no one ever notices?',
      ] },
    ],
  },
  {
    id: 'the-unknown',
    name: 'The Unknown',
    emoji: '🌌',
    subtopics: [
      { id: 'god-belief', name: 'God & Belief', emoji: '🙏', desc: 'Faith, doubt, and meaning.', questions: [
        'Would you actually want there to be a God who sees everything you do?',
        'Can someone be deeply moral without believing in anything beyond this life?',
        'Is faith a kind of courage, or a way of avoiding the hardest questions?',
      ] },
      { id: 'aliens-cosmos', name: 'Aliens & The Cosmos', emoji: '👽', desc: 'Our place in a vast universe.', questions: [
        'What is more unsettling: that we are alone in the universe, or that we are not?',
        'If we found intelligent alien life, would it bring humanity together or tear it apart?',
        'Does the sheer size of the universe make your problems feel smaller, or make you feel meaningless?',
      ] },
      { id: 'consciousness', name: 'Consciousness', emoji: '💫', desc: 'The strangest thing you have.', questions: [
        'How do you know anyone else is truly conscious, and not just convincingly acting like it?',
        'Could something we build ever truly "wake up" — and how would we ever know?',
        'Where do "you" actually live — in your brain, or somewhere harder to point at?',
      ] },
      { id: 'fate-chance', name: 'Fate & Chance', emoji: '🎲', desc: 'Free will and coincidence.', questions: [
        'Is everything that happens to you the result of your choices, or were you always going to end up here?',
        'If free will were proven to be an illusion, would you live any differently?',
        'Do you believe some people are "meant" to be in your life, or is that just a story we tell about coincidence?',
      ] },
      { id: 'mysterious', name: 'The Mysterious', emoji: '🔮', desc: 'The things we cannot explain.', questions: [
        'Have you ever experienced something you genuinely cannot explain — and did you want an explanation?',
        'Is it healthier to believe in a little magic, or to fully accept a world with none?',
        'Why do we crave mysteries, then feel let down the moment they are solved?',
      ] },
    ],
  },
  {
    id: 'taste-culture',
    name: 'Taste & Culture',
    emoji: '🎭',
    subtopics: [
      { id: 'art-beauty', name: 'Art & Beauty', emoji: '🎨', desc: 'What makes something worth it.', questions: [
        'Is something beautiful on its own, or only because we all agree that it is?',
        'Can art made by a terrible person still be great — and can you separate the two?',
        'Would a famous masterpiece move you at all if no one had ever told you it mattered?',
      ] },
      { id: 'what-we-consume', name: 'What We Consume', emoji: '📺', desc: 'The stories that shape us.', questions: [
        'Is a "guilty pleasure" something to enjoy freely, or does what you love quietly say who you are?',
        'Would you rather a story with a devastating ending you never forget, or a happy one you barely remember?',
        'Do the things we watch and listen to shape who we become, or just reflect who we already are?',
      ] },
      { id: 'authenticity', name: 'Authenticity', emoji: '🪞', desc: 'Being real in a performed world.', questions: [
        'Is anyone ever truly original, or are we all just remixing what came before us?',
        'Would you rather be authentic and disliked, or likeable and performing?',
        'Has the pressure to be "authentic" online just become another kind of performance?',
      ] },
      { id: 'nostalgia', name: 'Nostalgia', emoji: '📼', desc: 'The pull of the past.', questions: [
        'Was the past actually better, or do we just quietly delete the bad parts?',
        'Would you relive one year of your life exactly as it was, knowing you could not change a thing?',
        'Why does missing a time you can never return to feel strangely good?',
      ] },
      { id: 'humor', name: 'Humour', emoji: '😂', desc: 'What we laugh at, and why.', questions: [
        'Is there anything that should never, ever be joked about?',
        'Does what someone finds funny reveal more about them than what they take seriously?',
        'Can a joke be so wrong it becomes right — or is that just an excuse?',
      ] },
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
