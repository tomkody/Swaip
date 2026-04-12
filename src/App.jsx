import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import CreateMovieRoom from './pages/CreateMovieRoom'
import CreateSeriesRoom from './pages/CreateSeriesRoom'
import CreateConversationRoom from './pages/CreateConversationRoom'
import CreateActivityRoom from './pages/CreateActivityRoom'
import Room from './pages/Room'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create/movies" element={<CreateMovieRoom />} />
        <Route path="/create/series" element={<CreateSeriesRoom />} />
        <Route path="/create/conversations" element={<CreateConversationRoom />} />
        <Route path="/create/activities" element={<CreateActivityRoom />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
