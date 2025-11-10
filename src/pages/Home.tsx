// Home.tsx
// 토닥톡 홈페이지에 접속했을 때 첫 화면입니다.
// AI와 대화할 수 있습니다.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StreakWidget from "../components/StreakWidget";
import HomeFeatures from "../components/HomeFeatures";
import './Home.css';

export default function Home() {
    const navigate = useNavigate();
    const [inputText, setInputText] = useState("");
    
    const firstChat = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const text = inputText.trim();
        if (!text) return;
        navigate('/chat', { state: { initialMessage: text, isNewChat: true } });
    }

    return (
        <>
            <div id="homeWrap" className="home-wrap-loggedout">
                <button className="orb-showcase-btn" onClick={() => navigate('/orb-showcase')}>✨ 3D Orb Showcase</button>
                <div className="mainview-logout">
                    <div style={{ width: '100%', maxWidth: 540 }}>
                        <StreakWidget />
                    </div>
                    <div className="home-hero">
                        <div className="home-title">오늘 하루는 어땠나요?</div>
                        <div className="home-subtitle">당신의 이야기를 들려주세요</div>
                    </div>
                    <form onSubmit={firstChat} className="home-form">
                        <input
                            className="home-input"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="한 줄로 시작해 보세요…"
                        />
                    </form>
                </div>
            </div>
            
            {/* 추가 기능 섹션들 */}
            <HomeFeatures />
        </>
    )
}