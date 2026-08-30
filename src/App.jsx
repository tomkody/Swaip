import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import ThemeToggle from './components/ThemeToggle'
import './App.css'

// Route-level code-splitting: the landing page loads instantly from the main
// chunk; every other screen is fetched on demand. This keeps the first paint
// small — Room (and its swipe decks, canvas share code, etc.) is by far the
// heaviest tree and most visitors start on the landing page.
const CreateMovieRoom = lazy(() => import('./pages/CreateMovieRoom'))
const CreateSeriesRoom = lazy(() => import('./pages/CreateSeriesRoom'))
const CreateConversationRoom = lazy(() => import('./pages/CreateConversationRoom'))
const CreateActivityRoom = lazy(() => import('./pages/CreateActivityRoom'))
const CreateFoodRoom = lazy(() => import('./pages/CreateFoodRoom'))
const CreateColorGame = lazy(() => import('./pages/CreateColorGame'))
const Room = lazy(() => import('./pages/Room'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))

function RouteFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
      <div className="loader" />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <div className="app">
      {!isLanding && <ThemeToggle />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create/movies" element={<CreateMovieRoom />} />
          <Route path="/create/series" element={<CreateSeriesRoom />} />
          <Route path="/create/conversations" element={<CreateConversationRoom />} />
          <Route path="/create/activities" element={<CreateActivityRoom />} />
          <Route path="/create/food" element={<CreateFoodRoom />} />
          <Route path="/create/colorgame" element={<CreateColorGame />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}
