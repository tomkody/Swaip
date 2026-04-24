const SYSTEM_PROMPT = `You are an expert travel planner. Return ONLY valid JSON, no markdown, no explanation.`

function getDayCount(start, end) {
  const diff = new Date(end) - new Date(start)
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)))
}

function buildTripPrompt(form) {
  const dest =
    typeof form.destination === 'object'
      ? form.destination.formattedAddress
      : form.destination
  const days = getDayCount(form.startDate, form.endDate)
  const centerLat = form.destination?.lat ?? ''
  const centerLng = form.destination?.lng ?? ''
  const prefStr = (form.preferences || []).join(', ')

  return `Create a ${days}-day travel itinerary for ${dest}.
Dates: ${form.startDate} to ${form.endDate}
Transport at destination: ${form.transport}
Interests: ${prefStr}
Budget style: ${form.budget}
City coordinates (center): ${centerLat}, ${centerLng}

Rules:
- Each day should have 4-6 activities, logically ordered by location to minimise travel
- Activities MUST have accurate real-world lat/lng coordinates close to ${centerLat}, ${centerLng}
- Times should flow naturally from morning to evening
- Tailor activities to the interests: ${prefStr}
- Budget style "${form.budget}" should influence venue choices and price level
- packingList should be specific to destination climate, activities, and trip style
- Include 5-8 bookable experiences in the experiences array

Return exactly this JSON (no markdown, no extra keys):
{
  "destination": "City, Country",
  "tagline": "One catchy sentence about this specific trip",
  "days": [
    {
      "dayNumber": 1,
      "date": "${form.startDate}",
      "theme": "Short theme title",
      "activities": [
        {
          "time": "09:00",
          "name": "Place name",
          "description": "2-3 engaging sentences about this place.",
          "duration": "1.5 hours",
          "category": "history",
          "lat": 0.0,
          "lng": 0.0,
          "insiderTip": "One practical insider tip."
        }
      ]
    }
  ],
  "packingList": {
    "Clothing": ["item"],
    "Electronics": ["item"],
    "Documents": ["item"],
    "Health & Safety": ["item"],
    "Destination-specific": ["item"]
  },
  "experiences": [
    {
      "name": "Experience name",
      "description": "2 sentences about this experience.",
      "estimatedPrice": "$XX",
      "category": "art",
      "whyGoThere": "One sentence hook."
    }
  ],
  "weatherNote": "Brief weather expectation for ${form.startDate} in ${dest}.",
  "currencyTip": "Local currency name and one practical payment tip."
}`
}

function buildRegeneratePrompt(form, dayNumber, existingThemes) {
  const dest =
    typeof form.destination === 'object'
      ? form.destination.formattedAddress
      : form.destination
  const centerLat = form.destination?.lat ?? ''
  const centerLng = form.destination?.lng ?? ''
  const prefStr = (form.preferences || []).join(', ')

  return `Regenerate Day ${dayNumber} of a trip itinerary for ${dest}.
Transport: ${form.transport} | Interests: ${prefStr} | Budget: ${form.budget}
City coordinates: ${centerLat}, ${centerLng}
Already used themes (avoid repeating): ${existingThemes.join(', ')}

Return exactly this JSON for a single day object (no markdown):
{
  "dayNumber": ${dayNumber},
  "date": "",
  "theme": "New theme title",
  "activities": [
    {
      "time": "09:00",
      "name": "Place name",
      "description": "2-3 sentences.",
      "duration": "1.5 hours",
      "category": "history",
      "lat": 0.0,
      "lng": 0.0,
      "insiderTip": "One practical tip."
    }
  ]
}`
}

async function callOpenAI(prompt) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY is not set in your .env.local file.')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`)
  }

  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

export async function generateTrip(form) {
  const prompt = buildTripPrompt(form)
  return callOpenAI(prompt)
}

export async function regenerateDay(form, dayNumber, existingTrip) {
  const existingThemes = existingTrip.days
    .filter((d) => d.dayNumber !== dayNumber)
    .map((d) => d.theme)
  const prompt = buildRegeneratePrompt(form, dayNumber, existingThemes)
  const result = await callOpenAI(prompt)
  // Preserve the original date
  const originalDay = existingTrip.days.find((d) => d.dayNumber === dayNumber)
  return { ...result, date: originalDay?.date || result.date }
}
