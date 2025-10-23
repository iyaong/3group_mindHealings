// Navigation.tsx
// 상단에 고정되어 있는 메뉴창입니다.

import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

export default function Navigation() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();
    const { user, loading, refresh, logout } = useAuth();

    useEffect(() => {
        const onAuthChanged = () => refresh();
        window.addEventListener('auth:changed', onAuthChanged);
        return () => window.removeEventListener('auth:changed', onAuthChanged);
    }, [refresh]);

    // login: 로그인 버튼
    const login = () => {

        // 페이지 이동("경로");
        navigate("/login");
    }

    // register: 회원가입 버튼
    const register = () => {

        // 페이지 이동("경로");
        navigate("/register");
    }

    const goHome = () => {
        if (window.location.pathname === "/") {
            window.location.reload();
        } else {
            navigate("/");
        }
    };

    return (
        <nav style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderBottom: "1px solid #eee" }}>
            <h1
                onClick={goHome}
                title="메인으로 이동"
                style={{ marginRight: "auto", cursor: "pointer", userSelect: "none" }}
            >
                토닥톡
            </h1>
            {loading ? (
                <span>상태 확인 중...</span>
            ) : user ? (
                <>
                    <span style={{ color: "#2c7" }}>{user.email}</span>
                    <button onClick={() => { logout(); }}>로그아웃</button>
                </>
            ) : (
                <>
                    <button onClick={login}>로그인</button>
                    <button onClick={register}>회원가입</button>
                </>
            )}
        </nav>
    )
}