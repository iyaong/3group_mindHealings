import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

// DisplayContextType: 이 Context가 다루는 상태와 함수들의 타입 정의
interface DisplayContextType {

    displayContent: string;
    setDisplayContent: (value: string) => void;

}

// Context 생성
const DisplayContext = createContext<DisplayContextType | null>(null);

// DisplayProvider: DisplayContextType안에 있는 상태를 전역적으로 관리
export function DisplayProvider({ children }: { children: ReactNode }) {

    // displayContent: 추가 페이지 활성화 상태 - 기본값: default (추가 페이지 없음)
    const [displayContent, setDisplayContent] = useState("default");

    return (

        <DisplayContext.Provider
            value={{
                displayContent,
                setDisplayContent
            }}
        >
            {children}
        </DisplayContext.Provider>

    );
}

// useDisplay: DisplayContext를 쉽게 가져다 쓰기 위한 커스텀 훅
export function useDisplay() {

    const context = useContext(DisplayContext);

    if (!context) throw new Error("useDisplay must be used within DisplayProvider");

    return context;
    
}