// Online.tsx
// 1대1 매칭 채팅 페이지

import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDisplay } from "../contexts/DisplayContext";
import { io, Socket } from "socket.io-client";
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { useModal } from '../hooks/useModal';
import Orb from '../components/Orb';
import ProfileCard from '../components/ProfileCard';
import type { UserProfile } from '../types/api';
import './Online.css';

export default function Online() {

  // 서버 주소: 환경에 따라 자동 설정
  // - 로컬 개발 (localhost): http://localhost:7780
  // - 네트워크 환경 (192.168.x.x): http://192.168.x.x:7780
  const getServerUrl = () => {
    // 환경변수에 명시적으로 설정된 경우
    if (import.meta.env.VITE_SOCKET_SERVER_URL && import.meta.env.VITE_SOCKET_SERVER_URL !== '') {
      return import.meta.env.VITE_SOCKET_SERVER_URL;
    }

    // 현재 호스트 기반 자동 감지
    const currentHost = window.location.hostname;
    const protocol = window.location.protocol; // http: or https:

    // localhost나 127.0.0.1인 경우
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      return `${protocol}//localhost:7780`;
    }

    // 네트워크 IP로 접속한 경우 (같은 IP의 7780 포트로 연결)
    return `${protocol}//${currentHost}:7780`;
  };

  const serverLink = getServerUrl();
  console.log('🌐 Socket.IO 서버 연결 주소:', serverLink);
  console.log('📍 현재 페이지 주소:', window.location.href);

  // navigate: 페이지를 이동할 때 사용
  const navigate = useNavigate();

  // 추가 페이지 활성화 설정
  const { setDisplayContent } = useDisplay();

  // Toast 알림
  const { showToast, ToastContainer } = useToast();
  
  // 커스텀 모달
  const { showConfirm, ModalContainer } = useModal();

  // -------------------------------------- UI 상태 --------------------------------------
  // display: /online에서 활성화 할 페이지 - (main(초기 페이지), color, matching, matched, chat)
  const [display, setDisplay] = useState("main");

  // matchingMessage: 챗온 매칭 중 안내 메시지
  const [matchingMessage, setMatchingMessage] = useState("당신의 마음을 읽어줄 사람을 찾는중...");

  // -------------------------------------- 채팅 상태 --------------------------------------
  // messages: 채팅 메시지 목록
  const [messages, setMessages] = useState<{ user: string; text: string; color: string; }[]>([]);
  // +
  // messagesRef: messages의 최신 값을 보관합니다.
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // input: 채팅 입력창 내용
  const [input, setInput] = useState("");

  // saved: 다이어리 저장 중 상태
  const saved = useRef(true);

  // bottomRef: 자동 스크롤용 더미
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------------- 프로필 상태 --------------------------------------
  // myProfile: 내 프로필 정보
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);

  // partnerProfile: 상대방 프로필 정보
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);

  // -------------------------------------- 서버 연동 상태 --------------------------------------
  // socket: 현재 연결된 Socket 객체
  const socket = useRef<Socket | null>(null);

  // roomId: 서버에서 부여받은 방 ID
  const [roomId, setRoomId] = useState("");

  // -------------------------------------- 로그인 상태 확인 --------------------------------------
  // user: 사용자 정보
  const { user, loading } = useAuth();
  // +
  // userRef: useAuth()로 받은 user의 최신 값을 보관합니다.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    // 사용자 정보 불러오는 중이면 대기
    if (loading) return;

    // 로그인 안되있으면 로그인 페이지로 이동
    if (!user) setDisplayContent("login");
  }, [loading, user, navigate])

  // 내 프로필 로드
  useEffect(() => {
    const loadMyProfile = async () => {
      if (!user) return;

      try {
        // 기본 프로필 정보
        const res = await fetch('/api/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          console.log('👤 내 프로필 정보:', data.user);
          if (data.user) {
            // 전체 감정 분석의 주 감정 색상 로드
            const titleRes = await fetch('/api/user/emotion-title', {
              credentials: 'include'
            });

            let emotionData = null;
            if (titleRes.ok) {
              const titleData = await titleRes.json();
              if (titleData.emotion && titleData.color) {
                emotionData = {
                  emotion: titleData.emotion,
                  color: titleData.color,
                  score: 0
                };
              }
            }

            // 감정 TOP3 로드
            const statsRes = await fetch('/api/user/emotion-stats', {
              credentials: 'include'
            });

            let topEmotions = [];
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              if (statsData.ok && statsData.topEmotions) {
                topEmotions = statsData.topEmotions.slice(0, 3);
              }
            }

            // 칭호 로드
            const cached = localStorage.getItem('emotion_title_cache');
            let title = '';
            if (cached) {
              try {
                const { title: cachedTitle } = JSON.parse(cached);
                title = cachedTitle;
              } catch (e) {
                // ignore
              }
            }

            setMyProfile({
              id: data.user._id || data.user.id,
              nickname: data.user.nickname || 'User',
              title: title,
              profileImage: data.user.profileImage || '',
              todayEmotion: emotionData || undefined,
              topEmotions: topEmotions,
            });

            console.log('✅ 내 프로필 로드 완료:', {
              nickname: data.user.nickname,
              title: title,
              topEmotionsCount: topEmotions.length
            });
          }
        }
      } catch (error) {
        console.error('내 프로필 로드 실패:', error);
      }
    };

    loadMyProfile();
  }, [user]);

  // 컴포넌트가 언마운트될 때(페이지를 벗어날 때) 실행
  useEffect(() => {
    return () => {
      // 소켓이 연결되어 있다면 서버에 접속 종료 알림
      if (socket.current) {
        socket.current.emit("userDisconnect");
        socket.current.disconnect();
      }
    };
  }, [socket]);

  // ------------------------------------- 색상 추천 받기 -------------------------------------
  function displayColor() {

    // <1> 색상 선택 페이지 활성화
    setDisplay("color");

  }

  // ------------------------------------- 대화 상대 찾는 중 -------------------------------------
  // startMatching: 대화 상대 찾는 중...
  function startMatching() {

    console.log('🔍 매칭 시작:', {
      socketConnected: socket.current?.connected,
      socketId: socket.current?.id,
      user: user?.email
    });

    // <2> 챗온 매칭 중 페이지 활성화
    setDisplay("matching");

    // <2> 챗온 채팅 중 안내 메시지 변경
    setMatchingMessage("당신의 마음을 읽어줄 사람을 찾는중...");

    // 클라이언트 -> 서버 (startMatching)
    if (socket.current?.connected) {
      console.log('✅ startMatching 이벤트 전송');
      socket.current.emit("startMatching");
    } else {
      console.error('❌ Socket이 연결되지 않음');
      showToast({ message: '서버 연결 실패. 페이지를 새로고침해주세요.', type: 'error' });
    }
  }

  // --------------------------------------- 채팅 페이지 ---------------------------------------
  // 사용자가 키를 눌렀을 때 상호작용
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {

    // IME 입력 중이면 무시 (한글 채팅 상태에서 Enter시 채팅이 2번 전송되는 현상 방지)
    if (event.nativeEvent.isComposing) return;

    // 사용자가 엔터키를 눌렀을 때 메시지 전송 (Shift+Enter는 줄바꿈)
    if (event.key === "Enter" && !event.shiftKey) {

      // 새로고침 방지
      event.preventDefault();

      // 메시지 전송
      send();
    }
  }

  // send: 메시지 전송
  async function send() {

    // 빈 칸이라면 메시지 전송 X
    if (!input.trim()) return;

    // 로그인 되지 않았다면 전송 X
    if (!user?.email) {
      console.warn("로그인 정보가 없습니다.");
      return;
    }

    // 클라이언트 -> 서버 (chat)
    try { socket.current?.emit("chat", { roomId, user: user.email, text: input }); }
    catch (error) { console.error(error); }

    // 입력창 비우기
    setInput("");
  }

  // saveToDiary: 다이어리에 저장
  const saveToDiary = async () => {

    // 중복 실행 방지
    if (saved.current) return;
    saved.current = true;

    // 로그인 확인
    if (!userRef.current) {
      showToast({ message: '로그인이 필요합니다.', type: 'warning' });
      return;
    }

    // 메시지가 없으면 저장 안함
    if (!messagesRef.current || messagesRef.current.length === 0) {
      showToast({ message: '저장할 대화 내용이 없습니다.', type: 'info' });
      return;
    }

    const confirmSave = await showConfirm('대화가 종료되었습니다.\n\n오늘의 대화를 다이어리에 기록해둘까요?', undefined, '💾');
    if (!confirmSave) return;

    try {
      // 1. 오늘 날짜로 온라인 채팅 세션 생성
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const createRes = await fetch('/api/diary/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: dateKey,
          type: 'online',
          title: `온라인 채팅 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
        })
      });

      if (!createRes.ok) {
        const errorData = await createRes.json().catch(() => ({}));
        throw new Error(errorData.message || '세션 생성 실패');
      }

      const createData = await createRes.json();
      const sessionId = createData.id;

      console.log("이메일:", userRef.current?.email);

      // 2. 메시지 변환 (온라인 채팅 형식 → 다이어리 형식)
      const messagesToSave = messagesRef.current.map(msg => ({
        role: (msg.user === userRef.current?.email) ? 'user' : 'assistant',
        content: msg.text
      }));

      // 3. 메시지 저장
      const importRes = await fetch(`/api/diary/session/${sessionId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: messagesToSave })
      });

      if (!importRes.ok) {
        const errorData = await importRes.json().catch(() => ({}));
        throw new Error(errorData.message || '메시지 저장 실패');
      }

      const importData = await importRes.json();
      showToast({
        message: `${importData.imported}개의 메시지가 다이어리에 저장되었습니다! 🎉`,
        type: 'success',
        duration: 3500
      });

      // 다이어리 페이지로 이동 여부 묻기
      const goToDiary = await showConfirm('다이어리 페이지로 이동하시겠습니까?', undefined, '📖');
      if (goToDiary) {
        navigate('/diary', {
          state: {
            activeTab: 'online',
            sessionId: sessionId,
            date: dateKey,
            autoSummarize: true // 자동 요약 플래그
          }
        });
      }

    } catch (error) {
      console.error('❌ 다이어리 저장 에러:', error);
      const errorMsg = error instanceof Error ? error.message : '다이어리 저장 중 오류가 발생했습니다.';
      showToast({ message: errorMsg, type: 'error', duration: 4000 });
    }
  };

  // exitChat: 채팅방 나가기
  const exitChat = async () => {
    const confirmExit = await showConfirm('채팅방을 나가시겠습니까?', undefined, '🚪');
    if (!confirmExit) {
      return;
    }

    // 메시지가 있으면 다이어리 저장 여부 묻기
    if (messagesRef.current && messagesRef.current.length > 0) {
      const shouldSave = await showConfirm('대화 내용을 다이어리에 저장하시겠습니까?', undefined, '💾');
      if (shouldSave) {
        await saveToDiary();
      }
    }

    // 상태 초기화
    setMessages([]);
    messagesRef.current = [];
    setInput('');
    setPartnerProfile(null);
    saved.current = false;

    // 소켓에 매칭 취소 알림
    if (socket.current) {
      socket.current.emit('cancelMatch');
    }

    // UI 상태 초기화 (<1> 메인 페이지로 돌아가기)
    setDisplay("main");

    showToast({ message: '채팅방에서 나갔습니다.', type: 'info' });
  };

  // 채팅이 추가될 때 마다 맨 아래로 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages])

  // -------------------------------------- 서버 상호작용 -시작- --------------------------------------
  useEffect(() => {
    // user가 로드되지 않았으면 연결하지 않음
    if (!user) return;

    // 서버 주소에 맞게 포트 확인 (백엔드에서 httpServer.listen(PORT)와 동일해야 함)
    // Chrome Private Network Access 경고: localhost HTTP 연결 시 발생하는 경고입니다.
    // 개발 환경에서는 정상 동작하며, 프로덕션에서는 HTTPS 사용을 권장합니다.
    const client = io(serverLink, {
      transports: ['websocket', 'polling'], // WebSocket 우선 사용
      upgrade: true, // polling에서 websocket으로 업그레이드
      rememberUpgrade: true, // 업그레이드 기억
      reconnection: true, // 자동 재연결 활성화
      reconnectionAttempts: 5, // 최대 재연결 시도 횟수
      reconnectionDelay: 1000, // 재연결 지연 시간 (ms)
      timeout: 10000, // 연결 타임아웃 (ms)
      withCredentials: true, // 쿠키 전송 활성화
      auth: {
        email: user.email || ''
      }
    });

    socket.current = client;

    // 서버 -> 클라이언트 (connect)
    client.on("connect", () => {
      console.log(`✅ 서버에 연결되었습니다: ${client.id}, 이메일: ${user.email}`);
    });

    // 연결 오류 처리
    client.on("connect_error", (error) => {
      console.error("❌ 서버 연결 실패:", error.message);
    });

    // 재연결 시도
    client.on("reconnect_attempt", (attempt) => {
      console.log(`서버 재연결 시도 중... (${attempt}회)`);
    });

    // 재연결 실패
    client.on("reconnect_failed", () => {
      console.error("서버 재연결 실패. 페이지를 새로고침해주세요.");
      showToast({ message: '서버 연결에 실패했습니다. 페이지를 새로고침해주세요.', type: 'error' });
    });

    // 연결 해제
    client.on("disconnect", (reason) => {
      console.log("서버 연결 해제:", reason);
      if (reason === "io server disconnect") {
        // 서버가 연결을 끊은 경우 수동으로 재연결
        client.connect();
      }
    });

    // 서버 -> 클라이언트 (matched)
    client.on("matched", async (data) => {

      console.log('🎉 매칭 성공 - 받은 데이터:', JSON.stringify(data, null, 2));
      console.log('📋 데이터 필드:', {
        partnerId: data.partnerId,
        partnerNickname: data.partnerNickname,
        partnerTitle: data.partnerTitle,
        partnerEmotion: data.partnerEmotion,
        partnerEmotionStats: data.partnerEmotionStats,
        partnerEmotionStatsLength: data.partnerEmotionStats?.length
      });

      // 서버에서 받은 방 ID 저장
      setRoomId(data.roomId);

      // 상대방의 전체 프로필 정보 로드
      try {
        // 서버에서 받은 기본 프로필 정보
        const partnerEmotionStats = data.partnerEmotionStats || [];

        console.log('🔍 감정 통계 처리:', partnerEmotionStats);

        // 상대방의 상세 프로필 설정
        const profileData = {
          id: data.partnerId || 'partner',
          nickname: data.partnerNickname || '상대방',
          title: data.partnerTitle || '마음을 나누는 사람',
          profileImage: data.partnerProfileImage || '',
          todayEmotion: data.partnerEmotion ? {
            emotion: data.partnerEmotion,
            color: data.partnerEmotionColor || '#a78bfa',
            score: 0
          } : undefined,
          topEmotions: partnerEmotionStats.slice(0, 3).map((stat: any, index: number) => ({
            rank: index + 1,
            emotion: stat.emotion || stat._id,
            count: stat.count,
            color: stat.color || '#a78bfa'
          })),
        };

        console.log('✅ 설정할 프로필 데이터:', profileData);
        setPartnerProfile(profileData);

        console.log('상대방 프로필 로드 완료:', {
          nickname: data.partnerNickname,
          title: data.partnerTitle,
          topEmotionsCount: partnerEmotionStats.length
        });
      } catch (error) {
        console.error('상대방 프로필 로드 실패:', error);
        // 기본 프로필 설정
        setPartnerProfile({
          id: 'partner',
          nickname: data.partnerNickname || '상대방',
          title: '당신의 파트너',
          profileImage: '',
          todayEmotion: undefined,
          topEmotions: [],
        });
      }

      // <2> 챗온 채팅 중 안내 메시지 변경
      setMatchingMessage("찾았습니다!!");

      // # 2초 후 ----------------------
      setTimeout(() => {

        // <3> 챗온 매칭 완료 페이지 활성화
        setDisplay("matched");

      }, 2000);

      // # 5초 후 ----------------------
      setTimeout(() => {

        // <4> 챗온 채팅 페이지 활성화
        setDisplay("chat");

      }, 5000);
    });

    // 서버 -> 클라이언트 (chat)
    client.on("chat", (data) => {

      // 채팅 메시지 배열에 서버로부터 받은 메시지 추가
      setMessages((previous) => [...previous, data])

      // 다이어리 저장 가능
      saved.current = false;

    });

    // 상대방 연결 종료 처리
    client.on("userLeft", (data) => {

      // 시스템 메시지로 상대방 퇴장 알림 추가
      setMessages(prev => [...prev, {
        user: 'system',
        text: data.message,
        color: '#6b7280' // 회색으로 시스템 메시지 표시
      }]);

      // 토스트 알림
      showToast({
        message: data.message,
        type: 'warning',
        duration: 3000
      });

      // 1초 후 자동으로 다이어리에 저장 여부 묻기
      setTimeout(() => {

        void saveToDiary();

      }, 1000)

    });

    return () => {

      // 클린업 함수: 컴포넌트 언마운트 시 소켓 연결 해제
      client.off("matched");
      client.off("chat");
      client.off("userLeft");
      client.disconnect();

    }
  }, [user, serverLink, showToast]);

  // -------------------------------------- 서버 상호작용 -끝- --------------------------------------

  // ✅ 내가 먼저 페이지를 벗어날 때 (새로고침, 탭 닫기, 다른 페이지 이동 등)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 대화 중일 때만 다이어리 저장 시도
      if (display == "chat") {
        void saveToDiary(); // 비동기로 저장
        // 브라우저가 완전히 닫히는 걸 막지는 않지만, 백엔드 요청은 시도됨
      }

      // (선택) 사용자에게 "정말 떠나시겠습니까?" 경고 띄우기
      event.preventDefault();
      event.returnValue = '';
    };

    // 새로고침 / 탭 닫기 시 실행
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // 라우터로 페이지 이동 시 (언마운트)
      if (display == "chat") {
        void saveToDiary();
      }
    };
  }, [display]);

  return (
    <>
      <ToastContainer />
      {/* <0> 챗온 메인 페이지 -시작- */}
      {display == "main" && (
        <div style={{ width: '100%', minHeight: 'calc(100vh - 56px)', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)' }}>
          <div style={{ width: 'min(500px, 90%)', textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              오늘, 새로운 마음을 만나보세요 💙
            </h1>
            <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 40 }}>
              당신과 같은 감정을 가진 사람과<br />
              위로와 공감을 나눠보세요
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button
                onClick={startMatching}
                style={{
                  padding: '16px 32px',
                  borderRadius: 16,
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
                }}
              >
                🤝 매칭 시작하기
              </button>

              <button
                onClick={displayColor}
                style={{
                  padding: '16px 32px',
                  borderRadius: 16,
                  border: '2px solid #e5e7eb',
                  background: '#f9fafb',
                  fontSize: 16,
                  fontWeight: 600,
                  opacity: 0.6,
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
                }}
              >
                🎨 색 추천받기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* <0> 챗온 메인 페이지 -끝- */}

      {/* <1> 챗온 색상 페이지 -시작- */}
      {display == "color" && (
        <div id="colorPage">
          <div className="color_grid">
            {/* 색 영역에 마우스 호버 시 감정 텍스트 대신 컬러 네임을 보여주도록 변경 */}
            <div onClick={startMatching} className="color_card delight" data-color-name="노랑">
              <span className="color_card_text">노랑</span>
            </div>
            <div onClick={startMatching} className="color_card stability" data-color-name="파랑">
              <span className="color_card_text">파랑</span>
            </div>
            <div onClick={startMatching} className="color_card sad" data-color-name="보라">
              <span className="color_card_text">보라</span>
            </div>
            <div onClick={startMatching} className="color_card anger" data-color-name="빨강">
              <span className="color_card_text">빨강</span>
            </div>
            <div onClick={startMatching} className="color_card unrest" data-color-name="자주">
              <span className="color_card_text">자주</span>
            </div>
            <div onClick={startMatching} className="color_card lethargy" data-color-name="회색">
              <span className="color_card_text">회색</span>
            </div>
          </div>
          <p className="color_question">당신의 마음과 맞을 색은 무엇일까요?</p>
        </div>
      )}
      {/* <1> 챗온 색상 페이지 -끝- */}

      {/* <2> 챗온 매칭 중 페이지 -시작- */}
      {display == "matching" && (
        <div style={{ width: '100%', minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)' }}>
          <div style={{ textAlign: 'center', width: 'min(500px, 90%)' }}>
            {/* Orb 애니메이션 */}
            <div style={{ width: 300, height: 300, margin: '0 auto 20px' }}>
              <Orb />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: '#374151' }}>
              {matchingMessage}
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', animation: 'pulse 1s ease-in-out infinite' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', animation: 'pulse 1s ease-in-out infinite 0.2s' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', animation: 'pulse 1s ease-in-out infinite 0.4s' }} />
            </div>
          </div>
        </div>
      )}
      {/* <2> 챗온 매칭 중 페이지 -끝- */}

      {/* <3> 챗온 매칭 완료 페이지 -시작- */}
      {display == "matched" && (
        <div style={{ width: '100%', minHeight: 'calc(100vh - 56px)', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #ecfdf5 0%, #dbeafe 100%)', padding: '40px 16px' }}>
          <div style={{ width: 'min(600px, 90%)', textAlign: 'center' }}>
            <div style={{ fontSize: 80, marginBottom: 24, animation: 'pulse 1.5s ease-in-out' }}>
              🎉
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#374151' }}>
              매칭 성공! 🎊
            </h2>
            <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 40 }}>
              당신과 같은 마음을 가진 사람을 찾았어요!<br />
              곧 대화를 시작합니다...
            </p>

            {/* 프로필 카드들 */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: 20,
              maxWidth: '100%',
              width: '100%',
              padding: '0 16px'
            }}>
              {/* 상대방 프로필 */}
              {partnerProfile && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: '1 1 0',
                  minWidth: 0,
                  maxWidth: '400px'
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#374151' }}>상대방</div>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <ProfileCard profile={partnerProfile} compact />
                  </div>
                </div>
              )}

              {/* 내 프로필 */}
              {myProfile && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: '1 1 0',
                  minWidth: 0,
                  maxWidth: '400px'
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#374151' }}>나</div>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <ProfileCard profile={myProfile} compact />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* <3> 챗온 매칭 완료 페이지 -끝- */}

      {/* <4> 챗온 채팅 페이지 -시작- */}
      {display == "chat" && (
        <div style={{ width: '100vw'}}>

          {/* 상대방 프로필 + 내 프로필 */}
          <div className="profile-cards">
            {/* 왼쪽: 상대방 프로필 */}
            <div className="profile-card-partner" style={{
              flex: '0 0 auto',
              width: '300px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {partnerProfile && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#6B7280' }}>상대방</div>
                  <ProfileCard profile={partnerProfile} compact />
                </>
              )}
            </div>

            {/* 오른쪽: 내 프로필 */}
            <div className="profile-card-my" style={{
              flex: '0 0 auto',
              width: '300px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {myProfile && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#6B7280', textAlign: 'right' }}>나</div>
                  <ProfileCard profile={myProfile} compact />
                </>
              )}
            </div>
          </div>

          {/* 메인 컨테이너: 채팅 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
          }}>

            {/* 중앙: 채팅 영역 */}
            <div style={{
              flex: '1 1 600px',
              width: '30vw',
              maxWidth: '700px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* 채팅 제목과 나가기 버튼 */}
              <div style={{ position: 'relative', margin: 16 }}>
                <h2 style={{ textAlign: 'center', margin: 0 }}>온라인 채팅</h2>
                <button
                  onClick={exitChat}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '6px 12px',
                    backgroundColor: '#EF4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  나가기
                </button>
              </div>

              {/* 안내 문구 */}
              <div style={{
                fontSize: 12,
                color: '#6B7280',
                marginBottom: 12,
                textAlign: 'center'
              }}>
                💡 채팅창에서 나가면 대화 내역이 사라지고, 다이어리에 저장할지 여부를 결정할 수 있습니다.
              </div>

              {/* 채팅창 */}
              <div className="chat-area">
                {/* 💬 메시지 목록 영역 */}
                <div
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 16,
                    padding: 12,
                    overflowY: 'auto',
                    background: 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {messages.map((map, i) => {

                    // 내 메시지인지 확인
                    const isMine = map.user === userRef.current?.email;
                    console.log(map.user, userRef.current?.email, isMine);

                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                        <div style={{
                          maxWidth: '70%',
                          border: '2px solid',
                          borderColor: map.color,
                          borderRadius: isMine ? '40px 10px 35px 40px' : '10px 40px 40px 35px',
                          padding: '14px 20px',
                          fontSize: '14px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          background: isMine ? 'rgba(255, 255, 255, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                          backdropFilter: 'blur(10px)',
                          boxShadow: isMine ? '0 4px 12px rgba(102, 126, 234, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                        }}>
                          {map.text} {/* 메시지 내용 */}
                        </div>
                      </div>
                    );
                  })}

                  {/* 👇 스크롤 이동용 더미 div */}
                  <div ref={bottomRef} />

                </div>

                {/* ✏️ 입력창 + 전송 버튼 */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                  style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}
                >
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="메시지를 입력하세요. Enter 전송 (Shift+Enter 줄바꿈)"
                    rows={2}
                    style={{
                      flex: 1,
                      padding: 12,
                      border: '1px solid rgba(229, 231, 235, 0.5)',
                      borderRadius: 12,
                      resize: 'vertical',
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 12,
                      border: 'none',
                      background: !input.trim() ? 'rgba(147, 197, 253, 0.8)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      cursor: !input.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      boxShadow: !input.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
                      transition: 'all 0.3s ease',
                      transform: !input.trim() ? 'scale(0.95)' : 'scale(1)',
                    }}
                  >
                    전송
                  </button>
                </form>
              </div>
              {/* 채팅 영역 끝 */}
            </div>

          </div>
          {/* 메인 컨테이너 끝 */}

        </div>
      )}
      {/* <4> 챗온 채팅 페이지 -끝- */}
      <ModalContainer />
    </>
  );
}
