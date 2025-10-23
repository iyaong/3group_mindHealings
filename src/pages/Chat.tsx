// Chat.tsx
// 다른 사람들과 대화하는 채팅방입니다.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Chat() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [messages, setMessages] = useState<Array<{ _id?: string; text: string; createdAt: string }>>([]);
    const [text, setText] = useState("");
    const bottomRef = useRef<HTMLDivElement | null>(null);
    
    // <1> 대화 저장 팝업 활성화 상태
    const [displaySavePop, setDisplaySavePop] = useState(false);

    // chat: input에서 Enter을 눌렀을 때
    const chat = async (event: any) => {

        // 새로고침 방지
        event.preventDefault();
        if (!text.trim()) return;
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text })
            });
            if (!res.ok) return;
            const data = await res.json();
            setMessages((prev) => [...prev, { ...data.item, createdAt: data.item.createdAt }] as any);
            setText("");
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
        } catch {}
    }

    // endChat: 대화 종료
    const endChat = () => {

        // <1> 대화 저장 팝업 활성화
        setDisplaySavePop(true);
    }

    // saveYes: 오늘 이야기를 일기로 저장해둘까요? -> 예
    const saveYes = (event: any) => {

        // 새로고침 방지
        event.preventDefault();

        // 페이지 이동("경로");
        navigate("/diary");
    }

    // saveNo: 오늘 이야기를 일기로 저장해둘까요? -> 아니요
    const saveNo = (event: any) => {

        // 새로고침 방지
        event.preventDefault();

        // 페이지 이동("경로");
        navigate("/diary");
    }

    useEffect(() => {
        if (loading) return;
        if (!user) {
            navigate('/login');
            return;
        }
        (async () => {
            try {
                const res = await fetch('/api/chat', { credentials: 'include' });
                if (!res.ok) return;
                const data = await res.json();
                setMessages(data.items || []);
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
            } catch {}
        })();
    }, [user, loading, navigate]);

    return (
        <>
            <div>
                <h2>채팅 페이지</h2>
                <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, height: 300, overflowY: 'auto', marginBottom: 8 }}>
                    {messages.map((m, idx) => (
                        <div key={(m as any)._id || idx} style={{ padding: '4px 0' }}>
                            <span>{m.text}</span>
                            <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
                <form onSubmit={chat} style={{ display: 'flex', gap: 8 }}>
                    <input value={text} onChange={(e) => setText(e.target.value)} placeholder="메시지를 입력하세요" style={{ flex: 1 }} />
                    <button type="submit">전송</button>
                </form>
                <button onClick={endChat} style={{ marginTop: 8 }}>나가기</button>
            </div>

            {/* <1> 대화 저장 팝업 -시작- */}
            {displaySavePop && (
                <div>
                    <p>오늘 이야기를 일기로 저장해둘까요?</p>
                    <button onClick={saveYes}>예</button>
                    <button onClick={saveNo}>아니오</button>
                </div>
            )}
            {/* <1> 대화 저장 팝업 -끝- */}
        </>
    )
}