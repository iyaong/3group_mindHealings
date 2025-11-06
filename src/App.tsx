import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DisplayProvider, useDisplay } from './contexts/DisplayContext';

import Navigation from './pages/Navigation';
import Home from './pages/Home';
import Diary from './pages/Diary';
import Chat from './pages/Chat';
import Online from './pages/Online';
import Login from './pages/Login';
import Register from './pages/Register';
import OrbShowcase from './pages/OrbShowcase';
import History from './pages/History';
import Goals from './components/Goals';
import Profile from './pages/Profile';

import './styles/theme.css'; // 디자인 시스템 테마
import './App.css';
import './styles/responsive.css'; // 모바일 반응형 스타일

export default function App() {

  return (
    <DisplayProvider>
      <AppMap />
    </DisplayProvider>
  )
}

function AppMap() {

  const { displayContent } = useDisplay();

  return (
    <Router>
      <Navigation />
      {displayContent == "login" && <Login />}
      {displayContent == "register" && <Register />}
      <div style={{display: displayContent == "default" ? "block" : "none"}}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/online" element={<Online />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/orb-showcase" element={<OrbShowcase />} />
          <Route path="/history" element={<History />} />
          <Route path="/goals" element={<Goals />} />
        </Routes>
      </div>
    </Router>
  )

}