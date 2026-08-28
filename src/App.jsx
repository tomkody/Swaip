import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import CreateMovieRoom from './pages/CreateMovieRoom'
import CreateSeriesRoom from './pages/CreateSeriesRoom'
import CreateConversationRoom from './pages/CreateConversationRoom'
import CreateActivityRoom from './pages/CreateActivityRoom'
import CreateFoodRoom from './pages/CreateFoodRoom'
import Room from './pages/Room'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import ThemeToggle from './components/ThemeToggle'
import './App.css'

export default function App() {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <div className="app">
      {!isLanding && <ThemeToggle />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create/movies" element={<CreateMovieRoom />} />
        <Route path="/create/series" element={<CreateSeriesRoom />} />
        <Route path="/create/conversations" element={<CreateConversationRoom />} />
        <Route path="/create/activities" element={<CreateActivityRoom />} />
        <Route path="/create/food" element={<CreateFoodRoom />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
