// Diary.tsx — 날짜별 다이어리 + AI 대화 저장/조회
import { useCallback, useEffect, useMemo, useRef, useState, Component } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDisplay } from "../contexts/DisplayContext";
import { useAuth } from '../hooks/useAuth';
import SiriOrb from '../components/SiriOrb';
import ColorCircle from '../components/ColorCircle';
import { useToast } from '../components/Toast';
import { ChatLoadingSkeleton, DiaryListSkeleton } from '../components/Skeleton';
import DiaryCalendar from '../components/DiaryCalendar';
import StreakWidget from '../components/StreakWidget';
import MatchingSuggestionModal from '../components/MatchingSuggestionModal';
import { getColorName } from '../utils/colorUtils';
import type { DiarySessionResponse, DiaryMessageResponse, DiarySessionsApiResponse, DiarySessionDetailApiResponse } from '../types/api';
import "./Diary.css";

type DiaryListItem = DiarySessionResponse;
type DiaryMessage = DiaryMessageResponse;

// WebGL 에러 바운더리
class WebGLErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error('WebGL Error:', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: 14
                }}>
                    오브 로딩 중...
                </div>
            );
        }
        return this.props.children;
    }
}

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

    // 추가 페이지 활성화 설정
    const { setDisplayContent } = useDisplay();

    const location = useLocation();
    const { user, loading } = useAuth();
    const { showToast, ToastContainer } = useToast();

    // 탭 관리: 'ai' (AI 대화) 또는 'online' (온라인 채팅)
    const [activeTab, setActiveTab] = useState<'ai' | 'online'>('ai');

    const [list, setList] = useState<DiaryListItem[]>([]); // AI 세션 목록
    const [onlineList, setOnlineList] = useState<DiaryListItem[]>([]); // 온라인 채팅 목록
    const [selected, setSelected] = useState<string>(''); // 선택된 세션 ID
    const [selectedDate, setSelectedDate] = useState<string>(todayKey());
    const [isToday, setIsToday] = useState<boolean>(true); // 선택된 날짜가 오늘인지 여부
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

    // 주요 키워드 추출 (사용자 메시지에서 가장 많이 나온 단어)
    const keyTopics = useMemo(() => {
        if (messageCount < 2) return [];
        
        const userMessages = messages.filter(msg => msg.role === 'user').map(msg => msg.content);
        const allText = userMessages.join(' ');
        
        // 한글 단어 추출 (2글자 이상)
        const koreanWords = allText.match(/[가-힣]{2,}/g) || [];
        
        // 불용어 제거
        const stopWords = ['하는', '있는', '되는', '같은', '없는', '많은', '그냥', '진짜', '정말', '너무', '정말로', '그래서', '하지만', '그런데', '그리고', '또는', '그리고', '이런', '저런', '어떤', '무슨'];
        const filteredWords = koreanWords.filter(word => !stopWords.includes(word));
        
        // 빈도 계산
        const frequency: { [key: string]: number } = {};
        filteredWords.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        // 상위 5개 추출
        const sorted = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word, count]) => ({ word, count }));
        
        return sorted;
    }, [messageCount, messages]);

    const [isAnalyzing, setIsAnalyzing] = useState(false); // 수동 분석 중
    const [showCompletedAnimation, setShowCompletedAnimation] = useState(false); // 진단 완료 애니메이션
    const [showMatchingSuggestion, setShowMatchingSuggestion] = useState(false); // 매칭 제안 대화창
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
    const [partnerNickname, setPartnerNickname] = useState<string>(''); // 온라인 채팅 상대방 닉네임
    const hasSummarizedSessionRef = useRef<string | null>(null); // 이미 요약 실행한 세션 ID (중복 방지)
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null); // textarea 참조

    useEffect(() => {
        if (loading) return;
        if (!user) setDisplayContent("login");
    }, [loading, user, navigate]);

    // Enter 키 전역 리스너: AI 대화 탭에서만 작동, textarea가 포커스되지 않은 상태에서 Enter 누르면 포커스
    useEffect(() => {
        // AI 대화 탭이 아니면 리스너 등록하지 않음
        if (activeTab !== 'ai') return;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Enter 키이고, textarea가 이미 포커스되어 있지 않으면
            if (e.key === 'Enter' && document.activeElement !== textareaRef.current) {
                // input, textarea, button, contenteditable 등이 아닌 곳에서만 동작
                const target = e.target as HTMLElement;
                const isEditable = target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'BUTTON' ||
                    target.isContentEditable;

                if (!isEditable) {
                    e.preventDefault();
                    textareaRef.current?.focus();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [activeTab]);

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

    // 오늘 날짜의 AI 대화가 있는지 확인
    const hasTodayAISession = useMemo(() => {
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return list.some(session => session.date === todayKey);
    }, [list]);

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
                    // lastUpdatedAt 기준 내림차순 정렬 (최신순)
                    const sortedAiList = aiData.items
                        .map((d) => ({ ...d, _id: String(d._id) }))
                        .sort((a, b) => {
                            // lastUpdatedAt 필드로 정렬 (최신 시간이 먼저)
                            const timeA = new Date(a.lastUpdatedAt || 0).getTime();
                            const timeB = new Date(b.lastUpdatedAt || 0).getTime();
                            return timeB - timeA;
                        });
                    setList(sortedAiList);
                }
            }

            // 온라인 채팅 목록 조회
            const onlineRes = await fetch('/api/diary/sessions?type=online', { credentials: 'include' });
            if (onlineRes.ok) {
                const onlineData: DiarySessionsApiResponse = await onlineRes.json();
                if (Array.isArray(onlineData?.items)) {
                    // lastUpdatedAt 기준 내림차순 정렬 (최신순)
                    const sortedOnlineList = onlineData.items
                        .map((d) => ({ ...d, _id: String(d._id) }))
                        .sort((a, b) => {
                            // lastUpdatedAt 필드로 정렬 (최신 시간이 먼저)
                            const timeA = new Date(a.lastUpdatedAt || 0).getTime();
                            const timeB = new Date(b.lastUpdatedAt || 0).getTime();
                            return timeB - timeA;
                        });
                    setOnlineList(sortedOnlineList);
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
                const loadedSummary = data?.session?.summary || '';
                const loadedMemo = data?.session?.memo || '';
                const loadedPartnerNickname = data?.session?.partnerNickname || '';

                if (import.meta.env.DEV) {
                    console.log('📄 Loading summary and memo:', {
                        summary: loadedSummary ? loadedSummary.substring(0, 50) + '...' : '(empty)',
                        memo: loadedMemo ? loadedMemo.substring(0, 30) + '...' : '(empty)',
                        partnerNickname: loadedPartnerNickname
                    });
                }

                setSummary(loadedSummary);
                setMemo(loadedMemo);
                setPartnerNickname(loadedPartnerNickname);
            } else {
                setSummary('');
                setMemo('');
                setPartnerNickname('');
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

            // 오늘 날짜인지 체크
            const sessionDate = String(data?.session?.date || todayKey());
            const today = todayKey();
            setIsToday(sessionDate === today);

            await refreshList();
        } catch { }
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

                    // lastUpdatedAt 기준 내림차순 정렬 (최신순)
                    const sortedItems = items
                        .map((d) => ({ ...d, _id: String(d._id) }))
                        .sort((a, b) => {
                            // lastUpdatedAt 필드로 정렬 (최신 시간이 먼저)
                            const timeA = new Date(a.lastUpdatedAt || 0).getTime();
                            const timeB = new Date(b.lastUpdatedAt || 0).getTime();
                            return timeB - timeA;
                        });
                    setList(sortedItems);

                    if (sortedItems.length === 0) {
                        // 첫 세션 자동 생성
                        await createToday();
                    } else {
                        const id = String(sortedItems[0]._id);
                        const firstDate = sortedItems[0].date;
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
                        // lastUpdatedAt 기준 내림차순 정렬 (최신순)
                        const sortedOnlineList = onlineData.items
                            .map((d) => ({ ...d, _id: String(d._id) }))
                            .sort((a, b) => {
                                // lastUpdatedAt 필드로 정렬 (최신 시간이 먼저)
                                const timeA = new Date(a.lastUpdatedAt || 0).getTime();
                                const timeB = new Date(b.lastUpdatedAt || 0).getTime();
                                return timeB - timeA;
                            });
                        setOnlineList(sortedOnlineList);
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

            // 자동 요약 플래그가 있고 아직 이 세션을 요약하지 않았으면 요약 시작
            if (state.autoSummarize && state.sessionId && hasSummarizedSessionRef.current !== state.sessionId) {
                hasSummarizedSessionRef.current = state.sessionId; // 중복 실행 방지 (세션 ID 저장)
                // 세션 로딩 후 요약 실행 (약간의 지연)
                setTimeout(() => {
                    void summarizeConversation(state.sessionId!);
                }, 1500);
            }

            // 목록 새로고침
            void refreshList();

            // state 초기화
            navigate(location.pathname, { replace: true, state: null });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    // 탭 전환 또는 세션 선택 시 mood 업데이트 (오브 색상 동기화)
    // loadSession이 이미 mood를 업데이트하므로 이 useEffect는 제거 가능
    // (중복 로직 제거로 깜빡임 방지)

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

    // 메모 자동 저장 (온라인 채팅 세션만, 1초 debounce)
    useEffect(() => {
        // 온라인 세션이 아니거나 선택된 세션이 없으면 저장하지 않음
        if (!selected || currentSessionType !== 'online') return;

        // 빈 메모는 저장하지 않음 (초기 로드 시 불필요한 API 호출 방지)
        if (memo === '') return;

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

        // 과거 날짜 체크
        if (!isToday) {
            showToast({
                message: '🔒 과거 대화는 수정할 수 없습니다. 오늘 날짜의 대화만 작성 가능합니다.',
                type: 'error',
                duration: 4000
            });
            return;
        }

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
                const errorText = await res.text();
                console.error('Chat API Error:', res.status, errorText);
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

            // 목표 달성 알림
            if (data?.goalsCompleted && data.goalsCompleted.length > 0) {
                for (const goal of data.goalsCompleted) {
                    showToast({
                        message: `🎉 목표 달성! ${goal.description}`,
                        type: 'success',
                        duration: 5000
                    });
                }
            }

            // 스트릭 마일스톤 체크
            try {
                const streakRes = await fetch('/api/user/streak', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (streakRes.ok) {
                    const streakData = await streakRes.json();
                    if (streakData.ok) {
                        const streak = streakData.currentStreak;
                        // 마일스톤 배지: 7일, 30일, 100일, 365일
                        if (streak === 7) {
                            showToast({
                                message: '🎯 축하합니다! 7일 연속 기록 달성!',
                                type: 'success',
                                duration: 5000
                            });
                        } else if (streak === 30) {
                            showToast({
                                message: '🏆 대단해요! 30일 연속 기록 달성!',
                                type: 'success',
                                duration: 5000
                            });
                        } else if (streak === 100) {
                            showToast({
                                message: '👑 놀라워요! 100일 연속 기록 달성!',
                                type: 'success',
                                duration: 5000
                            });
                        } else if (streak === 365) {
                            showToast({
                                message: '💎 경이로워요! 365일 연속 기록 달성!',
                                type: 'success',
                                duration: 5000
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('스트릭 체크 오류:', e);
            }

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

                // 매칭 제안 대화창 표시
                setShowMatchingSuggestion(true);
            }

            await refreshList();
        } catch {
            setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
        } finally {
            setSending(false);
        }
    }, [input, sending, isToday, currentSessionType, aiChatMessages, messages, selected, canAnalyze, MIN_REQUIRED_MESSAGES, showToast, refreshList]);

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

            // 목표 달성 알림
            if (data?.goalsCompleted && data.goalsCompleted.length > 0) {
                for (const goal of data.goalsCompleted) {
                    showToast({
                        message: `🎉 목표 달성! ${goal.description}`,
                        type: 'success',
                        duration: 5000
                    });
                }
            }

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
        if (isSummarizing) {
            if (import.meta.env.DEV) console.log('⚠️ Already summarizing, skipping...');
            return;
        }

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
                console.log('📝 Summary received:', data?.summary);
            }

            // 요약 결과 저장
            const summaryText = data?.summary || '';
            setSummary(summaryText);

            // 세션 목록 새로고침 (summary가 포함된 최신 데이터 가져오기)
            await refreshList();

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
                try { const j = await res.json(); if (j?.message) msg = j.message; } catch { }
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
            setSelectedDate(today);
            setIsToday(true); // 새 대화는 항상 오늘
            setShowWelcomeMessage(true); // 새 대화 생성 시 환영 메시지 표시
            await loadSession(id);
            // 새 대화가 추가된 날짜를 자동으로 펼치기
            setExpandedDates((prev) => new Set(prev).add(today));
        } catch { }
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
        // 상대방 닉네임의 첫 글자 (없으면 'AI')
        const partnerInitial = partnerNickname ? partnerNickname.charAt(0).toUpperCase() : 'AI';
        
        return (
            <div key={m.id || i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                {!mine && (
                    <div aria-hidden style={{ width: 26, height: 26, borderRadius: 13, background: '#eee', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, marginRight: 8 }}>{partnerInitial}</div>
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

    // ------------------------------------------------------- 이미지 팔레트 -------------------------------------------------------
    /* 미사용 기능 - 나중에 필요시 활성화
    // imagePalette: 업로드한 이미지의 base64 데이터를 저장하는 배열
    const [imagePalette, setImagePalette] = useState<string[]>([]);

    // '+ 이미지' 버튼을 클릭하면 파일 선택창 열기
    const eventAddImage = () => {

        // 이미지 파일 선택 input 생성
        const fileInput = document.createElement('input');
        fileInput.type = "file";
        fileInput.accept = "image/*";

        // 파일 선택
        fileInput.addEventListener("change", (event: Event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0]; // 선택된 파일 하나 가져오기

            if (file) {
                const reader = new FileReader();

                // 파일이 성공적으로 읽혔을 때 실행
                reader.onload = (e: ProgressEvent<FileReader>) => {
                    const imageData = e.target?.result as string;
                    if (imageData) {
                        // 1. 이미지 데이터를 imagePalette 배열에 추가
                        setImagePalette((prev) => [...prev, imageData]);
                    }
                };

                // 파일을 base64 (Data URL) 형태로 읽기 시작
                reader.readAsDataURL(file);
            }
        });

        // 클릭 트리거 -> 파일 선택창 열기
        fileInput.click();
    };
    */

    return (
        <>
            <ToastContainer />
            <div className="diary-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, height: 'calc(100vh - 56px)', boxSizing: 'border-box' }}>
                {/* 좌측: 목록 + 툴바 */}
                <aside className="diary-sidebar" style={{ borderRight: '1px solid #e5e7eb', padding: 12, background: '#fafafa', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
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
                            🤖 AI 일기장
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

                    {/* 스트릭 위젯 */}
                    <div style={{ marginBottom: 16 }}>
                        <StreakWidget />
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
                                    아직 AI 대화 기록이 없습니다.<br />첫 대화를 시작해 보세요! 🌟
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
                                                                data-session-id={item._id}
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
                                                                                    <ColorCircle color={item.mood?.color || '#bdbdbd'} size={12} />
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
                        <div className="diary-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                            {loadingList ? (
                                <DiaryListSkeleton />
                            ) : onlineList.length === 0 ? (
                                <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 8px', background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                                    💬<br />
                                    아직 온라인 채팅 기록이 없습니다.<br />
                                    온라인 채팅 후 저장해보세요! 🎯
                                </div>
                            ) : finalFilteredOnlineGroupedByDate.length === 0 ? (
                                <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 8px', background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                                    {searchQuery || filterDate ? '검색 결과가 없습니다' : '온라인 채팅 후 저장해보세요! 🎯'}
                                </div>
                            ) : (
                                finalFilteredOnlineGroupedByDate.map(([date, sessions]) => {
                                    const isExpanded = expandedDates.has(date);
                                    const sessionCount = sessions.length;

                                    return (
                                        <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {/* 날짜 헤더 */}
                                            <button
                                                onClick={() => toggleDate(date)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '8px 10px',
                                                    background: '#fff',
                                                    color: '#374151',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: 8,
                                                    cursor: 'pointer',
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    transition: 'all 0.2s ease',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#f9fafb';
                                                    e.currentTarget.style.borderColor = '#9ca3af';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = '#fff';
                                                    e.currentTarget.style.borderColor = '#d1d5db';
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 12, transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                        ▶
                                                    </span>
                                                    <span style={{ fontSize: 14 }}>📁</span>
                                                    <span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>
                                                        {date}
                                                    </span>
                                                    <span style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                                                        {sessionCount}개
                                                    </span>
                                                </div>
                                            </button>

                                            {/* 세션 목록 */}
                                            {isExpanded && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                                                    {sessions.map((item) => {
                                                        const active = item._id === selected;
                                                        const displayTitle = item.title || `온라인 채팅 ${new Date(item.lastUpdatedAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
                                                        const isEditing = editingSessionId === item._id;

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
                                                                    {isEditing ? (
                                                                        <>
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
                                                                                    padding: '4px 6px',
                                                                                    border: '1px solid #3b82f6',
                                                                                    borderRadius: 6,
                                                                                    fontSize: 12,
                                                                                    outline: 'none',
                                                                                }}
                                                                            />
                                                                            <button
                                                                                title="저장"
                                                                                onClick={() => void saveTitle(item._id)}
                                                                                style={{
                                                                                    border: '1px solid #10b981',
                                                                                    background: '#d1fae5',
                                                                                    color: '#065f46',
                                                                                    borderRadius: 6,
                                                                                    padding: '2px 4px',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: 10
                                                                                }}
                                                                            >
                                                                                ✓
                                                                            </button>
                                                                            <button
                                                                                title="취소"
                                                                                onClick={cancelEditTitle}
                                                                                style={{
                                                                                    border: '1px solid #6b7280',
                                                                                    background: '#f3f4f6',
                                                                                    color: '#374151',
                                                                                    borderRadius: 6,
                                                                                    padding: '2px 4px',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: 10
                                                                                }}
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                onClick={() => { 
                                                                                    setSelected(item._id); 
                                                                                    setSelectedDate(item.date); 
                                                                                    void loadSession(item._id); 
                                                                                }}
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
                                                                                title="이 채팅 삭제"
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
                                                                        whiteSpace: 'nowrap',
                                                                    }}>{highlightText(item.preview, searchQuery)}</div>
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

                    {/* 대화 추가 버튼 - AI 탭 하단 고정 */}
                    {activeTab === 'ai' && (
                        <div style={{ paddingTop: 12, borderTop: '1px solid #e5e7eb', marginTop: 'auto', boxSizing: 'border-box' }}>
                            <button
                                onClick={() => void createToday()}
                                title="새 대화 생성"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: hasTodayAISession ? '1px solid #2563eb' : '2px solid #f59e0b',
                                    borderRadius: 10,
                                    background: hasTodayAISession 
                                        ? 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)'
                                        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    transition: 'all 0.3s ease',
                                    boxShadow: hasTodayAISession 
                                        ? '0 2px 4px rgba(37, 99, 235, 0.2)'
                                        : '0 4px 12px rgba(245, 158, 11, 0.5), 0 0 20px rgba(245, 158, 11, 0.3)',
                                    boxSizing: 'border-box',
                                    animation: hasTodayAISession ? 'none' : 'pulse 2s ease-in-out infinite',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = hasTodayAISession
                                        ? '0 4px 12px rgba(37, 99, 235, 0.4)'
                                        : '0 6px 16px rgba(245, 158, 11, 0.6), 0 0 25px rgba(245, 158, 11, 0.4)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = hasTodayAISession
                                        ? '0 2px 4px rgba(37, 99, 235, 0.2)'
                                        : '0 4px 12px rgba(245, 158, 11, 0.5), 0 0 20px rgba(245, 158, 11, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                {hasTodayAISession ? '✨ 일기 추가' : '✨ 오늘의 일기를 시작하세요!'}
                            </button>
                        </div>
                    )}
                </aside>

                {/* 우측: 대화 + 배경색 */}
                <main className="diary-main" style={{ padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',position:"relative", gap: 12, height: '100%', overflowY: 'auto' }}>
                    {activeTab === 'ai' ? (
                        <>
                            {/* AI 대화 탭 - 기존 UI 유지 */}
                            <div style={{ ...bgStyle, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, position: 'relative', boxSizing: 'border-box', marginTop: 0 }}>

                                {/* 피드백 섹션 (Feedback Section) - 오브 + 감정 진단 */}
                                <div className="feedback-section" style={{
                                    position: 'relative',
                                    width: '100%',
                                    paddingTop: '10px',
                                    marginBottom: 0,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'center',
                                    gap: 16
                                }}>
                                    {/* SiriOrb와 말풍선 컨테이너 - 가로 배치 */}
                                    <div style={{
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        gap: 16,
                                        flexShrink: 0,
                                        width: '100%',
                                        justifyContent: 'flex-start'
                                    }}>
                                        {/* SiriOrb - 왼쪽 */}
                                        <div style={{
                                            pointerEvents: 'none',
                                            width: 150,
                                            height: 150,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <div className="aurora-breathe" style={{
                                                width: 150,
                                                height: 150,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transformOrigin: 'center center',
                                                filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.3)) drop-shadow(0 2px 16px rgba(0, 0, 0, 0.2))'
                                            }}>
                                                <WebGLErrorBoundary>
                                                    <SiriOrb
                                                        color={emotionOrbColor}
                                                        size={150}
                                                        intensity={0.85}
                                                        analyzing={isWaitingAnalysis}
                                                        showCompleted={showCompletedAnimation}
                                                        messageCount={messageCount}
                                                    />
                                                </WebGLErrorBoundary>
                                            </div>
                                        </div>

                                        {/* 말풍선 - 오른쪽 */}
                                        <div style={{
                                            position: 'relative',
                                            display: 'flex',
                                            gap: 0,
                                            flex: 1,
                                            alignItems: 'flex-start'
                                        }}>
                                            {/* 기본 말풍선 */}
                                            <div style={{
                                                position: 'relative',
                                                minWidth: 280,
                                                maxWidth: 400,
                                                background: 'rgba(255, 255, 255, 0.95)',
                                                backdropFilter: 'blur(12px)',
                                                borderRadius: 16,
                                                padding: '14px 18px',
                                                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06)',
                                                border: '2px solid rgba(255, 255, 255, 0.8)',
                                                animation: 'fadeInUp 0.5s ease-out',
                                                transition: 'all 0.3s ease',
                                                flexShrink: 0
                                            }}>
                                            {/* 말풍선 꼬리 - 왼쪽으로 */}
                                            <div style={{
                                                position: 'absolute',
                                                left: -10,
                                                top: 25,
                                                width: 0,
                                                height: 0,
                                                borderTop: '10px solid transparent',
                                                borderBottom: '10px solid transparent',
                                                borderRight: '10px solid rgba(255, 255, 255, 0.95)',
                                                filter: 'drop-shadow(-2px 0 4px rgba(0, 0, 0, 0.08))'
                                            }} />

                                            {/* 말풍선 내용 */}
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 12
                                            }}>
                                                {/* 메시지 텍스트 */}
                                                <div style={{
                                                    fontSize: 14,
                                                    lineHeight: 1.5,
                                                    color: '#1f2937',
                                                    fontWeight: 500
                                                }}>
                                                    {mood ? (
                                                        <>
                                                            <span style={{ fontSize: 16, marginRight: 4 }}>✨</span>
                                                            <strong style={{ fontSize: 14 }}>감정 진단이 완료되었어요!</strong>
                                                            <div style={{ 
                                                                marginTop: 10,
                                                                padding: '10px 12px',
                                                                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                                                                borderRadius: 10,
                                                                border: '1px solid #bae6fd'
                                                            }}>
                                                                {/* 감정과 컬러 정보 */}
                                                                <div style={{ 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'space-between',
                                                                    gap: 12
                                                                }}>
                                                                    <div style={{ fontSize: 13, color: '#0369a1' }}>
                                                                        감정: <strong style={{ fontSize: 14 }}>{mood.emotion}</strong> ({Math.round(mood.score * 100)}%)
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <span style={{ fontSize: 12, color: '#0369a1' }}>컬러:</span>
                                                                        <div style={{
                                                                            width: 20,
                                                                            height: 20,
                                                                            borderRadius: 5,
                                                                            background: mood.color,
                                                                            border: '2px solid rgba(0,0,0,0.1)',
                                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                                        }} />
                                                                        <span style={{
                                                                            fontSize: 12,
                                                                            color: '#0c4a6e',
                                                                            fontWeight: 600
                                                                        }}>
                                                                            {getColorName(mood.color)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : isAnalyzing ? (
                                                        <>
                                                            <span style={{ fontSize: 16, marginRight: 4 }}>🔄</span>
                                                            <strong style={{ fontSize: 14 }}>감정을 분석하고 있어요...</strong>
                                                        </>
                                                    ) : messageCount >= MIN_REQUIRED_MESSAGES ? (
                                                        <>
                                                            <span style={{ fontSize: 16, marginRight: 4 }}>💬</span>
                                                            <strong style={{ fontSize: 14 }}>충분한 대화가 쌓였어요!</strong>
                                                            <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                                                                이제 감정 진단을 받을 수 있습니다.
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
                                                            <div>
                                                                <div>
                                                                    <span style={{ fontSize: 16, marginRight: 4 }}>👋</span>
                                                                    <strong style={{ fontSize: 14 }}>안녕하세요! 당신의 감정을 분석해드려요.</strong>
                                                                </div>
                                                                <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                                                                    현재 대화: {messageCount}/{MIN_REQUIRED_MESSAGES}개
                                                                    {messageCount >= 2 && (
                                                                        <span style={{ display: 'block', marginTop: 3 }}>
                                                                            {MIN_REQUIRED_MESSAGES - messageCount}번 더 대화하면 진단할 수 있어요!
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* 수동 진단 버튼 */}
                                                            {!mood && messageCount >= 2 && !isAnalyzing && (
                                                                <button
                                                                    onClick={manualAnalyze}
                                                                    style={{
                                                                        marginTop: 24,
                                                                        padding: '10px 20px',
                                                                        borderRadius: 10,
                                                                        border: 'none',
                                                                        background: messageCount >= MIN_REQUIRED_MESSAGES
                                                                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                                            : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                                        color: '#fff',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 600,
                                                                        fontSize: 13,
                                                                        boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
                                                                        transition: 'all 0.2s ease',
                                                                        whiteSpace: 'nowrap',
                                                                        flexShrink: 0,
                                                                        alignSelf: 'flex-start'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                        e.currentTarget.style.boxShadow = '0 5px 16px rgba(0,0,0,0.25)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                        e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.15)';
                                                                    }}
                                                                >
                                                                    🧠 감정 진단하기
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 액션 버튼들 */}
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                    {/* 매칭 제안 버튼만 여기에 */}

                                                    {/* 매칭 제안 버튼들 */}
                                                    {showMatchingSuggestion && mood && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setShowMatchingSuggestion(false);
                                                                    navigate('/online');
                                                                }}
                                                                style={{
                                                                    padding: '10px 20px',
                                                                    borderRadius: 10,
                                                                    border: 'none',
                                                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                                                    color: '#fff',
                                                                    cursor: 'pointer',
                                                                    fontWeight: 700,
                                                                    fontSize: 14,
                                                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                                                                }}
                                                            >
                                                                💬 매칭하기
                                                            </button>
                                                            <button
                                                                onClick={() => setShowMatchingSuggestion(false)}
                                                                style={{
                                                                    padding: '10px 20px',
                                                                    borderRadius: 10,
                                                                    border: '2px solid #e5e7eb',
                                                                    background: '#fff',
                                                                    color: '#6b7280',
                                                                    cursor: 'pointer',
                                                                    fontWeight: 600,
                                                                    fontSize: 14,
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.borderColor = '#d1d5db';
                                                                    e.currentTarget.style.background = '#f9fafb';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                                                    e.currentTarget.style.background = '#fff';
                                                                }}
                                                            >
                                                                나중에
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            </div>
                                        </div>

                                        {/* 상세 정보 패널 (오른쪽) - 항상 표시 */}
                                        {mood && (
                                            <div style={{
                                                minWidth: 260,
                                                maxWidth: 280,
                                                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                                backdropFilter: 'blur(12px)',
                                                borderRadius: 16,
                                                padding: '14px 18px',
                                                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06)',
                                                border: '3px solid #fbbf24',
                                                animation: 'fadeInUp 0.5s ease-out',
                                                flexShrink: 0,
                                                marginLeft: -8
                                            }}>
                                                {/* 주요 키워드 */}
                                                {keyTopics.length > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: 13, color: '#92400e', marginBottom: 6, fontWeight: 700 }}>
                                                            🔑 주요 키워드
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                            {keyTopics.map((topic, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    style={{
                                                                        padding: '4px 10px',
                                                                        background: 'rgba(120, 53, 15, 0.15)',
                                                                        borderRadius: 12,
                                                                        fontSize: 12,
                                                                        color: '#78350f',
                                                                        fontWeight: 600,
                                                                        border: '1px solid rgba(120, 53, 15, 0.25)',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 4
                                                                    }}
                                                                >
                                                                    {topic.word}
                                                                    <span style={{ 
                                                                        fontSize: 10, 
                                                                        opacity: 0.7 
                                                                    }}>
                                                                        ×{topic.count}
                                                                    </span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 날짜 표시 */}
                                <div style={{ 
                                    fontSize: 15, 
                                    fontWeight: 700, 
                                    color: '#1f2937', 
                                    textAlign: 'right',
                                    marginTop: 0,
                                    marginBottom: 0,
                                    paddingRight: 4
                                }}>
                                    {selectedDate}
                                </div>

                                {/* 채팅 섹션 (Chat Section) */}
                                <div className="chat-section" style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    gap: 12,
                                    marginTop: 8
                                }}>

                                    {/* 채팅 영역 */}
                                    <div className="diary_chat_area" style={{ position: 'relative', width: '100%' }}>

                                        {/* 채팅 로그 */}
                                        <div className="diary_chat_log" style={{ border: '1px solid #e5e7eb', borderRadius: 12, height: '60vh', maxHeight: '60vh', padding: 12, overflowY: 'auto', background: 'rgba(255,255,255,0.75)', boxSizing: 'border-box', position: 'relative' }}>

                                            {/* 과거 날짜 경고 오버레이 */}
                                            {!isToday && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    padding: '12px 16px',
                                                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                                    border: '2px solid #f59e0b',
                                                    borderRadius: '12px 12px 0 0',
                                                    zIndex: 5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
                                                }}>
                                                    <span style={{ fontSize: 24 }}>🔒</span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
                                                            과거 대화는 수정할 수 없습니다
                                                        </div>
                                                        <div style={{ fontSize: 12, color: '#78350f' }}>
                                                            일기의 본질을 지키기 위해 과거 기록은 조회만 가능합니다. 삭제는 가능합니다.
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 환영 메시지 오버레이 (AI 탭에서만) */}
                                            {activeTab === 'ai' && showWelcomeMessage && messages.length === 0 && (
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
                                                <div style={{ paddingTop: !isToday ? '70px' : '0', paddingBottom: '80px' }}>
                                                    {messages.map(Bubble)}
                                                </div>
                                            )}
                                            <div ref={bottomRef} />

                                        </div>

                                        {/* 채팅 입력 영역 */}
                                        <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
                                            <textarea
                                                ref={textareaRef}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={onKeyDown}
                                                placeholder={isToday ? "오늘의 생각을 적어보세요. Enter로 전송 (Shift+Enter 줄바꿈)" : "📌 과거 대화는 수정할 수 없습니다. 조회만 가능합니다."}
                                                rows={2}
                                                disabled={!isToday}
                                                style={{
                                                    flex: 1,
                                                    padding: 10,
                                                    border: isToday ? '1px solid #e5e7eb' : '1px solid #d1d5db',
                                                    borderRadius: 8,
                                                    resize: 'vertical',
                                                    background: isToday ? '#fff' : '#f3f4f6',
                                                    color: isToday ? '#000' : '#9ca3af',
                                                    cursor: isToday ? 'text' : 'not-allowed'
                                                }}
                                            />
                                            <button
                                                type="submit"
                                                disabled={sending || !input.trim() || !isToday}
                                                style={{
                                                    padding: '10px 14px',
                                                    borderRadius: 8,
                                                    border: isToday ? '1px solid #2563eb' : '1px solid #9ca3af',
                                                    background: !isToday ? '#e5e7eb' : (sending ? '#93c5fd' : '#2563eb'),
                                                    color: !isToday ? '#6b7280' : '#fff',
                                                    cursor: (!isToday || sending) ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                {!isToday ? '🔒' : (sending ? '전송중…' : '전송')}
                                            </button>
                                        </form>
                                    </div>
                                </div>

                            </div>
                        </>
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

            {/* 매칭 시스템 권유 모달 */}
            {showMatchingSuggestion && mood && (
                <MatchingSuggestionModal
                    emotion={mood.emotion}
                    color={mood.color}
                    onClose={() => setShowMatchingSuggestion(false)}
                />
            )}
        </>
    );
}