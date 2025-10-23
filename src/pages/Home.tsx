// Home.tsx
// 토닥톡 홈페이지에 접속했을 때 첫 화면입니다.
// AI와 대화할 수 있습니다.

import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Home() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();

    // firstPage: <1> 첫 페이지. AI와 대화를 시작할 수 있다. true일 때 활성화
    const [firstPage, setFirstPage] = useState(true);

    // AIChatPage: <2> AI와 대화를 시작하면 보이는 채팅창. true일 때 활성화
    const [AIChatPage, setAIChatPage] = useState(false);

    // savePop: <3> 대화를 저장할지 묻는 팝업. true일 때 활성화
    const [savePop, setSavePop] = useState(false);

    // firstChat: 처음으로 input에서 Enter를 눌렀을 때
    const firstChat = (event: any) => {

        // 새로고침 방지
        event.preventDefault();

        // <1> 첫 페이지 비활성화
        setFirstPage(false);

        // <2> AI 채팅창 활성화
        setAIChatPage(true);
    }

    // chat: input에서 Enter을 눌렀을 때
    const chat = (event: any) => {

        // 새로고침 방지
        event.preventDefault();
    }

    // endChat: 대화 종료
    const endChat = () => {

        // <3> 대화 저장 팝업 활성화
        setSavePop(true);
    }

    // saveYes: 오늘 이야기를 일기로 저장해둘까요? -> 예
    const saveYes = (event: any) => {

        // 새로고침 방지
        event.preventDefault();

        // 페이지 이동("경로");
        navigate("/diary");
    }

    // saveNo: 오늘 이야기를 일기로 저장해둘까요? -> 아니요
    const saveNo = (event: any) => {

        // 새로고침 방지
        event.preventDefault();

        // 페이지 이동("경로");
        navigate("/diary");
    }

    return (
        <>
        <div id="homeWrap"
        style={{width:"100%", display: "flex", flexDirection:"row", justifyContent:"center"}}>

            <div className="mainview"
            style={{width:"300px", display:"flex", flexDirection:"column", justifyContent:"center"}}>
            <h2>초기 페이지</h2>

            {/* <1> 첫 페이지 -시작- */}
            {firstPage && (
                <div>
                    <p>오늘 하루는 어땠나요?</p>
                    <form onSubmit={firstChat}>
                        <input />
                    </form>
                </div>
            )}
            {/* <1> 첫 페이지 -끝- */}

            {/* <2> AI 채팅창 -시작- */}
            {AIChatPage && (
                <div>
                    <h2>AI 채팅 페이지</h2>
                    <form onSubmit={chat}>
                        <input />
                    </form>
                    <button onClick={endChat}>대화 종료</button>
                </div>
            )}
            {/* <2> AI 채팅창 -끝- */}

            {/* <3> 대화 저장 팝업 -시작- */}
            {savePop && (
                <div>
                    <p>오늘 이야기를 일기로 저장해둘까요?</p>
                    <button onClick={saveYes}>예</button>
                    <button onClick={saveNo}>아니오</button>
                </div>
            )}
            {/* <3> 대화 저장 팝업 -끝- */}
            </div>
            </div>
        </>
    )
}