// Online.tsx
// 1대1 매칭 채팅 페이지

import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useAuth } from '../hooks/useAuth';

export default function Online() {

  const serverLink = "http://192.168.4.16:7780";

  // navigate: 페이지를 이동할 때 사용
  const navigate = useNavigate();

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

  }, []);

  // 채팅이 추가될 때 마다 맨 아래로 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages])

  // -------------------------------------- 서버 상호작용 -끝- --------------------------------------

  return (
    <>
      {/* <1> 챗온 메인 페이지 -시작- */}
      {displayMain && (
        <div>
          <button onClick={startMatching}>매칭하기</button>
          <button>색 추천받기[미구현]</button>
        </div>
      )}
      {/* <1> 챗온 메인 페이지 -끝- */}

      {/* <2> 챗온 매칭 중 페이지 -시작- */}
      {displayMatching && (
        <div>
          <p>{matchingMessage}</p>
        </div>
      )}
      {/* <2> 챗온 매칭 중 페이지 -끝- */}

      {/* <3> 챗온 매칭 완료 페이지 -시작- */}
      {displayMatched && (
        <div>
          <div>
            [상대프로필카드]
            <p>상대프로필</p>
          </div>
          <div>
            [내프로필카드]
            <p>내프로필</p>
          </div>
        </div>
      )}
      {/* <3> 챗온 매칭 완료 페이지 -끝- */}

      {/* <4> 챗온 채팅 페이지 -시작- */}
      {displayChat && (
        <div>
          <div
            style={{
              padding: 16,
              display: 'grid',
              gridTemplateRows: '1fr auto', // 상단: 메시지 목록 / 하단: 입력창
              gap: 12,
              height: 'calc(100vh - 200px)', // 전체 높이 맞춤
            }}
          >
            {/* 💬 메시지 목록 영역 */}
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 12,
                overflowY: 'auto',
                background: '#fff',
              }}
            >
              {messages.map((map, i) => {

                // 내 메시지인지 확인
                const isMine = map.user === socket?.id;

                return (
                  <div key={i} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      marginTop: '20px',
                      border: '2px solid',
                      borderColor: map.color,
                      borderRadius: isMine ? '40px 10px 35px 40px' : '10px 40px 40px 35px',
                      padding: '20px 30px',
                      fontSize: '14px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
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
                  padding: 10,
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  resize: 'vertical',
                  background: '#fff',
                }}
              />
            </form>
          </div>
        </div>
      )}
      {/* <4> 챗온 채팅 페이지 -끝- */}
    </>
  );
}
