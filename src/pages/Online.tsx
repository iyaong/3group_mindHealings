// Online.tsx
// 1대1 매칭 채팅 페이지

import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import './Online.css';

export default function Online() {

  // 서버 주소: 개발 환경에서는 localhost, 프로덕션에서는 환경변수 사용
  const serverLink = import.meta.env.VITE_SOCKET_SERVER_URL || "http://192.168.4.16:7780";

  // navigate: 페이지를 이동할 때 사용
  const navigate = useNavigate();
  
  // Toast 알림
  const { showToast, ToastContainer } = useToast();

  // -------------------------------------- UI 상태 --------------------------------------
  // <1> 챗온 메인 페이지 활성화 상태 - 기본값: true
  const [displayMain, setDisplayMain] = useState(true);

  // <2> 챗온 매칭 중 페이지 활성화 상태 - 기본값: false
  const [displayMatching, setDisplayMatching] = useState(false);

  // <2> 챗온 매칭 중 안내 메시지
  const [matchingMessage, setMatchingMessage] = useState("당신의 마음을 읽어줄 사람을 찾는중...");

  // <3> 챗온 매칭 완료 페이지 활성화 상태 - 기본값: false
  const [displayMatched, setDisplayMatched] = useState(false);

  // <4> 챗온 채팅 페이지 활성화 상태 - 기본값: false
  const [displayChat, setDisplayChat] = useState(false);

  // -------------------------------------- 채팅 상태 --------------------------------------
  // messages: 채팅 메시지 목록
  const [messages, setMessages] = useState<{ user: string; text: string; color: string; }[]>([]);

  // input: 채팅 입력창 내용
  const [input, setInput] = useState("");
  
  // 다이어리 저장 중 상태
  const [savingToDiary, setSavingToDiary] = useState(false);

  // bottomRef: 자동 스크롤용 더미
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------------- 서버 연동 상태 --------------------------------------
  // socket: 현재 연결된 Socket 객체
  const [socket, setSocket] = useState<Socket | null>(null);

  // roomId: 서버에서 부여받은 방 ID
  const [roomId, setRoomId] = useState("");

  // -------------------------------------- 로그인 상태 확인 --------------------------------------
  // user: 사용자 정보
  const { user, loading } = useAuth();

  useEffect(() => {
    // 사용자 정보 불러오는 중이면 대기
    if (loading) return;

    // 로그인 안되있으면 로그인 페이지로 이동
    if (!user) navigate("/login");
  }, [loading, user])

  // 컴포넌트가 언마운트될 때(페이지를 벗어날 때) 실행
  useEffect(() => {
    return () => {
      // 소켓이 연결되어 있다면 서버에 접속 종료 알림
      if (socket) {
        socket.emit("userDisconnect");
        socket.disconnect();
      }
    };
  }, [socket]);

  // ------------------------------------- 대화 상대 찾는 중 -------------------------------------
  // startMatching: 대화 상대 찾는 중...
  function startMatching() {

    // <2> 챗온 매칭 중 페이지 활성화
    setDisplayMatching(true);

    // <1> 챗온 메인 페이지 비활성화
    setDisplayMain(false);

    // <2> 챗온 채팅 중 안내 메시지 변경
    setMatchingMessage("당신의 마음을 읽어줄 사람을 찾는중...");

    // 클라이언트 -> 서버 (startMatching)
    socket?.emit("startMatching");
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

    // 클라이언트 -> 서버 (chat)
    try { socket!.emit("chat", { roomId, text: input }); }
    catch (error) { console.error(error); }

    // 입력창 비우기
    setInput("");
  }

  // 다이어리에 저장
  const saveToDiary = async () => {
    if (savingToDiary) return;
    
    // 로그인 확인
    if (!user) {
      showToast({ message: '로그인이 필요합니다.', type: 'warning' });
      navigate('/login');
      return;
    }
    
    // 메시지가 없으면 저장 안함
    if (messages.length === 0) {
      showToast({ message: '저장할 대화 내용이 없습니다.', type: 'info' });
      return;
    }
    
    const confirmSave = confirm('현재 온라인 채팅을 다이어리에 저장하시겠습니까?');
    if (!confirmSave) return;
    
    setSavingToDiary(true);
    
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
      
      // 2. 메시지 변환 (온라인 채팅 형식 → 다이어리 형식)
      const messagesToSave = messages.map(msg => ({
        role: (msg.user === socket?.id) ? 'user' : 'assistant',
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
      const goToDiary = confirm('다이어리 페이지로 이동하시겠습니까?');
      if (goToDiary) {
        navigate('/diary');
      }
      
    } catch (error) {
      console.error('❌ 다이어리 저장 에러:', error);
      const errorMsg = error instanceof Error ? error.message : '다이어리 저장 중 오류가 발생했습니다.';
      showToast({ message: errorMsg, type: 'error', duration: 4000 });
    } finally {
      setSavingToDiary(false);
    }
  };
  // -------------------------------------- 서버 상호작용 -시작- --------------------------------------
  useEffect(() => {
    // 서버 주소에 맞게 포트 확인 (백엔드에서 httpServer.listen(PORT)와 동일해야 함)
    const client = io(serverLink);
    setSocket(client);

    // 서버 -> 클라이언트 (matched)
    client.on("matched", (data) => {

      // -log-
      console.log(`매칭 완료: ${data}`);

      // 서버에서 받은 방 ID 저장
      setRoomId(data.roomId);

      // <2> 챗온 채팅 중 안내 메시지 변경
      setMatchingMessage("찾았습니다!!");

      // # 2초 후 ----------------------
      setTimeout(() => {

        // <2> 챗온 매칭 중 페이지 비활성화
        setDisplayMatching(false);

        // <3> 챗온 매칭 완료 페이지 활성화
        setDisplayMatched(true);

      }, 2000);

      // # 5초 후 ----------------------
      setTimeout(() => {

        // <3> 챗온 매칭 완료 페이지 비활성화
        setDisplayMatched(false);

        // <4> 챗온 채팅 페이지 활성화
        setDisplayChat(true);

      }, 5000);
    });

    // 서버 -> 클라이언트 (chat)
    client.on("chat", (data) => {
      // 채팅 메시지 배열에 서버로부터 받은 메시지 추가
      setMessages((previous) => [...previous, data])
    });

    // 상대방 연결 종료 처리
    client.on("userLeft", (data) => {
      // 시스템 메시지로 상대방 퇴장 알림 추가
      setMessages(prev => [...prev, {
        user: 'system',
        text: data.message,
        color: '#6b7280' // 회색으로 시스템 메시지 표시
      }]);
      showToast({ 
        message: data.message, 
        type: 'warning', 
        duration: 3000 
      });
    });

  }, []);

  // 채팅이 추가될 때 마다 맨 아래로 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages])

  // -------------------------------------- 서버 상호작용 -끝- --------------------------------------

  return (
    <>
      <ToastContainer />
      {/* <1> 챗온 메인 페이지 -시작- */}
      {displayMain && (
        <div style={{ width: '100%', minHeight: 'calc(100vh - 56px)', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)' }}>
          <div style={{ width: 'min(500px, 90%)', textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              오늘, 새로운 마음을 만나보세요 💙
            </h1>
            <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 40 }}>
              당신과 같은 감정을 가진 사람과<br/>
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
                disabled
                style={{
                  padding: '16px 32px',
                  borderRadius: 16,
                  border: '2px solid #e5e7eb',
                  background: '#f9fafb',
                  color: '#9ca3af',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'not-allowed',
                  opacity: 0.6
                }}
              >
                🎨 색 추천받기
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  (곧 출시됩니다)
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* <1> 챗온 메인 페이지 -끝- */}

      {/* <2> 챗온 매칭 중 페이지 -시작- */}
      {displayMatching && (
        <div style={{ width: '100%', minHeight: 'calc(100vh - 56px)', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%)' }}>
          <div style={{ textAlign: 'center', width: 'min(500px, 90%)' }}>
            <div style={{ fontSize: 64, marginBottom: 20, animation: 'pulse 2s ease-in-out infinite' }}>
              🔍
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
      {displayMatched && (
        <div style={{ width: '100%', minHeight: 'calc(100vh - 56px)', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #ecfdf5 0%, #dbeafe 100%)', padding: '40px 16px' }}>
          <div style={{ width: 'min(600px, 90%)', textAlign: 'center' }}>
            <div style={{ fontSize: 80, marginBottom: 24, animation: 'pulse 1.5s ease-in-out' }}>
              🎉
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#374151' }}>
              매칭 성공! 🎊
            </h2>
            <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 40 }}>
              당신과 같은 마음을 가진 사람을 찾았어요!<br/>
              곧 대화를 시작합니다...
            </p>
            
            {/* 프로필 카드들 */}
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
              {/* 상대방 프로필 */}
              <div className="profile_card">
                <div style={{ fontSize: 48, marginBottom: 12 }}>😊</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#374151' }}>상대방</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>당신의 파트너</div>
              </div>
              
              {/* 내 프로필 */}
              <div className="profile_card">
                <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#374151' }}>나</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>당신</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* <3> 챗온 매칭 완료 페이지 -끝- */}

      {/* <4> 챗온 채팅 페이지 -시작- */}
      {displayChat && (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
          {/* 저장 버튼 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 16px' }}>
            <h2 style={{ textAlign: 'center', margin: 0, flex: 1 }}>온라인 채팅</h2>
            <button
              onClick={() => void saveToDiary()}
              disabled={savingToDiary || messages.length === 0}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: '1px solid rgba(16, 185, 129, 0.5)',
                background: savingToDiary ? 'rgba(209, 250, 229, 0.8)' : 'rgba(236, 253, 245, 0.9)',
                backdropFilter: 'blur(10px)',
                color: '#065f46',
                cursor: savingToDiary || messages.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: messages.length === 0 ? 0.5 : 1,
                boxShadow: messages.length > 0 ? '0 2px 8px rgba(16, 185, 129, 0.2)' : 'none',
                transition: 'all 0.3s ease'
              }}
              title={messages.length === 0 ? '저장할 대화가 없습니다' : '현재 대화를 다이어리에 저장'}
            >
              {savingToDiary ? '저장 중...' : '📝 다이어리에 저장'}
            </button>
          </div>

          <div
            style={{
              padding: 16,
              display: 'grid',
              gridTemplateRows: '1fr auto', // 상단: 메시지 목록 / 하단: 입력창
              gap: 12,
              height: 'calc(100vh - 250px)', // 전체 높이 맞춤
            }}
          >
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
                const isMine = map.user === socket?.id;

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
        </div>
      )}
      {/* <4> 챗온 채팅 페이지 -끝- */}
    </>
  );
}
