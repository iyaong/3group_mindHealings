// Chat.tsx — AI 채팅 인터페이스
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type AiMsg = { role: 'user' | 'assistant'; content: string };

export default function Chat() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [msgs, setMsgs] = useState<AiMsg[]>([
        { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' },
    ]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
        const [typing, setTyping] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);

        // Load history on mount
        useEffect(() => {
            (async () => {
                try {
                    const res = await fetch('/api/ai/history', { credentials: 'include' });
                    if (!res.ok) return;
                    const data = await res.json();
                    if (Array.isArray(data?.items) && data.items.length > 0) {
                        // merge history under greeting
                        const history: AiMsg[] = data.items.map((x: any) => ({ role: x.role, content: x.content }));
                        setMsgs((prev) => [prev[0], ...history]);
                    }
                } catch {}
            })();
        }, []);

    useEffect(() => {
        if (loading) return;
        if (!user) navigate('/login');
    }, [loading, user, navigate]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [msgs]);

    const send = async () => {
        const prompt = input.trim();
        if (!prompt || sending) return;
        setSending(true);
           setTyping(true);
        const next = [...msgs, { role: 'user' as const, content: prompt }];
        setMsgs(next);
        setInput("");
        try {
                // typing indicator
                setMsgs((prev) => [...prev, { role: 'assistant', content: '…' }]);
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ messages: next }),
            });
            if (!res.ok) {
                    setMsgs((prev) => [...prev.slice(0, -1), { role: 'assistant', content: '답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }]);
                return;
            }
               if (!res.ok) {
                   if (res.status === 401) {
                       setMsgs((prev) => [...prev, { role: 'assistant', content: '로그인이 필요합니다. 로그인 후 다시 시도해 주세요.' }]);
                   } else {
                       try {
                           const err = await res.json();
                           setMsgs((prev) => [...prev, { role: 'assistant', content: err?.message || '답변 생성에 실패했습니다.' }]);
                       } catch {
                           setMsgs((prev) => [...prev, { role: 'assistant', content: '답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }]);
                       }
                   }
                   return;
               }
            const data = await res.json();
            const content = data?.content || '';
                setMsgs((prev) => [...prev.slice(0, -1), { role: 'assistant', content }]);
        } catch {
                setMsgs((prev) => [...prev.slice(0, -1), { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
        } finally {
            setSending(false);
               setTyping(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !(e as any).nativeEvent?.isComposing) {
            e.preventDefault();
            void send();
        }
    };

    const bubble = (m: AiMsg, i: number) => {
        const mine = m.role === 'user';
        return (
            <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                {!mine && (
                    <div aria-hidden style={{ width: 28, height: 28, borderRadius: 14, background: '#eee', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginRight: 8 }}>
                        AI
                    </div>
                )}
                <div style={{ maxWidth: '70%', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: mine ? '#2563eb' : '#f1f5f9', color: mine ? '#fff' : '#111', padding: '8px 12px', borderRadius: 12, borderTopRightRadius: mine ? 2 : 12, borderTopLeftRadius: mine ? 12 : 2 }}>
                    {m.content}
                </div>
                {mine && (
                    <div aria-hidden style={{ width: 28, height: 28, borderRadius: 14, background: '#c7d2fe', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginLeft: 8 }}>
                        나
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
            <h2 style={{ textAlign: 'center', margin: '8px 0 16px' }}>AI 채팅 페이지</h2>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, height: '60vh', minHeight: 360, padding: 12, overflowY: 'auto', background: '#ffffff' }}>
                {msgs.map(bubble)}
                    {typing && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                            <div aria-hidden style={{ width: 28, height: 28, borderRadius: 14, background: '#eee', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginRight: 8 }}>
                                AI
                            </div>
                            <div style={{ background: '#f1f5f9', color: '#111', padding: '8px 12px', borderRadius: 12, borderTopLeftRadius: 2 }}>
                                <span style={{ display: 'inline-block', width: 48 }}>
                                    <span className="dot" style={{ animation: 'blink 1.2s infinite' }}>●</span>
                                    <span className="dot" style={{ marginLeft: 4, animation: 'blink 1.2s infinite 0.2s' }}>●</span>
                                    <span className="dot" style={{ marginLeft: 4, animation: 'blink 1.2s infinite 0.4s' }}>●</span>
                                </span>
                            </div>
                        </div>
                    )}
                <div ref={bottomRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="메시지를 입력하고 Enter로 전송 (Shift+Enter 줄바꿈)"
                    rows={2}
                    style={{ flex: 1, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, resize: 'vertical' }}
                />
                <button type="submit" disabled={sending || !input.trim()} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #2563eb', background: sending ? '#93c5fd' : '#2563eb', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer' }}>
                    {sending ? '전송중…' : '전송'}
                </button>
            </form>
        </div>
    );
}