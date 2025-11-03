import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import './styles/responsive.css'; // 모바일 반응형 스타일
import Navigation from './pages/Navigation';
import Home from './pages/Home';
import Diary from './pages/Diary';
import Chat from './pages/Chat';
import Online from './pages/Online';
import Login from './pages/Login';
import Register from './pages/Register';
import OrbShowcase from './pages/OrbShowcase';


export default function App() {
  return (
    <Router>
      <Navigation />
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/online" element={<Online />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/orb-showcase" element={<OrbShowcase />} />
        </Routes>
      </div>
    </Router>
  )
}