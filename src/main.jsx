import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { initAnalytics } from './lib/analytics'
import { initHistorySync } from './lib/savedMatches'
import { initMonitoring } from './lib/monitoring'

// Both are no-ops until their env vars are set (see .env.example).
initAnalytics()
initMonitoring()
// The anonymous sign-in starts in App on the pages that need it (a room, a
// create page), not here: run for every visitor, it turned each landing-page
// view into a monthly active user against the Free plan's 50,000.
initHistorySync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
