import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOPICS } from '../lib/topics'
import { createConversationRoom, getUserToken } from '../lib/room'
import './CreateConversationRoom.css'

export default function CreateConversationRoom() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)

  function toggleTopic(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (selected.size === 0) return
    setLoading(true)
    try {
      getUserToken()
      const topicIds = [...selected]
      const topicNames = topicIds
        .map((id) => TOPICS.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .join(', ')
      const room = await createConversationRoom(topicIds, topicNames)
      navigate(`/room/${room.id}`, { state: { isCreator: true } })
    } catch (err) {
      console.error('Failed to create room:', err)
      alert('Failed to create room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-conv">
      <button className="back-btn" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <h1>Pick Topics</h1>
      <p className="subtitle">Choose one or more topics to explore together</p>

      <div className="topic-grid">
        {TOPICS.map((topic) => (
          <button
            key={topic.id}
            className={`topic-card ${selected.has(topic.id) ? 'selected' : ''}`}
            onClick={() => toggleTopic(topic.id)}
          >
            {selected.has(topic.id) && <span className="topic-check">✓</span>}
            <span className="topic-emoji">{topic.emoji}</span>
            <span className="topic-name">{topic.name}</span>
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary create-btn"
        disabled={selected.size === 0 || loading}
        onClick={handleCreate}
      >
        {loading
          ? 'Creating...'
          : `Create Room${selected.size > 0 ? ` (${selected.size} topic${selected.size !== 1 ? 's' : ''})` : ''}`}
      </button>
    </div>
  )
}
