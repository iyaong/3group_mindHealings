import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DisplayProvider, useDisplay } from './contexts/DisplayContext';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';

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
import Support from './pages/Support';
import Subscription from './pages/Subscription';
import Onboarding from './components/Onboarding';


import './styles/theme.css'; // 디자인 시스템 테마
import './App.css';
import './styles/responsive.css'; // 모바일 반응형 스타일

export default function App() {

  return (
    <ErrorBoundary>
      <DisplayProvider>
        <AppMap />
      </DisplayProvider>
    </ErrorBoundary>
  )
}

function AppMap() {

  const { displayContent } = useDisplay();
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 온보딩 상태 확인 (로그인 후 & 처음 사용자)
  useEffect(() => {
    if (user) {
      const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');
      if (!hasCompletedOnboarding) {
        // 로그인 직후 약간의 딜레이를 주고 온보딩 표시
        setTimeout(() => {
          setShowOnboarding(true);
        }, 500);
      }
    }
  }, [user]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  return (
    <Router>
      <Navigation />
      {displayContent == "login" && <Login />}
      {displayContent == "register" && <Register />}
      <div style={{display: displayContent == "default" ? "block" : "none"}}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/online" element={<Online />} />
            <Route path="/support" element={<Support />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/orb-showcase" element={<OrbShowcase />} />
            <Route path="/history" element={<History />} />
            <Route path="/goals" element={<Goals />} />
          </Routes>
        </ErrorBoundary>
      </div>

      {/* 온보딩 오버레이 */}
      {showOnboarding && (
        <Onboarding 
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
    </Router>
  )

}