import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './pages/Navigation';
import Home from './pages/Home';
import Diary from './pages/Diary';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  return (
    <Router>
      <Navigation />
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>
    </Router>
  )
}