import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOPICS } from '../lib/topics'
import { createConversationRoom, getUserToken } from '../lib/room'
import ModeToggle from '../components/ModeToggle'
import './CreateConversationRoom.css'
import AppHeader from '../components/AppHeader'

export default function CreateConversationRoom() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [solo, setSolo] = useState(false)

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
      const room = await createConversationRoom(topicIds, topicNames, { solo })
      navigate(`/room/${room.id}`, { state: { isCreator: true, isSolo: solo } })
    } catch (err) {
      console.error('Failed to create room:', err)
      alert('Failed to create room. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-conv">
      <AppHeader onBack={() => navigate('/')} backLabel="Back to home" />

      <div className="conv-hero">
        <div className="conv-hero-icon" aria-hidden="true">💬</div>
        <h1>Conversations</h1>
      </div>

      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        <ModeToggle solo={solo} onChange={setSolo} />
      </div>

      <p className="subtitle">
        {solo
          ? 'Pick topics you\'re curious about and get conversation prompts just for you.'
          : 'Choose one or more topics to explore together'}
      </p>

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
          : solo
            ? `Start${selected.size > 0 ? ` (${selected.size} topic${selected.size !== 1 ? 's' : ''})` : ''}`
            : `Create Room${selected.size > 0 ? ` (${selected.size} topic${selected.size !== 1 ? 's' : ''})` : ''}`}
      </button>
    </div>
  )
}
