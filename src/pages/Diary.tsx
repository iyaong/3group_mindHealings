// Diary.tsx — 날짜별 다이어리 + AI 대화 저장/조회
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuroraOrb from '../components/AuroraOrb';
import AuroraAuto from '../components/AuroraAuto';

type DiaryListItem = {
    _id: string;
    date: string; // YYYY-MM-DD
    title?: string;
    mood?: { emotion: string; score: number; color: string } | null;
    lastUpdatedAt: string;
    preview?: string;
};

type DiaryMessage = { id?: string; role: 'user' | 'assistant'; content: string; createdAt?: string };

function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function Diary() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

        const [list, setList] = useState<DiaryListItem[]>([]); // 세션 목록
        const [selected, setSelected] = useState<string>(''); // 선택된 세션 ID
        const [selectedDate, setSelectedDate] = useState<string>(todayKey());
    const [messages, setMessages] = useState<DiaryMessage[]>([]);
            // 제목 기능 제거: 더 이상 사용하지 않음
    const [mood, setMood] = useState<{ emotion: string; score: number; color: string } | null>(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingDiary, setLoadingDiary] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [correctedColor, setCorrectedColor] = useState<string>('');
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (loading) return;
        if (!user) navigate('/login');
    }, [loading, user, navigate]);

    const bgStyle = useMemo(() => {
        const c = mood?.color || '#f4f4f5';
        const overlay = 'rgba(255,255,255,0.65)';
        // 위는 연하고 아래로 갈수록 진해지는 수직(위→아래) 그라디언트
        return {
            background: `linear-gradient(to bottom, ${overlay} 10%, ${overlay} 75%, ${c} 100%)`,
        } as React.CSSProperties;
    }, [mood]);

      const refreshList = async () => {
        try {
          // 세션 목록 조회
          const res = await fetch('/api/diary/sessions', { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data?.items)) {
                setList(data.items.map((d: any) => ({ ...d, _id: String(d._id) })));
            }
        } catch {}
    };

      const loadSession = async (sessionId: string) => {
        try {
            setLoadingDiary(true);
          const res = await fetch(`/api/diary/session/${sessionId}`, { credentials: 'include' });
            if (!res.ok) return;
                    const data = await res.json();
            const msgs: DiaryMessage[] = Array.isArray(data?.messages)
                        ? data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }))
                : [];
            setMessages(msgs);
          setMood(data?.session?.mood ?? null);
          setSelectedDate(String(data?.session?.date || todayKey()));
            await refreshList();
        } catch {}
        finally { setLoadingDiary(false); }
    };

        // 첫 진입 시 세션이 없으면 자동 생성/선택, 있으면 최신 세션 자동 선택
        useEffect(() => {
            if (loading || !user) return;
            (async () => {
                try {
                    const res = await fetch('/api/diary/sessions', { credentials: 'include' });
                    if (!res.ok) return;
                    const data = await res.json();
                    const items: any[] = Array.isArray(data?.items) ? data.items : [];
                    setList(items.map((d: any) => ({ ...d, _id: String(d._id) })));
                    if (items.length === 0) {
                        // 첫 세션 자동 생성
                        await createToday();
                    } else {
                        const id = String(items[0]._id);
                        setSelected(id);
                        await loadSession(id);
                    }
                } catch {
                    // ignore
                }
            })();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [loading, user]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending]);

    const send = async () => {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true);
        const optimistic = [...messages, { role: 'user' as const, content: text }];
        setMessages(optimistic);
        setInput('');
        try {
            // 임시 타이핑 표시
            setMessages((prev) => [...prev, { role: 'assistant', content: '…' }]);
            const res = await fetch(`/api/diary/session/${selected}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text }),
            });
            if (!res.ok) {
                setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: '답변 생성에 실패했습니다.' }]);
                return;
            }
            const data = await res.json();
            setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: data?.assistant?.content || '' }]);
            setMood(data?.mood ?? null);
            setShowFeedback(false);
            await refreshList();
        } catch {
            setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
        } finally {
            setSending(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !(e as any).nativeEvent?.isComposing) {
            e.preventDefault();
            void send();
        }
    };

    const deleteSession = async (id: string) => {
        if (!id) return;
        if (!confirm('이 대화 전체를 삭제할까요? 되돌릴 수 없습니다.')) return;
        try {
            const res = await fetch(`/api/diary/session/${id}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                // 목록 갱신 및 선택 상태 정리
                const nextList = list.filter(s => s._id !== id);
                setList(nextList);
                if (selected === id) {
                    if (nextList.length > 0) {
                        setSelected(nextList[0]._id);
                        setSelectedDate(nextList[0].date);
                        await loadSession(nextList[0]._id);
                    } else {
                        setSelected('');
                        setMessages([]);
                        setMood(null);
                    }
                } else {
                    await refreshList();
                }
            } else {
                let msg = '삭제에 실패했습니다.';
                try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
                alert(msg);
            }
        } catch {}
    };

        const createToday = async () => {
            try {
                const res = await fetch('/api/diary/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ date: todayKey() }) });
                if (!res.ok) return;
                const data = await res.json();
                const id = String(data?.id);
                setSelected(id);
                await loadSession(id);
            } catch {}
        };

                // 제목 저장 기능 제거

    // 개별 메시지 삭제 기능 제거 (세션 단위 삭제만 허용)

    // '대화 추가'는 새로운 세션 생성으로 동작

        const Bubble = (m: DiaryMessage, i: number) => {
        const mine = m.role === 'user';
        return (
                <div key={m.id || i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                {!mine && (
                    <div aria-hidden style={{ width: 26, height: 26, borderRadius: 13, background: '#eee', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, marginRight: 8 }}>AI</div>
                )}
                    <div style={{ position: 'relative', maxWidth: '70%', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: mine ? '#2563eb' : '#f1f5f9', color: mine ? '#fff' : '#111', padding: '8px 12px', borderRadius: 12, borderTopRightRadius: mine ? 2 : 12, borderTopLeftRadius: mine ? 12 : 2 }}>
                    {m.content}
                        {/* 메시지 삭제 버튼 제거 */}
                </div>
                {mine && (
                    <div aria-hidden style={{ width: 26, height: 26, borderRadius: 13, background: '#c7d2fe', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, marginLeft: 8 }}>나</div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, minHeight: 'calc(100vh - 56px)' }}>
            {/* 좌측: 목록 + 툴바 */}
            <aside style={{ borderRight: '1px solid #e5e7eb', padding: 12 }}>
                {/* 상단 툴바: 새 대화 생성 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <button onClick={() => void createToday()} title="새 대화 생성" style={{ padding: '6px 10px', border: '1px solid #2563eb', borderRadius: 8, background: '#eef2ff', color: '#1e3a8a', cursor: 'pointer' }}>대화 추가</button>
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>날짜별 기록</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
                    {list.length === 0 && (
                        <div style={{ color: '#9ca3af', fontSize: 14 }}>아직 기록이 없습니다. 첫 대화를 시작해 보세요.</div>
                    )}
                    {list.map((item) => {
                        const active = item._id === selected;
                        return (
                            <div
                                key={item._id}
                                style={{
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    border: `1px solid ${active ? '#6366f1' : '#e5e7eb'}`,
                                    background: active ? '#eef2ff' : '#fff',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <button
                                        onClick={() => { setSelected(item._id); setSelectedDate(item.date); void loadSession(item._id); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flex: 1, textAlign: 'left' }}
                                    >
                                        <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <AuroraOrb color={item.mood?.color || '#bdbdbd'} size={16} className="no-anim" />
                                        </div>
                                        <div style={{ fontWeight: 600 }}>{item.date}</div>
                                    </button>
                                    <button
                                        title="이 대화 삭제"
                                        onClick={() => void deleteSession(item._id)}
                                        style={{ border: '1px solid #ef4444', background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}
                                    >🗑</button>
                                </div>
                                {item.preview && (
                                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>{item.preview}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </aside>

            {/* 우측: 대화 + 배경색 */}
            <main style={{ padding: 16 }}>
                <div style={{ ...bgStyle, border: '1px solid #e5e7eb', borderRadius: 12, minHeight: '70vh', padding: 12, position: 'relative' }}>
                    {/* 오로라: 채팅창 왼쪽 상단 고정, 크게 (WebGL 우선, 실패/지연 시 CSS 폴백) */}
                    <div className="aurora-breathe" style={{ position: 'absolute', top: -2, left: -8, zIndex: 1, pointerEvents: 'none', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AuroraAuto color={mood?.color || '#a3a3a3'} size={150} />
                    </div>
                    {/* 날짜/감정: 오른쪽 상단 정렬, 점수 제거 */}
                    <div style={{ position: 'absolute', top: 12, right: 12, textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedDate}</div>
                        {mood?.emotion && (
                            <div style={{ fontSize: 12, color: '#374151' }}>감정: {mood.emotion}</div>
                        )}
                    </div>

                    {/* Feedback banner: ask user if the color matches their mood */}
                    {mood && (
                        <div style={{ position: 'absolute', top: 56, right: 12, zIndex: 2, background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: '#374151' }}>이 색이 지금 감정에 어울리나요?</span>
                            <button
                                onClick={async () => {
                                    try {
                                        await fetch('/api/feedback/color', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ emotion: mood?.emotion, colorHex: mood?.color, accepted: true }) });
                                        setShowFeedback(false);
                                    } catch {}
                                }}
                                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #10b981', background: '#ecfdf5', color: '#065f46', cursor: 'pointer' }}
                            >네</button>
                            <button onClick={() => { setShowFeedback(v => !v); setCorrectedColor(mood?.color || '#999999'); }} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', cursor: 'pointer' }}>아니요</button>
                            {showFeedback && (
                                <form onSubmit={async (e) => { e.preventDefault(); try { await fetch('/api/feedback/color', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ emotion: mood?.emotion, colorHex: mood?.color, accepted: false, correctedColorHex: correctedColor }) }); setShowFeedback(false); setMood((prev)=> prev ? { ...prev, color: correctedColor } : prev); } catch {} }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <input type="color" aria-label="색 수정" value={correctedColor || '#999999'} onChange={(e) => setCorrectedColor(e.target.value)} style={{ width: 28, height: 22, padding: 0, border: '1px solid #e5e7eb', borderRadius: 4 }} />
                                    <button type="submit" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#1e3a8a', cursor: 'pointer' }}>저장</button>
                                </form>
                            )}
                        </div>
                    )}

                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, height: '55vh', minHeight: 320, padding: 12, overflowY: 'auto', background: 'rgba(255,255,255,0.75)', width: 'min(100%, 1200px)', margin: '96px auto 0' }}>
                        {loadingDiary ? (
                            <div style={{ color: '#6b7280' }}>로딩 중…</div>
                        ) : (
                            messages.map(Bubble)
                        )}
                        <div ref={bottomRef} />
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="오늘의 생각을 적어보세요. Enter로 전송 (Shift+Enter 줄바꿈)"
                            rows={2}
                            style={{ flex: 1, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, resize: 'vertical', background: '#fff' }}
                        />
                        <button type="submit" disabled={sending || !input.trim()} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #2563eb', background: sending ? '#93c5fd' : '#2563eb', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer' }}>
                            {sending ? '전송중…' : '전송'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}