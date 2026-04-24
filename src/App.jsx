import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import CreateMovieRoom from './pages/CreateMovieRoom'
import CreateSeriesRoom from './pages/CreateSeriesRoom'
import CreateConversationRoom from './pages/CreateConversationRoom'
import CreateActivityRoom from './pages/CreateActivityRoom'
import CreateFoodRoom from './pages/CreateFoodRoom'
import Room from './pages/Room'
import TripHome from './pages/trip/TripHome'
import PlanningWizard from './pages/trip/PlanningWizard'
import TripDashboard from './pages/trip/TripDashboard'
import ThemeToggle from './components/ThemeToggle'
import './App.css'

export default function App() {
  const location = useLocation()
  const isTripRoute = location.pathname.startsWith('/trip')
  const isLanding = location.pathname === '/'

  return (
    <div className="app">
      {!isTripRoute && !isLanding && <ThemeToggle />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create/movies" element={<CreateMovieRoom />} />
        <Route path="/create/series" element={<CreateSeriesRoom />} />
        <Route path="/create/conversations" element={<CreateConversationRoom />} />
        <Route path="/create/activities" element={<CreateActivityRoom />} />
        <Route path="/create/food" element={<CreateFoodRoom />} />
        <Route path="/room/:roomId" element={<Room />} />
        {/* Trip Planner */}
        <Route path="/trip" element={<TripHome />} />
        <Route path="/trip/plan" element={<PlanningWizard />} />
        <Route path="/trip/dashboard" element={<TripDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
