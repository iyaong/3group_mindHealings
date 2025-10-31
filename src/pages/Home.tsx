// Home.tsx
// 토닥톡 홈페이지에 접속했을 때 첫 화면입니다.
// AI와 대화할 수 있습니다.

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();
    
    // 사용자가 입력하는 텍스트를 관리하는 state
    const [inputText, setInputText] = useState("");

    // firstChat: 처음으로 input에서 Enter를 눌렀을 때
    const firstChat = (event: React.FormEvent<HTMLFormElement>) => {
        // 새로고침 방지
        event.preventDefault();
        
        // 입력값이 비어있으면 무시
        const text = inputText.trim();
        if (!text) return;
        
        // 입력한 텍스트를 state로 전달하면서 /chat 으로 이동
        navigate('/chat', { state: { initialMessage: text } });
    }

    return (
        <>
        <div id="homeWrap" style={{ width: '100%', minHeight: 'calc(100vh - 56px)', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)' }}>
            <div className="mainview" style={{ width: 'min(720px, 92%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>오늘 하루는 어땠나요?</div>
                    <div style={{ fontSize: 16, color: '#4b5563', marginTop: 6 }}>당신의 이야기를 들려주세요</div>
                </div>
                <form onSubmit={firstChat} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="한 줄로 시작해 보세요…"
                        style={{
                            width: '100%', maxWidth: 540,
                            padding: '12px 16px',
                            borderRadius: 999,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.04)',
                            outline: 'none'
                        }}
                    />
                </form>
            </div>
        </div>
        </>
    )
}