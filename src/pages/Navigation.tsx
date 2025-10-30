// Navigation.tsx
// 상단에 고정되어 있는 메뉴창입니다.

import { useNavigate, NavLink } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

export default function Navigation() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();
    const { user, loading, refresh, logout } = useAuth();
    const onLogout = async () => {
        try { await logout(); } finally { navigate('/'); }
    };

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
                style={{ cursor: "pointer", userSelect: "none" }}
            >
                토닥톡
            </h1>

            {/* 가운데 네비게이션: 다이어리 / 챗온 */}
            <div style={{ margin: "0 auto", display: "flex", gap: 16 }}>
                <NavLink
                    to="/diary"
                    style={({ isActive }) => ({
                        padding: "6px 10px",
                        borderRadius: 8,
                        textDecoration: "none",
                        border: isActive ? "1px solid #2563eb" : "1px solid transparent",
                        background: isActive ? "#eef2ff" : "transparent",
                        color: isActive ? "#1e3a8a" : "#111",
                        fontWeight: 600,
                    })}
                >
                    다이어리
                </NavLink>
                <NavLink
                    to="/online"
                    style={({ isActive }) => ({
                        padding: "6px 10px",
                        borderRadius: 8,
                        textDecoration: "none",
                        border: isActive ? "1px solid #2563eb" : "1px solid transparent",
                        background: isActive ? "#eef2ff" : "transparent",
                        color: isActive ? "#1e3a8a" : "#111",
                        fontWeight: 600,
                    })}
                >
                    챗온
                </NavLink>
            </div>

            {loading ? (
                <span>상태 확인 중...</span>
        ) : user ? (
                <>
                    <span style={{ color: "#2c7" }}>{user.email}</span>
            <button onClick={onLogout}>로그아웃</button>
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