// Diary.tsx
// 다이어리 페이지입니다.

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function DiaryTest() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();
    
    // <1> 다이어리 페이지 활성화 상태 - 기본값: true
    const [displayDiary, setDisplayDiary] = useState(true);

    // <2> 대화 매칭 팝업 (색이 비슷한 상대와 대화해 보시겠습니까?) 활성화 상태 - 기본값: true
    const [displaySearchPop, setDisplaySearchPop] = useState(true);

    // <3> 대화 매칭 대기 페이지 활성화 상태 - 기본값: false
    const [displayWait, setDisplayWait] = useState(false);

    // <3> 대화 매칭 대기 페이지 안내 메시지
    const [waitMessage, setWaitMessage] = useState("당신의 마음을 읽어줄 사람을 기다리는 중...");

    // <3-1> 대화 매칭 취소 버튼 활성화 상태
    const [displayCancel, setDisplayCancel] = useState(true);

    // search: 내 기분에 맞는 대화 상대 찾기
    const search = () => {

        // <2> 대화 매칭 팝업 열기
        setDisplaySearchPop(true);
    }

    // searchPopYes: 색이 비슷한 상대와 대화해 보시겠습니까? -> 예
    const searchPopYes = () => {

        // <1> 다이어리 페이지 비활성화
        setDisplayDiary(false);

        // <2> 대화 매칭 팝업 닫기
        setDisplaySearchPop(false);

        // <3> 대화 매칭 대기 페이지 활성화
        setDisplayWait(true);

        // <3> 대화 매칭 대기 페이지 안내 메시지 업데이트
        setWaitMessage("당신의 마음을 읽어줄 사람을 기다리는 중...");

        // <3-1> 대화 매칭 취소 버튼 활성화
        setDisplayCancel(true);
    }

    // searchPopNo: 색이 비슷한 상대와 대화해 보시겠습니까? -> 아니오
    const searchPopNo = () => {

        // <2> 대화 매칭 팝업 닫기
        setDisplaySearchPop(false);
    }

    // cancelWait: 매칭 취소
    const cancelWait = () => {

        // <1> 다이어리 페이지 활성화
        setDisplayDiary(true);

        // <3> 대화 매칭 대기 페이지 비활성화
        setDisplayWait(false);
    }

    // [임시]forceSearchComplete: [임시]강제로 매칭 완료하기
    const forceSearchComplete = () => {

        // <3> 대화 매칭 대기 페이지 안내 메시지 업데이트
        setWaitMessage("상대를 찾았습니다!");

        // <3-1> 대화 매칭 취소 버튼 비활성화
        setDisplayCancel(false);

        // 3초(3000ms) 뒤에 채팅 페이지로 이동
        setTimeout(() => {

            // 페이지 이동("경로");
            navigate("/chat");

        }, 3000);
    }

    return (
        <>
            {/* <1> 다이어리 페이지 -시작- */}
            {displayDiary && (
                <div>
                    <h2>다이어리 페이지</h2>
                    <button onClick={search}>내 기분에 맞는 대화 상대 찾기</button>
                </div>
            )}
            {/* <1> 다이어리 페이지 -끝- */}

            {/* <2> 대화 매칭 팝업 -시작- */}
            {displaySearchPop && (
                <div>
                    <p>오늘 당신의 기분은 "" 색이네요</p>
                    <p>색이 비슷한 상대와 대화해 보시겠습니까?</p>
                    <button onClick={searchPopYes}>예</button>
                    <button onClick={searchPopNo}>아니오</button>
                </div>
            )}
            {/* <2> 대화 매칭 팝업 -끝- */}

            {/* <3> 대화 매칭 대기 페이지 -시작- */}
            {displayWait && (
                <div>
                    <p>{waitMessage}</p>
                    {/* <3-1> 대화 매칭 취소 버튼 -시작- */}
                    {displayCancel && (
                        <div>
                            <button onClick={cancelWait}>매칭 취소</button>
                            <button onClick={forceSearchComplete}>[임시]강제로 매칭 완료하기</button>
                        </div>
                    )}
                    {/* <3-1> 대화 매칭 대기 중 버튼 -끝- */}
                </div>
            )}
            {/* <3> 대화 매칭 대기 중 -끝- */}
        </>
    )
}