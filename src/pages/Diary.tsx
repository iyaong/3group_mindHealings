// Diary.tsx — 날짜별 다이어리 + AI 대화 저장/조회
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import EmotionOrbPremium from '../components/EmotionOrbPremium';
import { useToast } from '../components/Toast';
import { ChatLoadingSkeleton, DiaryListSkeleton } from '../components/Skeleton';
import DiaryCalendar from '../components/DiaryCalendar';
import type { DiarySessionResponse, DiaryMessageResponse, DiarySessionsApiResponse, DiarySessionDetailApiResponse } from '../types/api';

type DiaryListItem = DiarySessionResponse;
type DiaryMessage = DiaryMessageResponse;

function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 검색어 하이라이트 함수
function highlightText(text: string, query: string) {
    if (!query.trim()) return text;
    
    // 정규식 특수문자 이스케이프
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return (
        <>
            {parts.map((part, i) => (
                <span
                    key={i}
                    style={part.toLowerCase() === query.toLowerCase() ? {
                        background: 'linear-gradient(120deg, #fef08a 0%, #fde047 100%)',
                        padding: '2px 4px',
                        borderRadius: 4,
                        fontWeight: 600,
                        color: '#854d0e',
                    } : {}}
                >
                    {part}
                </span>
            ))}
        </>
    );
}

export default function Diary() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading } = useAuth();
    const { showToast, ToastContainer } = useToast();

    // 탭 관리: 'ai' (AI 대화) 또는 'online' (온라인 채팅)
    const [activeTab, setActiveTab] = useState<'ai' | 'online'>('ai');

    const [list, setList] = useState<DiaryListItem[]>([]); // AI 세션 목록
    const [onlineList, setOnlineList] = useState<DiaryListItem[]>([]); // 온라인 채팅 목록
    const [selected, setSelected] = useState<string>(''); // 선택된 세션 ID
    const [selectedDate, setSelectedDate] = useState<string>(todayKey());
    const [messages, setMessages] = useState<DiaryMessage[]>([]);
    const [onlineOriginalMessages, setOnlineOriginalMessages] = useState<DiaryMessage[]>([]); // 온라인 채팅 원본 메시지 (읽기 전용)
    const [aiChatMessages, setAiChatMessages] = useState<DiaryMessage[]>([]); // 온라인 채팅 탭의 AI와의 대화
    const [currentSessionType, setCurrentSessionType] = useState<'ai' | 'online' | null>(null); // 현재 선택된 세션의 타입
    // 제목 기능 제거: 더 이상 사용하지 않음
    const [mood, setMood] = useState<{ emotion: string; score: number; color: string } | null>(null);
    const [messageCount, setMessageCount] = useState<number>(0); // 현재 메시지 개수
    const MIN_REQUIRED_MESSAGES = 5; // 최소 요구 메시지 수 (상수)
    
    // 분석 가능 여부 계산 (useMemo)
    const canAnalyze = useMemo(() => messageCount >= MIN_REQUIRED_MESSAGES, [messageCount]);
    
    const [isAnalyzing, setIsAnalyzing] = useState(false); // 수동 분석 중
    const [showCompletedAnimation, setShowCompletedAnimation] = useState(false); // 진단 완료 애니메이션
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingDiary, setLoadingDiary] = useState(false);
    const [loadingList, setLoadingList] = useState(false); // 목록 로딩 상태
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set()); // 펼쳐진 날짜들
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null); // 수정 중인 세션 ID
    const [editingTitle, setEditingTitle] = useState<string>(''); // 수정 중인 제목
    const [filterDate, setFilterDate] = useState<string | null>(null); // 달력에서 선택한 날짜 필터
    const [searchQuery, setSearchQuery] = useState<string>(''); // 검색어
    const [pendingOnlineSessionId, setPendingOnlineSessionId] = useState<string | null>(null); // 온라인 채팅 저장 후 자동 선택할 세션 ID
    const [showWelcomeMessage, setShowWelcomeMessage] = useState<boolean>(false); // 환영 메시지 표시 여부
    const [summary, setSummary] = useState<string>(''); // 대화 요약
    const [isSummarizing, setIsSummarizing] = useState<boolean>(false); // 요약 중 상태
    const [memo, setMemo] = useState<string>(''); // 온라인 채팅 메모
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null); // textarea 참조

    useEffect(() => {
        if (loading) return;
        if (!user) navigate('/login');
    }, [loading, user, navigate]);

    // Enter 키 전역 리스너: textarea가 포커스되지 않은 상태에서 Enter 누르면 포커스
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Enter 키이고, textarea가 이미 포커스되어 있지 않으면
            if (e.key === 'Enter' && document.activeElement !== textareaRef.current) {
                // input, textarea, button 등이 아닌 곳에서만 동작
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON') {
                    e.preventDefault();
                    textareaRef.current?.focus();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const bgStyle = useMemo(() => {
        const c = mood?.color || '#f4f4f5';
        const overlay = 'rgba(255,255,255,0.65)';
        // 위는 연하고 아래로 갈수록 진해지는 수직(위→아래) 그라디언트
        return {
            background: `linear-gradient(to bottom, ${overlay} 10%, ${overlay} 75%, ${c} 100%)`,
        } as React.CSSProperties;
    }, [mood]);

    // EmotionOrb 색상 (의존성 통일 및 강제 리렌더링)
    const emotionOrbColor = useMemo(() => {
        const color = mood?.color || '#6366f1';
        if (import.meta.env.DEV) {
            console.log('🎨 AI EmotionOrb color update:', { 
                color, 
                emotion: mood?.emotion, 
                hasColor: !!mood?.color 
            });
        }
        return color;
    }, [mood?.color, mood?.emotion]); // color와 emotion 둘 다 의존
    
    // 감정 분석 대기 중 상태 (5개 미만 메시지 && 감정 미분석) - 채팅 전부터 색상 순환
    const isWaitingAnalysis = useMemo(() => {
        return messageCount < 5 && !mood; // 0개부터 색상 순환
    }, [messageCount, mood]);

    // 검색어로 AI 세션 필터링
    const searchFilteredAISessions = useMemo(() => {
        if (!searchQuery.trim()) return list;
        const query = searchQuery.toLowerCase().trim();
        return list.filter((item) => {
            // 제목 검색
            if (item.title?.toLowerCase().includes(query)) return true;
            // 미리보기 검색
            if (item.preview?.toLowerCase().includes(query)) return true;
            // 날짜 검색
            if (item.date.includes(query)) return true;
            // 감정 검색
            if (item.mood?.emotion?.toLowerCase().includes(query)) return true;
            return false;
        });
    }, [list, searchQuery]);

    // 검색어로 온라인 세션 필터링
    const searchFilteredOnlineSessions = useMemo(() => {
        if (!searchQuery.trim()) return onlineList;
        const query = searchQuery.toLowerCase().trim();
        return onlineList.filter((item) => {
            // 제목 검색
            if (item.title?.toLowerCase().includes(query)) return true;
            // 미리보기 검색
            if (item.preview?.toLowerCase().includes(query)) return true;
            // 날짜 검색
            if (item.date.includes(query)) return true;
            return false;
        });
    }, [onlineList, searchQuery]);

    // 검색어 + 날짜 필터 통합 (AI)
    const finalFilteredAISessions = useMemo(() => {
        let result = searchFilteredAISessions;
        if (filterDate) {
            result = result.filter(item => item.date === filterDate);
        }
        return result;
    }, [searchFilteredAISessions, filterDate]);

    // 검색어 + 날짜 필터 통합 (온라인)
    const finalFilteredOnlineSessions = useMemo(() => {
        let result = searchFilteredOnlineSessions;
        if (filterDate) {
            result = result.filter(item => item.date === filterDate);
        }
        return result;
    }, [searchFilteredOnlineSessions, filterDate]);

    // 최종 필터링된 AI 세션 날짜별 그룹화
    const finalFilteredAIGroupedByDate = useMemo(() => {
        const grouped = new Map<string, DiaryListItem[]>();
        finalFilteredAISessions.forEach((item) => {
            const date = item.date;
            if (!grouped.has(date)) {
                grouped.set(date, []);
            }
            grouped.get(date)!.push(item);
        });
        return Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    }, [finalFilteredAISessions]);

    // 최종 필터링된 온라인 세션 날짜별 그룹화
    const finalFilteredOnlineGroupedByDate = useMemo(() => {
        const grouped = new Map<string, DiaryListItem[]>();
        finalFilteredOnlineSessions.forEach((item) => {
            const date = item.date;
            if (!grouped.has(date)) {
                grouped.set(date, []);
            }
            grouped.get(date)!.push(item);
        });
        return Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    }, [finalFilteredOnlineSessions]);

    // 날짜 펼치기/접기 토글
    const toggleDate = (date: string) => {
        setExpandedDates((prev) => {
            const next = new Set(prev);
            if (next.has(date)) {
                next.delete(date);
            } else {
                next.add(date);
            }
            return next;
        });
    };

    // useCallback으로 최적화된 refreshList
    const refreshList = useCallback(async () => {
        try {
            setLoadingList(true);
            // AI 세션 목록 조회
            const aiRes = await fetch('/api/diary/sessions?type=ai', { credentials: 'include' });
            if (aiRes.ok) {
                const aiData: DiarySessionsApiResponse = await aiRes.json();
                if (Array.isArray(aiData?.items)) {
                    setList(aiData.items.map((d) => ({ ...d, _id: String(d._id) })));
                }
            }
            
            // 온라인 채팅 목록 조회
            const onlineRes = await fetch('/api/diary/sessions?type=online', { credentials: 'include' });
            if (onlineRes.ok) {
                const onlineData: DiarySessionsApiResponse = await onlineRes.json();
                if (Array.isArray(onlineData?.items)) {
                    setOnlineList(onlineData.items.map((d) => ({ ...d, _id: String(d._id) })));
                }
            }
        } catch {
            showToast({ message: '다이어리 목록을 불러오는데 실패했습니다.', type: 'error' });
        } finally {
            setLoadingList(false);
        }
    }, [showToast]);

      const loadSession = async (sessionId: string) => {
        try {
            setLoadingDiary(true);
          const res = await fetch(`/api/diary/session/${sessionId}`, { credentials: 'include' });
            if (!res.ok) return;
                    const data: DiarySessionDetailApiResponse = await res.json();
            // DEV 환경 디버깅
            if (import.meta.env.DEV) {
                console.log('📂 Load Session:', { sessionId, mood: data?.session?.mood, summary: data?.session?.summary });
            }
            const msgs: DiaryMessage[] = Array.isArray(data?.messages)
                        ? data.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }))
                : [];
            
            const sessionType = (data?.session?.type || 'ai') as 'ai' | 'online';
            const originalMessageCount = data?.session?.originalMessageCount || 0;
            setCurrentSessionType(sessionType);
            
            // 요약 및 메모 로드 (온라인 채팅 세션만)
            if (sessionType === 'online') {
                setSummary(data?.session?.summary || '');
                setMemo(data?.session?.memo || '');
            } else {
                setSummary('');
                setMemo('');
            }
            
            // DEV 환경 디버깅
            if (import.meta.env.DEV) {
                console.log('🔍 Session:', { sessionType, count: msgs.length });
            }
            
            // 온라인 채팅 세션인 경우, 원본 메시지와 AI 대화 메시지 분리
            if (sessionType === 'online') {
                // originalMessageCount가 0이거나 없으면 모든 메시지를 원본으로 처리
                const effectiveOriginalCount = originalMessageCount > 0 ? originalMessageCount : msgs.length;
                
                // 원본 메시지와 AI 대화 메시지를 분리
                const originalMsgs = msgs.slice(0, effectiveOriginalCount);
                const allAiChatMsgs = msgs.slice(effectiveOriginalCount);
                
                // AI 대화에서 자동요약 요청 메시지 필터링
                const aiChatMsgs = allAiChatMsgs.filter(msg => 
                    !(msg.role === 'user' && msg.content.startsWith('[자동요약]'))
                );
                
                if (import.meta.env.DEV) {
                    console.log('✅ Split:', { original: originalMsgs.length, aiChat: aiChatMsgs.length });
                }
                
                setOnlineOriginalMessages(originalMsgs);
                setAiChatMessages(aiChatMsgs);
                setMessages([]); // AI 대화 탭용 메시지 비움
            } else {
                if (import.meta.env.DEV) console.log('✅ AI messages:', msgs.length);
                setMessages(msgs);
                setOnlineOriginalMessages([]);
                setAiChatMessages([]);
            }
            
            // 사용자 메시지만 카운트
            const userMsgCount = msgs.filter(m => m.role === 'user').length;
            setMessageCount(userMsgCount);
            
            // mood 설정 (디버깅 로그 추가)
            const sessionMood = data?.session?.mood ?? null;
            if (import.meta.env.DEV) {
                console.log('🎨 Setting mood:', sessionMood);
            }
            setMood(sessionMood);
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
                    // AI 세션 목록 조회
                    const aiRes = await fetch('/api/diary/sessions?type=ai', { credentials: 'include' });
                    if (aiRes.ok) {
                        const aiData: DiarySessionsApiResponse = await aiRes.json();
                        const items: DiarySessionResponse[] = Array.isArray(aiData?.items) ? aiData.items : [];
                        setList(items.map((d) => ({ ...d, _id: String(d._id) })));
                        
                        if (items.length === 0) {
                            // 첫 세션 자동 생성
                            await createToday();
                        } else {
                            const id = String(items[0]._id);
                            const firstDate = items[0].date;
                            setSelected(id);
                            await loadSession(id);
                            // 첫 번째 날짜 자동으로 펼치기
                            setExpandedDates(new Set([firstDate]));
                        }
                    }
                    
                    // 온라인 채팅 목록도 함께 로드
                    const onlineRes = await fetch('/api/diary/sessions?type=online', { credentials: 'include' });
                    if (onlineRes.ok) {
                        const onlineData: DiarySessionsApiResponse = await onlineRes.json();
                        if (Array.isArray(onlineData?.items)) {
                            setOnlineList(onlineData.items.map((d) => ({ ...d, _id: String(d._id) })));
                        }
                    }
                } catch {
                    // ignore
                }
            })();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [loading, user]);

    // AI 대화 시작 - 온라인 채팅 세션에서 사용자가 직접 AI와 대화를 시작할 때 사용
    // 자동 요약은 하지 않음

    // 탭 전환 시 각 탭의 최신 세션 자동 선택
    useEffect(() => {
        // AI 대화 탭이 활성화되고, AI 세션 목록이 있을 때
        if (activeTab === 'ai' && list.length > 0) {
            // 현재 선택된 세션이 AI 세션인지 확인
            const currentIsAI = list.some(item => item._id === selected);
            
            if (!currentIsAI) {
                // 최신 AI 세션 선택
                const latestAI = list[0];
                if (import.meta.env.DEV) {
                    console.log('🔄 Auto-selecting latest AI session:', latestAI._id);
                }
                setSelected(latestAI._id);
                setSelectedDate(latestAI.date);
                setExpandedDates(prev => new Set([...prev, latestAI.date]));
                void loadSession(latestAI._id);
            }
        }
        
        // 온라인 채팅 탭이 활성화되고, pending 세션이 없으며, 온라인 목록이 있을 때
        if (activeTab === 'online' && !pendingOnlineSessionId && onlineList.length > 0) {
            // 현재 선택된 세션이 온라인 세션인지 확인
            const currentIsOnline = onlineList.some(item => item._id === selected);
            
            if (!currentIsOnline) {
                // 최신 온라인 세션 선택
                const latestOnline = onlineList[0];
                if (import.meta.env.DEV) {
                    console.log('🔄 Auto-selecting latest online session:', latestOnline._id);
                }
                setSelected(latestOnline._id);
                setSelectedDate(latestOnline.date);
                setExpandedDates(prev => new Set([...prev, latestOnline.date]));
                void loadSession(latestOnline._id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, list, onlineList, pendingOnlineSessionId]);

    // 온라인 채팅에서 저장 후 이동 시 처리
    useEffect(() => {
        const state = location.state as { 
            activeTab?: 'ai' | 'online'; 
            sessionId?: string; 
            date?: string; 
            autoSummarize?: boolean 
        } | null;
        
        if (state?.activeTab === 'online' && state?.sessionId) {
            if (import.meta.env.DEV) {
                console.log('🔵 Online chat saved, navigating to diary:', {
                    sessionId: state.sessionId,
                    date: state.date,
                    autoSummarize: state.autoSummarize
                });
            }
            
            setActiveTab('online');
            if (state.date) {
                setSelectedDate(state.date);
                setExpandedDates(new Set([state.date]));
            }
            
            // pending 세션 ID 설정 (onlineList 업데이트 후 자동 선택됨)
            setPendingOnlineSessionId(state.sessionId);
            
            // 자동 요약 플래그가 있으면 요약 시작
            if (state.autoSummarize && state.sessionId) {
                // 세션 로딩 후 요약 실행 (약간의 지연)
                setTimeout(() => {
                    void summarizeConversation(state.sessionId!);
                }, 1000);
            }
            
            // 목록 새로고침
            void refreshList();
            
            // state 초기화
            navigate(location.pathname, { replace: true, state: null });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);
    
    // 탭 전환 또는 세션 선택 시 mood 업데이트 (오브 색상 동기화)
    // 깜빡임 방지: mood가 없을 때도 이전 색상 유지
    useEffect(() => {
        if (!selected) {
            if (import.meta.env.DEV) console.log('🔄 No session selected, keeping previous mood');
            // mood를 null로 설정하지 않고 이전 값 유지 (깜빡임 방지)
            return;
        }
        
        // 현재 탭에 맞는 목록에서 선택된 세션 찾기
        const currentList = activeTab === 'ai' ? list : onlineList;
        const currentSession = currentList.find(s => s._id === selected);
        
        if (currentSession?.mood) {
            if (import.meta.env.DEV) {
                console.log('🔄 Tab/Session changed, updating mood for orb:', {
                    tab: activeTab,
                    sessionId: selected,
                    emotion: currentSession.mood.emotion,
                    color: currentSession.mood.color
                });
            }
            setMood(currentSession.mood);
        } else {
            // mood가 없어도 이전 색상 유지 (깜빡임 방지)
            if (import.meta.env.DEV) console.log('🔄 Session has no mood, keeping previous color');
        }
    }, [activeTab, selected, list, onlineList]);
    
    // onlineList 업데이트 시 pending 세션 자동 선택
    useEffect(() => {
        if (pendingOnlineSessionId && onlineList.length > 0) {
            if (import.meta.env.DEV) {
                console.log('🔍 Checking for pending session:', {
                    pendingId: pendingOnlineSessionId,
                    onlineListCount: onlineList.length,
                    onlineListIds: onlineList.map(s => s._id)
                });
            }
            
            // onlineList에서 해당 세션을 찾음
            const targetSession = onlineList.find(item => item._id === pendingOnlineSessionId);
            
            if (targetSession) {
                if (import.meta.env.DEV) {
                    console.log('✅ Auto-selecting online session:', {
                        sessionId: pendingOnlineSessionId,
                        date: targetSession.date,
                        title: targetSession.title
                    });
                }
                
                // 날짜 펼치기
                setExpandedDates(prev => new Set([...prev, targetSession.date]));
                
                // 세션 선택 및 로드
                setSelected(pendingOnlineSessionId);
                setSelectedDate(targetSession.date);
                
                // 세션 데이터 로드 (AI 요약은 자동 생성하지 않음)
                void loadSession(pendingOnlineSessionId).then(() => {
                    if (import.meta.env.DEV) {
                        console.log('✅ Auto-loaded online session without auto-summary');
                    }
                    
                    // 선택된 세션으로 스크롤 (약간의 지연 후)
                    setTimeout(() => {
                        const sessionElement = document.querySelector(`[data-session-id="${pendingOnlineSessionId}"]`);
                        if (import.meta.env.DEV) {
                            console.log('📍 Scrolling to session:', {
                                sessionId: pendingOnlineSessionId,
                                element: sessionElement
                            });
                        }
                        if (sessionElement) {
                            sessionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }, 300);
                });
                
                // pending 상태 초기화
                setPendingOnlineSessionId(null);
            } else {
                if (import.meta.env.DEV) {
                    console.warn('⚠️ Pending session not found in onlineList:', pendingOnlineSessionId);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onlineList, pendingOnlineSessionId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, aiChatMessages, sending]);

    // 메모 자동 저장 (온라인 채팅 세션, 1초 debounce)
    useEffect(() => {
        if (!selected || currentSessionType !== 'online') return;
        
        const timer = setTimeout(async () => {
            try {
                await fetch(`/api/diary/session/${selected}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ memo })
                });
                
                if (import.meta.env.DEV) {
                    console.log('💾 Memo auto-saved:', { sessionId: selected, memoLength: memo.length });
                }
            } catch (error) {
                console.error('메모 저장 실패:', error);
            }
        }, 1000); // 1초 대기 후 저장
        
        return () => clearTimeout(timer);
    }, [memo, selected, currentSessionType]);

    // useCallback으로 최적화된 send
    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true);
        setShowWelcomeMessage(false); // 첫 메시지 입력 시 환영 메시지 숨김
        
        // 온라인 채팅 탭인 경우 aiChatMessages 사용
        const isOnlineTab = currentSessionType === 'online';
        
        if (isOnlineTab) {
            const optimistic = [...aiChatMessages, { role: 'user' as const, content: text }];
            setAiChatMessages(optimistic);
        } else {
            const optimistic = [...messages, { role: 'user' as const, content: text }];
            setMessages(optimistic);
        }
        
        setInput('');
        try {
            // 임시 타이핑 표시
            if (isOnlineTab) {
                setAiChatMessages((prev) => [...prev, { role: 'assistant', content: '…' }]);
            } else {
                setMessages((prev) => [...prev, { role: 'assistant', content: '…' }]);
            }
            
            const res = await fetch(`/api/diary/session/${selected}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text }),
            });
            if (!res.ok) {
                if (isOnlineTab) {
                    setAiChatMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: '답변 생성에 실패했습니다.' }]);
                } else {
                    setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: '답변 생성에 실패했습니다.' }]);
                }
                return;
            }
            const data = await res.json();
            if (import.meta.env.DEV) {
                console.log('📨 Response:', { mood: data?.mood?.emotion });
            }
            
            if (isOnlineTab) {
                setAiChatMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: data?.assistant?.content || '' }]);
            } else {
                setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: data?.assistant?.content || '' }]);
            }
            
            const newMood = data?.mood ?? null;
            const newMessageCount = data?.messageCount || (isOnlineTab ? aiChatMessages.length + 2 : messages.length + 2);
            const prevCanAnalyze = canAnalyze;
            
            setMood(newMood);
            setMessageCount(newMessageCount);
            
            // 최소 메시지 도달 시 토스트 알림 + 진단 완료 애니메이션
            const newCanAnalyze = newMessageCount >= MIN_REQUIRED_MESSAGES;
            if (newCanAnalyze && !prevCanAnalyze && newMood) {
                showToast({ 
                    message: '✨ 충분한 대화가 쌓였어요! 전체 감정 분석이 완료되었습니다.', 
                    type: 'success',
                    duration: 4000
                });
                
                // 진단 완료 애니메이션 표시
                setShowCompletedAnimation(true);
                setTimeout(() => {
                    setShowCompletedAnimation(false);
                }, 2000); // 2초 후 자동 숨김
            }
            
            await refreshList();
        } catch {
            setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
        } finally {
            setSending(false);
        }
    }, [input, sending, currentSessionType, aiChatMessages, messages, selected, canAnalyze, MIN_REQUIRED_MESSAGES, showToast, refreshList]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
            e.preventDefault();
            void send();
        }
    };

    // 수동 감정 분석
    const manualAnalyze = async () => {
        if (isAnalyzing || !selected || messageCount < 2) return;
        
        setIsAnalyzing(true);
        try {
            const res = await fetch(`/api/diary/session/${selected}/analyze`, {
                method: 'POST',
                credentials: 'include',
            });
            
            if (!res.ok) {
                const error = await res.json();
                showToast({ 
                    message: error.message || '분석에 실패했습니다.', 
                    type: 'error',
                    duration: 3000
                });
                return;
            }
            
            const data = await res.json();
            if (import.meta.env.DEV) {
                console.log('🎨 Analyze:', data?.mood);
            }
            setMood(data?.mood ?? null);
            
            showToast({ 
                message: '🎨 감정 분석이 완료되었습니다!', 
                type: 'success',
                duration: 3000
            });
            
            await refreshList();
        } catch (error) {
            showToast({ 
                message: '네트워크 오류가 발생했습니다.', 
                type: 'error',
                duration: 3000
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 대화 요약 함수
    const summarizeConversation = async (sessionId: string) => {
        if (isSummarizing) return;
        
        setIsSummarizing(true);
        showToast({ 
            message: '💭 AI가 대화 내용을 분석하고 있습니다...', 
            type: 'info',
            duration: 2000
        });
        
        try {
            const res = await fetch(`/api/diary/session/${sessionId}/summarize`, {
                method: 'POST',
                credentials: 'include',
            });
            
            if (!res.ok) {
                const error = await res.json();
                showToast({ 
                    message: error.message || '요약에 실패했습니다.', 
                    type: 'error',
                    duration: 3000
                });
                return;
            }
            
            const data = await res.json();
            if (import.meta.env.DEV) {
                console.log('📝 Summary:', data?.summary);
            }
            
            setSummary(data?.summary || '');
            
            showToast({ 
                message: '✅ 대화 요약이 완료되었습니다!', 
                type: 'success',
                duration: 3000
            });
            
        } catch (error) {
            console.error('요약 에러:', error);
            showToast({ 
                message: '네트워크 오류가 발생했습니다.', 
                type: 'error',
                duration: 3000
            });
        } finally {
            setIsSummarizing(false);
        }
    };

    const deleteSession = async (id: string) => {
        if (!id) return;
        if (!confirm('이 대화 전체를 삭제할까요? 되돌릴 수 없습니다.')) return;
        try {
            const res = await fetch(`/api/diary/session/${id}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                showToast({ message: '다이어리가 삭제되었습니다.', type: 'success' });
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
                showToast({ message: msg, type: 'error' });
            }
        } catch {
            showToast({ message: '삭제 중 오류가 발생했습니다.', type: 'error' });
        }
    };

        const createToday = async () => {
            try {
                const today = todayKey();
                const res = await fetch('/api/diary/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ date: today, type: 'ai' }) }); // AI 대화 타입 명시
                if (!res.ok) return;
                const data = await res.json();
                const id = String(data?.id);
                setSelected(id);
                setShowWelcomeMessage(true); // 새 대화 생성 시 환영 메시지 표시
                await loadSession(id);
                // 새 대화가 추가된 날짜를 자동으로 펼치기
                setExpandedDates((prev) => new Set(prev).add(today));
            } catch {}
        };

        // 제목 수정 시작
        const startEditTitle = (sessionId: string, currentTitle: string) => {
            setEditingSessionId(sessionId);
            setEditingTitle(currentTitle);
        };

        // 제목 수정 저장
        const saveTitle = async (sessionId: string) => {
            if (!editingTitle.trim()) {
                showToast({ message: '제목을 입력해주세요.', type: 'warning' });
                return;
            }

            try {
                const res = await fetch(`/api/diary/session/${sessionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ title: editingTitle.trim() })
                });

                if (!res.ok) {
                    throw new Error('제목 저장 실패');
                }

                // 목록 갱신
                await refreshList();
                showToast({ message: '제목이 저장되었습니다! ✓', type: 'success', duration: 2000 });
                setEditingSessionId(null);
                setEditingTitle('');
            } catch (error) {
                showToast({ message: '제목 저장에 실패했습니다.', type: 'error' });
            }
        };

        // 제목 수정 취소
        const cancelEditTitle = () => {
            setEditingSessionId(null);
            setEditingTitle('');
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
        <>
            <ToastContainer />
            <div className="diary-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, height: 'calc(100vh - 56px)', boxSizing: 'border-box', overflow: 'hidden' }}>
                {/* 좌측: 목록 + 툴바 */}
                <aside className="diary-sidebar" style={{ borderRight: '1px solid #e5e7eb', padding: 12, background: '#fafafa', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
                {/* 탭 전환 버튼 */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#fff', borderRadius: 10, padding: 4, border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
                    <button
                        onClick={() => setActiveTab('ai')}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: 'none',
                            borderRadius: 8,
                            background: activeTab === 'ai' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                            color: activeTab === 'ai' ? '#fff' : '#6b7280',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: 13,
                        }}
                    >
                        🤖 AI 대화
                    </button>
                    <button
                        onClick={() => setActiveTab('online')}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: 'none',
                            borderRadius: 8,
                            background: activeTab === 'online' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                            color: activeTab === 'online' ? '#fff' : '#6b7280',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: 13,
                        }}
                    >
                        💬 온라인 채팅
                    </button>
                </div>

                {/* 검색 입력창 - 최상단으로 이동 */}
                <div style={{ marginBottom: 16, padding: '6px', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
                    <input
                        type="text"
                        placeholder={activeTab === 'ai' ? '🔍 AI 대화 검색...' : '🔍 온라인 채팅 검색...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid #e5e7eb',
                            background: '#f9fafb',
                            fontSize: 12,
                            transition: 'all 0.3s ease',
                            boxSizing: 'border-box',
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#6366f1';
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    />
                </div>

                {/* 달력 */}
                <DiaryCalendar 
                    sessions={activeTab === 'ai' ? list : onlineList}
                    onDateSelect={setFilterDate}
                    selectedDate={filterDate}
                    activeTab={activeTab}
                />

                {/* 탭별 헤더 */}
                {activeTab === 'ai' && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, marginTop: 8 }}>날짜별 AI 대화</div>
                )}

                {activeTab === 'online' && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, marginTop: 8 }}>온라인 채팅 기록</div>
                )}

                {/* AI 대화 목록 */}
                {activeTab === 'ai' && (
                    <div className="diary-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                        {loadingList ? (
                            <DiaryListSkeleton />
                        ) : list.length === 0 ? (
                            <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 8px', background: '#fff', borderRadius: 8 }}>
                                아직 AI 대화 기록이 없습니다.<br/>첫 대화를 시작해 보세요! 🌟
                            </div>
                        ) : finalFilteredAIGroupedByDate.length === 0 ? (
                            <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 8px', background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                                {searchQuery || filterDate ? '검색 결과가 없습니다' : '대화를 시작해 보세요! 🌟'}
                            </div>
                        ) : (
                            finalFilteredAIGroupedByDate.map(([date, sessions]) => {
                                const isExpanded = expandedDates.has(date);
                                const sessionCount = sessions.length;
                                
                                return (
                                    <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {/* 날짜 폴더 헤더 */}
                                        <button
                                            onClick={() => toggleDate(date)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '6px 10px',
                                                borderRadius: 8,
                                                border: '1px solid #d1d5db',
                                                background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)';
                                                e.currentTarget.style.borderColor = '#9ca3af';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)';
                                                e.currentTarget.style.borderColor = '#d1d5db';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 12, transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                    ▶
                                                </span>
                                                <span style={{ fontSize: 14 }}>📁</span>
                                                <span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>
                                                    {highlightText(date, searchQuery)}
                                                </span>
                                                <span style={{ fontSize: 10, color: '#6b7280', background: '#fff', padding: '2px 6px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                                                    {sessionCount}개
                                                </span>
                                            </div>
                                        </button>

                                        {/* 날짜별 세션 목록 (펼쳐진 경우만) */}
                                        {isExpanded && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 16, position: 'relative' }}>
                                                {/* 세로선 */}
                                                <div style={{ 
                                                    position: 'absolute', 
                                                    left: 8, 
                                                    top: 0, 
                                                    bottom: 0, 
                                                    width: 2, 
                                                    background: 'linear-gradient(to bottom, #e5e7eb 0%, transparent 100%)' 
                                                }} />
                                                
                                                {sessions.map((item, idx) => {
                                                    const active = item._id === selected;
                                                    const isEditing = editingSessionId === item._id;
                                                    const displayTitle = item.title || `대화 ${idx + 1}`;
                                                    
                                                    return (
                                                        <div
                                                            key={item._id}
                                                            style={{
                                                                padding: '6px 8px',
                                                                borderRadius: 8,
                                                                border: `1px solid ${active ? '#6366f1' : '#e5e7eb'}`,
                                                                background: active ? '#eef2ff' : '#fff',
                                                                transition: 'all 0.2s ease',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                                                {isEditing ? (
                                                                    // 제목 수정 모드
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                                                        <input
                                                                            type="text"
                                                                            value={editingTitle}
                                                                            onChange={(e) => setEditingTitle(e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    void saveTitle(item._id);
                                                                                } else if (e.key === 'Escape') {
                                                                                    cancelEditTitle();
                                                                                }
                                                                            }}
                                                                            autoFocus
                                                                            style={{
                                                                                flex: 1,
                                                                                padding: '4px 8px',
                                                                                fontSize: 13,
                                                                                border: '1px solid #6366f1',
                                                                                borderRadius: 4,
                                                                                outline: 'none',
                                                                            }}
                                                                            placeholder="제목 입력"
                                                                        />
                                                                        <button
                                                                            onClick={() => void saveTitle(item._id)}
                                                                            style={{
                                                                                padding: '4px 8px',
                                                                                fontSize: 11,
                                                                                border: '1px solid #10b981',
                                                                                background: '#ecfdf5',
                                                                                color: '#065f46',
                                                                                borderRadius: 4,
                                                                                cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            ✓
                                                                        </button>
                                                                        <button
                                                                            onClick={cancelEditTitle}
                                                                            style={{
                                                                                padding: '4px 8px',
                                                                                fontSize: 11,
                                                                                border: '1px solid #9ca3af',
                                                                                background: '#f9fafb',
                                                                                color: '#6b7280',
                                                                                borderRadius: 4,
                                                                                cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    // 일반 모드
                                                                    <>
                                                                        <button
                                                                            onClick={() => { 
                                                                                setSelected(item._id); 
                                                                                setSelectedDate(item.date); 
                                                                                void loadSession(item._id);
                                                                                // 선택한 대화의 날짜를 자동으로 펼치기
                                                                                if (!expandedDates.has(date)) {
                                                                                    setExpandedDates((prev) => new Set(prev).add(date));
                                                                                }
                                                                            }}
                                                                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flex: 1, textAlign: 'left' }}
                                                                        >
                                                                            <div style={{ width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                <EmotionOrbPremium color={item.mood?.color || '#bdbdbd'} size={12} className="no-anim" />
                                                                            </div>
                                                                            <div style={{ 
                                                                                fontWeight: 600, 
                                                                                fontSize: 12,
                                                                                flex: 1,
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                whiteSpace: 'nowrap',
                                                                            }}>
                                                                                {highlightText(displayTitle, searchQuery)}
                                                                            </div>
                                                                        </button>
                                                                        <button
                                                                            title="제목 수정"
                                                                            onClick={() => startEditTitle(item._id, item.title || '')}
                                                                            style={{ 
                                                                                border: '1px solid #3b82f6', 
                                                                                background: '#eff6ff', 
                                                                                color: '#1e3a8a', 
                                                                                borderRadius: 6, 
                                                                                padding: '2px 4px', 
                                                                                cursor: 'pointer', 
                                                                                fontSize: 10 
                                                                            }}
                                                                        >
                                                                            ✏️
                                                                        </button>
                                                                        <button
                                                                            title="이 대화 삭제"
                                                                            onClick={() => void deleteSession(item._id)}
                                                                            style={{ border: '1px solid #ef4444', background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '2px 4px', cursor: 'pointer', fontSize: 10 }}
                                                                        >🗑</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                            {!isEditing && item.preview && (
                                                                <div style={{ 
                                                                    color: '#6b7280', 
                                                                    fontSize: 10, 
                                                                    marginTop: 2, 
                                                                    marginLeft: 20,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {highlightText(item.preview, searchQuery)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* 온라인 채팅 목록 */}
                {activeTab === 'online' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                        {loadingList ? (
                            <DiaryListSkeleton />
                        ) : onlineList.length === 0 ? (
                            <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 8px', background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                                💬<br/>
                                아직 온라인 채팅 기록이 없습니다.<br/>
                                온라인 채팅 후 저장해보세요! 🎯
                            </div>
                        ) : finalFilteredOnlineGroupedByDate.length === 0 ? (
                            <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 8px', background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                                {searchQuery || filterDate ? '검색 결과가 없습니다' : '온라인 채팅 후 저장해보세요! 🎯'}
                            </div>
                        ) : (
                            finalFilteredOnlineGroupedByDate.flatMap(([, items]) => 
                                items.map((item) => {
                                    const active = item._id === selected;
                                    const displayTitle = item.title || `온라인 채팅 ${new Date(item.lastUpdatedAt).toLocaleString('ko-KR')}`;
                                    
                                    return (
                                        <div
                                            key={item._id}
                                            data-session-id={item._id}
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: 8,
                                                border: `1px solid ${active ? '#6366f1' : '#e5e7eb'}`,
                                                background: active ? '#eef2ff' : '#fff',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                                <button
                                                    onClick={() => { setSelected(item._id); setSelectedDate(item.date); void loadSession(item._id); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flex: 1, textAlign: 'left' }}
                                                >
                                                    <span style={{ fontSize: 12 }}>💬</span>
                                                    <div style={{ 
                                                        fontWeight: 600, 
                                                        fontSize: 12,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        flex: 1,
                                                        minWidth: 0
                                                    }}>{highlightText(displayTitle, searchQuery)}</div>
                                                </button>
                                                <button
                                                    title="이 채팅 삭제"
                                                    onClick={() => void deleteSession(item._id)}
                                                    style={{ border: '1px solid #ef4444', background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '2px 4px', cursor: 'pointer', fontSize: 10 }}
                                                >🗑</button>
                                            </div>
                                            {item.preview && (
                                                <div style={{ 
                                                    color: '#6b7280', 
                                                    fontSize: 10, 
                                                    marginTop: 2,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '100%'
                                                }}>{highlightText(item.preview, searchQuery)}</div>
                                            )}
                                        </div>
                                    );
                                })
                            )
                        )}
                    </div>
                )}

                {/* 대화 추가 버튼 - AI 탭 하단 고정 */}
                {activeTab === 'ai' && (
                    <div style={{ paddingTop: 12, borderTop: '1px solid #e5e7eb', marginTop: 'auto', boxSizing: 'border-box' }}>
                        <button 
                            onClick={() => void createToday()} 
                            title="새 대화 생성" 
                            style={{ 
                                width: '100%',
                                padding: '10px 12px', 
                                border: '1px solid #2563eb', 
                                borderRadius: 10, 
                                background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', 
                                color: '#fff', 
                                cursor: 'pointer', 
                                fontSize: 14,
                                fontWeight: 600,
                                transition: 'all 0.3s ease',
                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                                boxSizing: 'border-box',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.4)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.2)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            ✨ 대화 추가
                        </button>
                    </div>
                )}
            </aside>

            {/* 우측: 대화 + 배경색 */}
            <main className="diary-main" style={{ padding: 16, boxSizing: 'border-box' }}>
                {activeTab === 'ai' ? (
                    // AI 대화 탭 - 기존 UI 유지
                    <div style={{ ...bgStyle, border: '1px solid #e5e7eb', borderRadius: 12, minHeight: '70vh', padding: 12, position: 'relative', boxSizing: 'border-box' }}>
                        {/* 감정 오브: 채팅창 왼쪽 상단 고정, 크게 */}
                        <div style={{ position: 'absolute', top: -10, left: -10, zIndex: 20, pointerEvents: 'none', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="aurora-breathe" style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', transformOrigin: 'center center' }}>
                                <EmotionOrbPremium 
                                    color={emotionOrbColor} 
                                    size={200}
                                    intensity={0.85}
                                    analyzing={isWaitingAnalysis}
                                    showCompleted={showCompletedAnimation}
                                    messageCount={messageCount}
                                />
                            </div>
                        </div>
                        {/* 날짜/감정/진행률: 오른쪽 상단 정렬 */}
                        <div style={{ position: 'absolute', top: 12, right: 12, textAlign: 'right', minWidth: 200 }}>
                            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{selectedDate}</div>
                            {mood?.emotion ? (
                                <div style={{ 
                                    fontSize: 13, 
                                    color: '#374151', 
                                    background: 'rgba(255,255,255,0.9)',
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: '2px solid #10b981',
                                    fontWeight: 600,
                                    display: 'inline-block'
                                }}>
                                    ✓ 감정: {mood.emotion}
                                </div>
                            ) : messageCount > 0 ? (
                                <div>
                                    <div style={{ 
                                        fontSize: 11, 
                                        color: '#6b7280', 
                                        marginBottom: 6,
                                        fontWeight: 600 
                                    }}>
                                        진행률: {Math.min(100, Math.round((messageCount / MIN_REQUIRED_MESSAGES) * 100))}%
                                    </div>
                                    {/* 진행률 바 */}
                                    <div style={{ 
                                        width: '100%', 
                                        height: 8, 
                                        background: '#e5e7eb', 
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                                    }}>
                                        <div style={{ 
                                            width: `${Math.min(100, (messageCount / MIN_REQUIRED_MESSAGES) * 100)}%`, 
                                            height: '100%', 
                                            background: messageCount >= MIN_REQUIRED_MESSAGES 
                                                ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' 
                                                : 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
                                            transition: 'width 0.5s ease',
                                            borderRadius: 4
                                        }} />
                                    </div>
                                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                                        {messageCount}/{MIN_REQUIRED_MESSAGES} 사용자 메시지
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* 분석 전 안내 배너 + 수동 분석 버튼 */}
                        {!mood && messageCount > 0 && (
                            <div style={{ 
                                position: 'absolute', 
                                top: 100, 
                                left: '50%', 
                                transform: 'translateX(-50%)', 
                                background: messageCount >= MIN_REQUIRED_MESSAGES 
                                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                                    : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                padding: '14px 24px',
                                borderRadius: 14,
                                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
                                zIndex: 2,
                                fontSize: 13,
                                fontWeight: 600,
                                color: messageCount >= MIN_REQUIRED_MESSAGES ? '#065f46' : '#92400e',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                border: messageCount >= MIN_REQUIRED_MESSAGES 
                                    ? '2px solid #10b981'
                                    : '2px solid #fbbf24',
                                maxWidth: '90%'
                            }}>
                                <span style={{ fontSize: 18 }}>
                                    {messageCount >= MIN_REQUIRED_MESSAGES ? '✨' : '💭'}
                                </span>
                                <div style={{ flex: 1 }}>
                                    {messageCount >= MIN_REQUIRED_MESSAGES ? (
                                        <span>충분한 대화가 쌓였어요! 감정을 분석할 수 있습니다.</span>
                                    ) : (
                                        <span>
                                            권장: {MIN_REQUIRED_MESSAGES - messageCount}개 더 대화 | 
                                            {messageCount >= 2 ? ' 지금도 분석 가능' : ' 최소 1턴 필요'}
                                        </span>
                                    )}
                                </div>
                                {messageCount >= 2 && (
                                    <button
                                        onClick={manualAnalyze}
                                        disabled={isAnalyzing}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: isAnalyzing 
                                                ? '#9ca3af'
                                                : messageCount >= MIN_REQUIRED_MESSAGES
                                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                            color: '#fff',
                                            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                            transition: 'all 0.2s ease',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isAnalyzing) {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                                        }}
                                    >
                                        {isAnalyzing ? '분석중...' : '🎨 지금 분석하기'}
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="diary-chat-area" style={{ border: '1px solid #e5e7eb', borderRadius: 12, height: '55vh', maxHeight: '55vh', padding: 12, overflowY: 'auto', background: 'rgba(255,255,255,0.75)', width: 'min(100%, 1200px)', margin: '96px auto 0', boxSizing: 'border-box', position: 'relative' }}>
                            {/* 환영 메시지 오버레이 */}
                            {showWelcomeMessage && messages.length === 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(0, 0, 0, 0.4)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    borderRadius: 12,
                                    zIndex: 10,
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        fontSize: 24,
                                        fontWeight: 700,
                                        color: '#ffffff',
                                        textAlign: 'center',
                                        lineHeight: 1.6,
                                        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                        padding: '0 20px'
                                    }}>
                                        당신의 감정에 공명하겠습니다<br />
                                        당신의 이야기를 들려주세요
                                    </div>
                                </div>
                            )}
                            
                            {loadingDiary ? (
                                <ChatLoadingSkeleton />
                            ) : (
                                messages.map(Bubble)
                            )}
                            <div ref={bottomRef} />
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
                            <textarea
                                ref={textareaRef}
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
                ) : (
                    // 온라인 채팅 탭 - 상단: 온라인 대화 기록 (읽기 전용), 하단: AI와 대화
                    <div style={{ ...bgStyle, border: '1px solid #e5e7eb', borderRadius: 12, height: 'calc(100vh - 88px)', padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* 상단: 온라인 채팅 기록 (읽기 전용) */}
                        <div style={{ flex: '0 0 280px', minHeight: 0, maxHeight: '280px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>💬</span>
                                    <span>온라인 채팅 기록</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280' }}>{selectedDate}</div>
                            </div>
                            <div style={{ 
                                flex: 1, 
                                minHeight: 0,
                                border: '2px solid #e5e7eb', 
                                borderRadius: 12, 
                                padding: 12, 
                                overflowY: 'auto', 
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                            }}>
                                {loadingDiary ? (
                                    <ChatLoadingSkeleton />
                                ) : onlineOriginalMessages.length > 0 ? (
                                    onlineOriginalMessages.map(Bubble)
                                ) : (
                                    <div style={{ 
                                        textAlign: 'center', 
                                        color: '#9ca3af', 
                                        padding: '40px 20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 12
                                    }}>
                                        <div style={{ fontSize: 48, opacity: 0.5 }}>💬</div>
                                        <div style={{ fontSize: 14 }}>온라인 채팅 기록이 없습니다</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 중간: AI 요약 섹션 */}
                        <div style={{ 
                            flexShrink: 0,
                            border: `2px solid ${mood?.color || '#e5e7eb'}`, 
                            borderRadius: 16, 
                            padding: 20, 
                            background: mood?.color 
                                ? `linear-gradient(135deg, ${mood.color}15 0%, ${mood.color}25 100%)`
                                : 'linear-gradient(135deg, rgba(249,250,251,0.98) 0%, rgba(243,244,246,0.98) 100%)',
                            boxShadow: mood?.color 
                                ? `0 4px 16px ${mood.color}20`
                                : '0 4px 16px rgba(0,0,0,0.05)',
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 20 }}>📝</span>
                                <span style={{ 
                                    fontSize: 16, 
                                    fontWeight: 700, 
                                    color: mood?.color || '#374151',
                                    transition: 'color 0.3s ease'
                                }}>
                                    대화 요약
                                </span>
                                {isSummarizing && (
                                    <span style={{ 
                                        fontSize: 13, 
                                        color: mood?.color || '#6b7280', 
                                        marginLeft: 'auto',
                                        transition: 'color 0.3s ease'
                                    }}>
                                        분석 중...
                                    </span>
                                )}
                            </div>
                            {isSummarizing ? (
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 12,
                                    padding: '20px 0',
                                    justifyContent: 'center'
                                }}>
                                    <div className="loading-spinner" style={{
                                        width: 24,
                                        height: 24,
                                        border: `3px solid ${mood?.color || '#e5e7eb'}40`,
                                        borderTop: `3px solid ${mood?.color || '#9ca3af'}`,
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    <span style={{ 
                                        fontSize: 14, 
                                        color: mood?.color || '#374151',
                                        transition: 'color 0.3s ease'
                                    }}>
                                        AI가 대화 내용을 분석하고 있습니다...
                                    </span>
                                </div>
                            ) : summary ? (
                                <div style={{ 
                                    fontSize: 14, 
                                    lineHeight: 1.8, 
                                    color: '#374151',
                                    whiteSpace: 'pre-wrap',
                                    background: 'rgba(255,255,255,0.7)',
                                    padding: 12,
                                    borderRadius: 8,
                                    border: `1px solid ${mood?.color || '#e5e7eb'}40`,
                                    transition: 'border-color 0.3s ease'
                                }}>
                                    {summary}
                                </div>
                            ) : (
                                <div style={{ 
                                    fontSize: 14, 
                                    lineHeight: 1.8, 
                                    color: '#9ca3af',
                                    textAlign: 'center',
                                    padding: '20px 0'
                                }}>
                                    온라인 채팅을 저장하면 AI가 대화를 요약해드립니다.
                                </div>
                            )}
                        </div>

                        {/* 하단: 메모장 */}
                        <div style={{ 
                            flex: '1 1 auto', 
                            minHeight: 0,
                            border: '2px solid #9ca3af', 
                            borderRadius: 16, 
                            padding: 20, 
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.98) 100%)', 
                            position: 'relative',
                            boxSizing: 'border-box',
                            boxShadow: '0 4px 16px rgba(156,163,175,0.15)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            
                            <div style={{ marginBottom: 12, flexShrink: 0 }}>
                                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>📝</span>
                                    <span>메모</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280' }}>
                                    이 대화에 대한 개인적인 생각이나 메모를 남겨보세요
                                </div>
                            </div>
                            
                            {/* 메모 입력 영역 */}
                            <textarea
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                placeholder="온라인 채팅에 대한 생각이나 느낌을 자유롭게 작성해보세요...&#10;&#10;예시:&#10;- 오늘 대화에서 느낀 감정&#10;- 기억하고 싶은 부분&#10;- 나중에 다시 보고 싶은 내용"
                                style={{ 
                                    flex: 1,
                                    padding: 16,
                                    border: '2px solid #e5e7eb',
                                    borderRadius: 12,
                                    resize: 'none',
                                    background: 'rgba(255,255,255,0.8)',
                                    fontSize: 14,
                                    lineHeight: 1.6,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    transition: 'all 0.2s ease',
                                    minHeight: 0
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = '#9ca3af';
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(156,163,175,0.1)';
                                    e.currentTarget.style.background = '#ffffff';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                                }}
                            />
                            
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginTop: 12,
                                fontSize: 12,
                                color: '#9ca3af',
                                flexShrink: 0
                            }}>
                                <span>{memo.length}자</span>
                                <span>💡 메모는 자동으로 저장됩니다</span>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
        </>
    );
}