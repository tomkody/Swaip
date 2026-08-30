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
initHistorySync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
