import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { initAnalytics } from './lib/analytics'
import { initHistorySync } from './lib/savedMatches'
import { initMonitoring } from './lib/monitoring'
import { ensureSession } from './lib/supabase'

// Both are no-ops until their env vars are set (see .env.example).
initAnalytics()
initMonitoring()
// Start the anonymous sign-in immediately: row-level security matches rooms
// against this identity, and the promise is cached so everything that follows
// just awaits the same one. Never blocks rendering.
ensureSession()
initHistorySync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
