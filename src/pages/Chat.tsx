// Chat.tsx — AI와 채팅하는 페이지 (프론트엔드 채팅 인터페이스)
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // 페이지 이동용 훅
import { useAuth } from "../hooks/useAuth"; // 로그인 상태 관리용 커스텀 훅
import "./Chat.css";

// AiMsg 타입 정의: 한 줄의 메시지를 나타냄
// role: 'user' 또는 'assistant'(AI), content: 텍스트 내용
type AiMsg = { role: 'user' | 'assistant'; content: string };

// Chat 컴포넌트 (기본 내보내기)
export default function Chat() {
    const navigate = useNavigate(); // 로그인 안 된 사용자를 리다이렉트하기 위해 사용
    const location = useLocation(); // Home에서 전달된 state를 받기 위해 사용
    const { user, loading } = useAuth(); // 로그인 상태 확인
    const [msgs, setMsgs] = useState<AiMsg[]>([
        // 초기 메시지(첫 인사)
        { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' },
    ]);
    const [input, setInput] = useState(""); // 사용자가 입력 중인 텍스트
    const [sending, setSending] = useState(false); // 메시지 전송 중 여부
    const [typing, setTyping] = useState(false); // AI가 "답변 생성 중" 상태 표시용
    const bottomRef = useRef<HTMLDivElement | null>(null); // 스크롤 맨 아래로 이동시키기 위한 참조
    // 이전에 변경한 바디/네비(nav) 배경을 저장해서 컴포넌트 언마운트 시 복원하기 위한 레퍼런스
    const prevBodyBgRef = useRef<string | null>(null);
    const prevNavBgRef = useRef<string | null>(null);
    const navChangedRef = useRef(false);
    // Home에서 전달된 초기 메시지를 한 번만 처리하기 위한 ref
    const initialMessageProcessed = useRef(false);

    // 채팅 기록 불러오기 (컴포넌트 처음 렌더링 시 1회 실행)
    useEffect(() => {
        (async () => {
            try {
                // 서버에서 이전 대화 기록 요청
                const res = await fetch('/api/ai/history', { credentials: 'include' });
                if (!res.ok) return; // 실패 시 무시
                const data = await res.json();

                // 서버에서 받은 데이터가 배열이면 기존 인사 메시지 밑에 병합
                if (Array.isArray(data?.items) && data.items.length > 0) {
                    const history: AiMsg[] = data.items.map((x: unknown) => {
                        const item = x as { role?: string; content?: string };
                        return { role: (item.role === 'user' ? 'user' : 'assistant'), content: removeJsonFromContent(String(item.content || '')) };
                    });
                    // 첫 메시지(인사)는 유지하고, 그 아래에 대화 기록 추가
                    setMsgs((prev) => [prev[0], ...history]);
                }
            } catch {
                // 실패 시 조용히 무시 (에러 메시지 노출 안 함)
            }
        })();
    }, []); // 마운트 시 한 번만 실행

    // 컴포넌트 언마운트 시(또는 재렌더에 의해 cleanup이 필요할 때) 바디와 네비게이션 배경을 복원
    useEffect(() => {
        return () => {
            try {
                if (prevBodyBgRef.current !== null) {
                    document.body.style.backgroundColor = prevBodyBgRef.current || '';
                    prevBodyBgRef.current = null;
                }
                if (navChangedRef.current) {
                    const nav = document.querySelector('nav') as HTMLElement | null;
                    if (nav) {
                        // 복원할 이전 inline 스타일이 있다면 복원, 없으면 빈 문자열로 초기화
                        nav.style.backgroundColor = prevNavBgRef.current || '';
                    }
                    prevNavBgRef.current = null;
                    navChangedRef.current = false;
                }
            } catch {
                // DOM 관련 문제 발생 시 무시
            }
        };
    }, []);

    // 문자열에서 { ... } 형태의 JSON 제거
    const removeJsonFromContent = (content: string) => {
        const jsonMatch = content.match(/\{[^}]+\}/);
        if (jsonMatch) {
            content = content.replace(jsonMatch[0], "").trim();
        }
        return content;
    };

    // 로그인 상태 확인: 로그인 안 되어 있으면 /login으로 이동
    useEffect(() => {
        if (loading) return; // 아직 로딩 중이면 대기
        if (!user) navigate('/login'); // 로그인 안 되어 있으면 로그인 페이지로
    }, [loading, user, navigate]);

    // 메시지가 변경될 때마다(추가될 때마다) 자동으로 스크롤 아래로 이동
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [msgs]);

    // Home에서 전달된 초기 메시지를 자동으로 전송
    useEffect(() => {
        // 로그인 확인이 완료되고, 사용자가 있고, 아직 처리하지 않았으면
        if (loading || !user || initialMessageProcessed.current) return;
        
        // location.state에서 initialMessage 추출
        const state = location.state as { initialMessage?: string } | null;
        const initialMessage = state?.initialMessage;
        
        // 초기 메시지가 있으면 자동으로 전송
        if (initialMessage && initialMessage.trim()) {
            initialMessageProcessed.current = true; // 한 번만 실행되도록 표시
            // 약간의 딜레이를 주어 UI가 안정화된 후 전송
            setTimeout(() => {
                void send(initialMessage);
            }, 300);
        }
    }, [loading, user, location.state]);

    // 메시지 전송 함수 (파라미터로 메시지를 받을 수 있음)
    const send = async (message?: string) => {
        const prompt = (message || input).trim(); // 파라미터가 있으면 사용, 없으면 input 사용
        if (!prompt || sending) return; // 입력이 비어 있거나 이미 전송 중이면 무시

        setSending(true);
        setTyping(true); // AI 답변 준비 중 표시 시작

        // 사용자가 입력한 메시지를 기존 대화에 추가
        const next = [...msgs, { role: 'user' as const, content: prompt }];
        setMsgs(next); // 대화 상태 업데이트
        setInput(""); // 입력창 비우기

        try {
            // 💬 타이핑 표시용 점(...) 메시지 추가
            setMsgs((prev) => [...prev, { role: 'assistant', content: '…' }]);

            // 서버에 새 대화 전송
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // 인증 쿠키 포함
                body: JSON.stringify({ messages: next }), // 지금까지의 대화 전체 전달
            });

            // 서버 응답이 실패한 경우
            if (!res.ok) {
                if (res.status === 401) {
                    // 로그인 필요
                    setMsgs((prev) => [
                        ...prev.slice(0, -1),
                        { role: 'assistant', content: '로그인이 필요합니다. 로그인 후 다시 시도해 주세요.' },
                    ]);
                } else {
                    // 서버에서 반환한 에러 메시지 표시
                    try {
                        const err = await res.json();
                        setMsgs((prev) => [
                            ...prev.slice(0, -1),
                            { role: 'assistant', content: err?.message || '답변 생성에 실패했습니다.' },
                        ]);
                    } catch {
                        // 예외 처리
                        setMsgs((prev) => [
                            ...prev.slice(0, -1),
                            { role: 'assistant', content: '답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
                        ]);
                    }
                }
                return;
            }

            // 성공적으로 응답 받았을 때
            const data = await res.json();
            let content = data?.content || '';

            // ----------------------------------------- # AI 메시지에 포함된 json 추출 및 사용 -시작- -----------------------------------------
            // jsonMatch: AI 메시지에 포함된 json들
            const jsonMatch = content.match(/\{[^}]+\}/);

            // 만약 AI 메시지에서 json이 포함되어 있다면
            if (jsonMatch) {

                // AI 메시지에서 json 추출 시도
                const json = JSON.parse(jsonMatch[0]);

                // json에 color 속성이 있을 때
                if (json.color) {
                    try {
                        // 바디 배경을 변경하기 전에 이전 값을 저장
                        if (prevBodyBgRef.current === null) {
                            prevBodyBgRef.current = document.body.style.backgroundColor || '';
                        }
                        // Chat 페이지 전용 표시자 설정 (다른 페이지에서 흰색 강제화에 사용)
                        try { document.body.dataset.chatBg = '1'; } catch {}
                        document.body.style.backgroundColor = json.color;

                        // 네비게이션(nav)이 투명(배경 없음)이라면 흰색 배경을 적용합니다.
                        // 변경하기 전에 nav의 이전 inline 스타일을 저장하여 언마운트 시 복원합니다.
                        const nav = document.querySelector('nav') as HTMLElement | null;
                        if (nav) {
                            const inlineBg = (nav.style && nav.style.backgroundColor) ? nav.style.backgroundColor.trim() : '';
                            const computedBg = getComputedStyle(nav).backgroundColor || '';
                            const isTransparent = !inlineBg && (computedBg === 'transparent' || computedBg === 'rgba(0, 0, 0, 0)');
                            if (isTransparent) {
                                if (prevNavBgRef.current === null) prevNavBgRef.current = nav.style.backgroundColor || '';
                                nav.style.backgroundColor = '#ffffff';
                                navChangedRef.current = true;
                            }
                        }
                    } catch {
                        // DOM 관련 문제 발생시 무시
                    }
                }

                // AI 메시지에서 json을 제거하기 + 제거하고 남은 빈 칸 제거
                content = content.replace(jsonMatch[0], "").trim();
            }
            // ----------------------------------------- # AI 메시지에 포함된 json 추출 및 사용 -끝- -----------------------------------------

            // 마지막 "…"을 실제 AI 응답으로 교체
            setMsgs((prev) => [...prev.slice(0, -1), { role: 'assistant', content }]);
        } catch {
            // 네트워크 오류 발생 시
            setMsgs((prev) => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: '네트워크 오류가 발생했습니다.' },
            ]);
        } finally {
            setSending(false);
            setTyping(false); // AI 타이핑 표시 제거
        }
    };

    // 엔터 키로 전송, Shift+Enter로 줄바꿈
    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // IME(한글 입력 중 등) 상태가 아닐 때만 엔터로 전송
        if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
            e.preventDefault(); // 줄바꿈 방지
            void send(); // 비동기로 전송
        }
    };

    // 메시지 하나를 버블 형태로 렌더링하는 함수
    const bubble = (m: AiMsg, i: number) => {
        const mine = m.role === 'user'; // 내가 보낸 메시지인지 여부
        return (
            <div
                key={i}
                style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    marginBottom: 8,
                }}
            >
                {/* AI 말풍선일 경우 왼쪽에 'AI' 아이콘 */}
                {!mine && (
                    <div
                        aria-hidden
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            background: '#eee',
                            color: '#333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            marginRight: 8,
                        }}
                    >
                        AI
                    </div>
                )}

                {/* 메시지 본문 (파란색: 내 메시지, 회색: AI 메시지) */}
                <div
                    style={{
                        maxWidth: '70%',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        background: mine ? '#2563eb' : '#f1f5f9',
                        color: mine ? '#fff' : '#111',
                        padding: '8px 12px',
                        borderRadius: 12,
                        borderTopRightRadius: mine ? 2 : 12,
                        borderTopLeftRadius: mine ? 12 : 2,
                    }}
                >
                    {m.content}
                </div>

                {/* 내 말풍선일 경우 오른쪽에 '나' 아이콘 */}
                {mine && (
                    <div
                        aria-hidden
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            background: '#c7d2fe',
                            color: '#111',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            marginLeft: 8,
                        }}
                    >
                        나
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
            <h2 style={{ textAlign: 'center', margin: '8px 0 16px' }}>AI 채팅 페이지</h2>

            {/* 채팅 메시지 영역 */}
            <div
                style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    height: '60vh',
                    minHeight: 360,
                    padding: 12,
                    overflowY: 'auto',
                    background: '#ffffff',
                }}
            >
                {/* 모든 메시지 렌더링 */}
                {msgs.map(bubble)}

                {/* AI 타이핑 중일 때 점 3개 표시 */}
                {typing && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                        <div
                            aria-hidden
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                background: '#eee',
                                color: '#333',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                marginRight: 8,
                            }}
                        >
                            AI
                        </div>
                        <div
                            style={{
                                background: '#f1f5f9',
                                color: '#111',
                                padding: '8px 12px',
                                borderRadius: 12,
                                borderTopLeftRadius: 2,
                            }}
                        >
                            {/* 점 3개 애니메이션 */}
                            <span style={{ display: 'inline-block', width: 48 }}>
                                <span className="dot" style={{ animation: 'blink 1.2s infinite' }}>●</span>
                                <span className="dot" style={{ marginLeft: 4, animation: 'blink 1.2s infinite 0.2s' }}>●</span>
                                <span className="dot" style={{ marginLeft: 4, animation: 'blink 1.2s infinite 0.4s' }}>●</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* 스크롤 맨 아래를 가리키는 ref (새 메시지 도착 시 자동 스크롤) */}
                <div ref={bottomRef} />
            </div>

            {/* 입력창 + 전송 버튼 */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void send(); // 엔터로 전송
                }}
                style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 12 }}
            >
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="메시지를 입력하고 Enter로 전송 (Shift+Enter 줄바꿈)"
                    rows={2}
                    style={{
                        flex: 1,
                        padding: 10,
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        resize: 'vertical',
                    }}
                />
                <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid #2563eb',
                        background: sending ? '#93c5fd' : '#2563eb',
                        color: '#fff',
                        cursor: sending ? 'not-allowed' : 'pointer',
                    }}
                >
                    {sending ? '전송중…' : '전송'}
                </button>
            </form>
        </div>
    );
}
