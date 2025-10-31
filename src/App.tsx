import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Navigation from './pages/Navigation';
import Home from './pages/Home';
import Diary from './pages/Diary';
import Chat from './pages/Chat';
import Online from './pages/Online';
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
          <Route path="/online" element={<Online />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>
    </Router>
  )
}