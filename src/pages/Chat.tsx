// Chat.tsx — AI와 채팅하는 페이지 (프론트엔드 채팅 인터페이스)
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // 페이지 이동용 훅
import { useAuth } from "../hooks/useAuth"; // 로그인 상태 관리용 커스텀 훅
import { useToast } from "../components/Toast"; // Toast 알림 시스템
import "./Chat.css";

// AiMsg 타입 정의: 한 줄의 메시지를 나타냄
// role: 'user' 또는 'assistant'(AI), content: 텍스트 내용
type AiMsg = { role: 'user' | 'assistant'; content: string };

// Chat 컴포넌트 (기본 내보내기)
import type { EnhancedMood, EmotionDetail } from '../types/api';

const Chat: React.FC = () => {
    const navigate = useNavigate(); // 로그인 안 된 사용자를 리다이렉트하기 위해 사용
    const location = useLocation(); // Home에서 전달된 state를 받기 위해 사용
    const { user, loading } = useAuth(); // 로그인 상태 확인
    const { showToast, ToastContainer } = useToast(); // Toast 알림
    const [msgs, setMsgs] = useState<AiMsg[]>([
        // 초기 메시지(첫 인사)
        { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' },
    ]);
    const [input, setInput] = useState(""); // 사용자가 입력 중인 텍스트
    const [sending, setSending] = useState(false); // 메시지 전송 중 여부
    const [typing, setTyping] = useState(false); // AI가 "답변 생성 중" 상태 표시용
    
    // 감정 진단 관련 상태
    const [messageCount, setMessageCount] = useState<number>(0); // 사용자 메시지 개수
    const [mood, setMood] = useState<{ emotion: string; score: number; color: string } | null>(null);
    const [enhancedMood, setEnhancedMood] = useState<EnhancedMood | null>(null); // 복합 감정 분석 결과
    const [isAnalyzing, setIsAnalyzing] = useState(false); // 감정 분석 중
    const [savingToDiary, setSavingToDiary] = useState(false); // 다이어리 저장 중
    const [emotionColor, setEmotionColor] = useState<string | null>(null); // 감정 색상
    const MIN_REQUIRED_MESSAGES = 5; // 최소 요구 메시지 수
    
    const bottomRef = useRef<HTMLDivElement | null>(null); // 스크롤 맨 아래로 이동시키기 위한 참조
    const textareaRef = useRef<HTMLTextAreaElement | null>(null); // textarea 참조
    // 이전에 변경한 바디/네비(nav) 배경을 저장해서 컴포넌트 언마운트 시 복원하기 위한 레퍼런스
    const prevBodyBgRef = useRef<string | null>(null);
    const prevNavBgRef = useRef<string | null>(null);
    const navChangedRef = useRef(false);

    // 채팅 기록 불러오기 (컴포넌트 처음 렌더링 시 1회 실행)
    useEffect(() => {
        (async () => {
            try {
                // Home에서 새 대화로 넘어온 경우 (initialMessage가 있으면) 이전 기록 불러오지 않음
                const state = location.state as { initialMessage?: string; isNewChat?: boolean } | null;
                const isNewChat = state?.isNewChat || !!state?.initialMessage;
                
                if (isNewChat) {
                    // 새 대화이므로 이전 기록을 불러오지 않음
                    return;
                }
                
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

    // 문자열에서 { ... } 형태의 JSON 제거
    const removeJsonFromContent = (content: string) => {
        const jsonMatch = content.match(/\{[^}]+\}/);
        if (jsonMatch) {
            content = content.replace(jsonMatch[0], "").trim();
        }
        return content;
    };

    // HEX 색상에서 유사 그라데이션 생성 (밝게/어둡게 변형)
    const generateGradientFromColor = (hexColor: string): string => {
        // HEX를 RGB로 변환
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // 밝은 버전 (20% 밝게)
        const lighten = (val: number) => Math.min(255, Math.floor(val * 1.2));
        const r1 = lighten(r);
        const g1 = lighten(g);
        const b1 = lighten(b);

        // 어두운 버전 (20% 어둡게)
        const darken = (val: number) => Math.max(0, Math.floor(val * 0.8));
        const r2 = darken(r);
        const g2 = darken(g);
        const b2 = darken(b);

        // 약간 색조 변경 (Hue shift)
        const r3 = Math.min(255, Math.floor(r * 0.9 + g * 0.1));
        const g3 = Math.min(255, Math.floor(g * 0.9 + b * 0.1));
        const b3 = Math.min(255, Math.floor(b * 0.9 + r * 0.1));

        const r4 = Math.min(255, Math.floor(r * 0.85 + b * 0.15));
        const g4 = Math.min(255, Math.floor(g * 0.85 + r * 0.15));
        const b4 = Math.min(255, Math.floor(b * 0.85 + g * 0.15));

        return `linear-gradient(
            135deg,
            rgb(${r1}, ${g1}, ${b1}) 0%,
            rgb(${r}, ${g}, ${b}) 25%,
            rgb(${r3}, ${g3}, ${b3}) 50%,
            rgb(${r2}, ${g2}, ${b2}) 75%,
            rgb(${r4}, ${g4}, ${b4}) 100%
        )`;
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

    // 메시지 전송 함수
    const send = async () => {
        const prompt = input.trim(); // 공백 제거
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
                // 마지막 "…" 메시지를 제거하고 에러 메시지 표시
                setMsgs((prev) => [
                    ...prev.slice(0, -1),
                    { role: 'assistant', content: '답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
                ]);
                return;
            }

            // 추가적으로 상태 코드에 따라 에러 처리 분기
            if (!res.ok) {
                if (res.status === 401) {
                    // 로그인 필요
                    setMsgs((prev) => [
                        ...prev,
                        { role: 'assistant', content: '로그인이 필요합니다. 로그인 후 다시 시도해 주세요.' },
                    ]);
                } else {
                    // 서버에서 반환한 에러 메시지 표시
                    try {
                        const err = await res.json();
                        setMsgs((prev) => [
                            ...prev,
                            { role: 'assistant', content: err?.message || '답변 생성에 실패했습니다.' },
                        ]);
                    } catch {
                        // 예외 처리
                        setMsgs((prev) => [
                            ...prev,
                            { role: 'assistant', content: '답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
                        ]);
                    }
                }
                return;
            }

            // 성공적으로 응답 받았을 때
            const data = await res.json();
            let content = data?.content || '';

            console.log(content);

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
                        // 감정 색상 state 업데이트 (배경 그라데이션에 사용)
                        setEmotionColor(json.color);
                        
                        // 바디 배경을 변경하기 전에 이전 값을 저장
                        if (prevBodyBgRef.current === null) {
                            prevBodyBgRef.current = document.body.style.backgroundColor || '';
                        }
                        // Chat 페이지 전용 표시자 설정 (다른 페이지에서 흰색 강제화에 사용)
                        try { document.body.dataset.chatBg = '1'; } catch {}
                        // body 배경은 투명으로 (그라데이션 배경이 보이도록)
                        document.body.style.backgroundColor = 'transparent';

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
            
            // 사용자 메시지 개수 업데이트 (첫 인사 메시지 제외)
            const userMsgCount = next.filter(m => m.role === 'user').length;
            setMessageCount(userMsgCount);
            
            // 5번 대화 도달 시 자동으로 감정 분석 실행
            if (userMsgCount === MIN_REQUIRED_MESSAGES && !mood) {
                setTimeout(() => {
                    void analyzeEmotion();
                }, 1000); // AI 응답이 완전히 렌더링된 후 실행
            }
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
    if (e.key === 'Enter' && !e.shiftKey && !(e as unknown as { nativeEvent?: { isComposing?: boolean } }).nativeEvent?.isComposing) {
            e.preventDefault(); // 줄바꿈 방지
            void send(); // 비동기로 전송
        }
    };
    
    // 감정 분석 함수
    const analyzeEmotion = async () => {
        if (isAnalyzing || messageCount < 2) return; // 최소 2개 메시지 필요
        
        setIsAnalyzing(true);
        
        try {
            // 사용자 메시지만 추출 (첫 인사 메시지 제외)
            const userMessages = msgs.slice(1).filter(m => m.role === 'user' && m.content.trim() && m.content !== '…');
            
            if (userMessages.length === 0) {
                showToast({ message: '분석할 메시지가 없습니다.', type: 'warning', duration: 2500 });
                return;
            }
            
            // 최근 5개 메시지만 사용 (일관성 유지)
            const recentMessages = userMessages.slice(-5);
            const allText = recentMessages.map(m => m.content).join(' ');
            
            console.log('📝 Chat.tsx 감정 분석:', {
                totalMessages: userMessages.length,
                analyzingCount: recentMessages.length,
                textPreview: allText.slice(-100)
            });
            
            // 복합 감정 분석 API 호출 (enhanced=true)
            const res = await fetch('/api/ai/analyze-emotion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text: allText, enhanced: true })
            });
            
            if (!res.ok) {
                throw new Error('감정 분석에 실패했습니다.');
            }
            
            const data = await res.json();
            const analyzedMood = data?.mood;
            const analyzedEnhancedMood = data?.enhancedMood;
            
            if (analyzedMood && analyzedMood.emotion && analyzedMood.color) {
                setMood(analyzedMood);
                setEnhancedMood(analyzedEnhancedMood); // 복합 감정 데이터 저장
                setEmotionColor(analyzedMood.color); // 배경 그라데이션 색상 업데이트
                
                console.log('✅ Chat.tsx 감정 분석 완료:', analyzedMood);
                console.log('🌈 Chat.tsx 복합 감정:', analyzedEnhancedMood);
                
                // 복합 감정 정보 포함한 Toast 메시지
                let toastMessage = `✨ 감정 분석 완료! ${analyzedMood.emotion} (${Math.round(analyzedMood.score * 100)}%)`;
                
                if (analyzedEnhancedMood) {
                    const { secondary, trend } = analyzedEnhancedMood;
                    
                    // 부 감정이 있으면 표시
                    if (secondary && secondary.length > 0) {
                        const secondaryNames = secondary.map((s: EmotionDetail) => s.emotion).join(', ');
                        toastMessage += `\n+ ${secondaryNames}`;
                    }
                    
                    // 추세 표시
                    if (trend) {
                        const trendEmoji = trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️';
                        const trendText = trend === 'improving' ? '개선 중' : trend === 'declining' ? '주의 필요' : '안정적';
                        toastMessage += `\n${trendEmoji} ${trendText}`;
                    }
                }
                
                showToast({ 
                    message: toastMessage, 
                    type: 'success', 
                    duration: 5000 
                });
            } else {
                throw new Error('감정 분석 결과가 유효하지 않습니다.');
            }
        } catch (error) {
            console.error('감정 분석 오류:', error);
            const errorMsg = error instanceof Error ? error.message : '감정 분석 중 오류가 발생했습니다.';
            showToast({ message: errorMsg, type: 'error', duration: 3000 });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    // 다이어리에 저장 함수
    const saveToDiary = async () => {
        if (savingToDiary) return;
        
        if (!user) {
            showToast({ message: '로그인이 필요합니다.', type: 'warning', duration: 3000 });
            setTimeout(() => navigate('/login'), 1500);
            return;
        }
        
        if (msgs.length <= 1) {
            showToast({ message: '저장할 대화 내용이 없습니다.', type: 'info', duration: 2500 });
            return;
        }
        
        if (!mood) {
            showToast({ 
                message: '감정 진단을 먼저 완료해주세요. 🎨', 
                type: 'warning', 
                duration: 3000 
            });
            return;
        }
        
        const confirmSave = confirm('현재 대화를 다이어리에 저장하시겠습니까?');
        if (!confirmSave) return;
        
        setSavingToDiary(true);
        
        try {
            const today = new Date();
            const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            // 다이어리 세션 생성
            const createRes = await fetch('/api/diary/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ date: dateKey, type: 'ai' })
            });
            
            if (!createRes.ok) {
                throw new Error('다이어리 세션 생성 실패');
            }
            
            const createData = await createRes.json();
            const sessionId = createData.id;
            
            // 대화 내용 저장 (첫 인사 메시지 제외)
            const messagesToSave = msgs.slice(1).filter(m => m.content.trim() && m.content !== '…');
            
            const importRes = await fetch(`/api/diary/session/${sessionId}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ messages: messagesToSave })
            });
            
            if (!importRes.ok) {
                throw new Error('다이어리 저장 실패');
            }
            
            const importData = await importRes.json();
            
            showToast({ 
                message: `${importData.imported}개의 메시지가 다이어리에 저장되었습니다! 🎉`, 
                type: 'success', 
                duration: 3500 
            });
            
            const goToDiary = confirm('다이어리 페이지로 이동하시겠습니까?');
            if (goToDiary) {
                navigate('/diary');
            }
        } catch (error) {
            console.error('다이어리 저장 에러:', error);
            const errorMsg = error instanceof Error ? error.message : '다이어리 저장 중 오류가 발생했습니다.';
            showToast({ message: errorMsg, type: 'error', duration: 4000 });
        } finally {
            setSavingToDiary(false);
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
        <>
            {/* 회전하는 그라데이션 배경 */}
            <div 
                className="chat-animated-bg" 
                style={emotionColor ? {
                    backgroundImage: generateGradientFromColor(emotionColor),
                    backgroundSize: '400% 400%'
                } : undefined}
            />
            
            <ToastContainer />
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
                <h2 style={{ textAlign: 'center', margin: '8px 0 16px', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>AI 채팅 페이지</h2>

                {/* 감정 진단 상태 섹션 */}
                <div style={{
                    margin: '0 0 16px',
                    padding: '16px',
                    borderRadius: 12,
                    background: mood 
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)'
                        : isAnalyzing
                            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.95) 100%)'
                            : 'linear-gradient(135deg, rgba(251, 191, 36, 0.95) 0%, rgba(245, 158, 11, 0.95) 100%)',
                    border: mood 
                        ? '2px solid rgba(16, 185, 129, 0.3)' 
                        : isAnalyzing
                            ? '2px solid rgba(99, 102, 241, 0.3)'
                            : '2px solid rgba(251, 191, 36, 0.3)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}>
                    {/* 상단 헤더 영역 */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        gap: 12
                    }}>
                        {/* 좌측: 아이콘 + 상태 텍스트 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                            <span style={{ fontSize: 24 }}>
                                {mood ? '✨' : isAnalyzing ? '🔄' : '📊'}
                            </span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#fff' }}>
                                    {mood 
                                        ? '진단 완료' 
                                        : isAnalyzing 
                                            ? '진단 중...' 
                                            : `진단 전 (${messageCount}/${MIN_REQUIRED_MESSAGES})`
                                    }
                                </div>
                                {mood && (
                                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
                                        감정: <strong>{mood.emotion}</strong> ({Math.round(mood.score * 100)}%)
                                    </div>
                                )}
                                {!mood && !isAnalyzing && messageCount >= 2 && (
                                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                                        {messageCount >= MIN_REQUIRED_MESSAGES 
                                            ? '감정 분석을 시작할 수 있습니다' 
                                            : `${MIN_REQUIRED_MESSAGES - messageCount}번 더 대화하면 분석 가능합니다`
                                        }
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* 우측: 진단하기 버튼 (진단 전/중일 때만) */}
                        {!mood && messageCount >= 2 && !isAnalyzing && (
                            <button
                                onClick={() => void analyzeEmotion()}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: messageCount >= MIN_REQUIRED_MESSAGES
                                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: 13,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                }}
                            >
                                🧠 감정 진단하기
                            </button>
                        )}
                    </div>
                    
                    {/* 진단 완료 시: 컬러 코드 + 복합 감정 + 다이어리 추가 버튼 */}
                    {mood && (
                        <>
                            <div style={{
                                padding: '12px',
                                borderRadius: 8,
                                background: 'rgba(255, 255, 255, 0.6)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 14,
                                marginBottom: 12
                            }}>
                                <span style={{ fontWeight: 600 }}>컬러 코드:</span>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 6,
                                        background: mood.color,
                                        border: '2px solid rgba(0,0,0,0.1)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }} />
                                    <code style={{
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        background: 'rgba(0,0,0,0.05)',
                                        fontFamily: 'monospace',
                                        fontSize: 13,
                                        fontWeight: 600
                                    }}>
                                        {mood.color}
                                    </code>
                                </div>
                            </div>
                            
                            {/* 복합 감정 분석 결과 표시 */}
                            {enhancedMood && (
                                <div style={{
                                    padding: '12px',
                                    borderRadius: 8,
                                    background: 'rgba(255, 255, 255, 0.6)',
                                    marginBottom: 12
                                }}>
                                    <div style={{ 
                                        fontSize: 14, 
                                        fontWeight: 600, 
                                        marginBottom: 8,
                                        color: '#374151'
                                    }}>
                                        🌈 감정 분석 상세
                                    </div>
                                    
                                    {/* 부 감정 표시 */}
                                    {enhancedMood.secondary && enhancedMood.secondary.length > 0 && (
                                        <div style={{ 
                                            fontSize: 13, 
                                            marginBottom: 6,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            flexWrap: 'wrap'
                                        }}>
                                            <span style={{ color: '#6b7280' }}>함께 느껴지는 감정:</span>
                                            {enhancedMood.secondary.map((s: EmotionDetail, idx: number) => (
                                                <span 
                                                    key={idx}
                                                    style={{
                                                        padding: '2px 8px',
                                                        borderRadius: 12,
                                                        background: s.color + '30',
                                                        color: '#374151',
                                                        fontSize: 12,
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {s.emotion}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* 추세 표시 */}
                                    {enhancedMood.trend && (
                                        <div style={{ 
                                            fontSize: 13, 
                                            marginBottom: 6,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6
                                        }}>
                                            <span style={{ color: '#6b7280' }}>감정 추세:</span>
                                            <span style={{ fontWeight: 600 }}>
                                                {enhancedMood.trend === 'improving' && '📈 개선 중'}
                                                {enhancedMood.trend === 'declining' && '📉 주의 필요'}
                                                {enhancedMood.trend === 'stable' && '➡️ 안정적'}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* 트리거 단어 표시 */}
                                    {enhancedMood.triggerWords && enhancedMood.triggerWords.length > 0 && (
                                        <div style={{ 
                                            fontSize: 13,
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 6
                                        }}>
                                            <span style={{ color: '#6b7280', flexShrink: 0 }}>주요 키워드:</span>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {enhancedMood.triggerWords.map((word: string, idx: number) => (
                                                    <span 
                                                        key={idx}
                                                        style={{
                                                            padding: '2px 6px',
                                                            borderRadius: 4,
                                                            background: 'rgba(99, 102, 241, 0.1)',
                                                            color: '#4f46e5',
                                                            fontSize: 11,
                                                            fontWeight: 500
                                                        }}
                                                    >
                                                        #{word}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <button
                                onClick={() => void saveToDiary()}
                                disabled={savingToDiary}
                                style={{
                                    width: '100%',
                                    padding: '12px 20px',
                                    borderRadius: 10,
                                    border: '2px solid rgba(255, 255, 255, 0.5)',
                                    background: savingToDiary 
                                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.5) 0%, rgba(5, 150, 105, 0.5) 100%)'
                                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: '#fff',
                                    cursor: savingToDiary ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                    fontSize: 15,
                                    boxShadow: savingToDiary ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.4)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                {savingToDiary ? '💾 저장 중...' : '📝 다이어리에 추가'}
                            </button>
                        </>
                    )}
                </div>

                {/* 채팅 메시지 영역 */}
            <div
                style={{
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 12,
                    height: '60vh',
                    minHeight: 360,
                    padding: 12,
                    overflowY: 'auto',
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
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
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="메시지를 입력하고 Enter로 전송 (Shift+Enter 줄바꿈)"
                    rows={2}
                    style={{
                        flex: 1,
                        padding: 10,
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 8,
                        resize: 'vertical',
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                />
                <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: sending 
                            ? 'rgba(147, 197, 253, 0.8)' 
                            : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                        color: '#fff',
                        cursor: sending ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        boxShadow: sending ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.4)',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {sending ? '전송중…' : '전송'}
                </button>
            </form>
        </div>
        </>
    );
}

export default Chat;
