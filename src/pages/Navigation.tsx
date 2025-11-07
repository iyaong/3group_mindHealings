// Navigation.tsx
// 상단에 고정되어 있는 메뉴창입니다.

import { useNavigate, NavLink, useLocation } from "react-router-dom";
import { useDisplay } from "../contexts/DisplayContext";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

export default function Navigation() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();

    // 추가 페이지 활성화 설정
    const { setDisplayContent } = useDisplay();

    const { user, loading, refresh, logout } = useAuth();

    const onLogout = async () => {
        try { await logout(); } finally { navigate('/'); }
    };

    useEffect(() => {
        const onAuthChanged = () => refresh();
        window.addEventListener('auth:changed', onAuthChanged);
        return () => window.removeEventListener('auth:changed', onAuthChanged);
    }, [refresh]);

    // 라우트 변경을 감지하여 /chat 이외의 경로에서는 body 배경과 chat 표시자를 초기화합니다.
    const location = useLocation();
    useEffect(() => {
        try {
            if (!location.pathname.startsWith('/chat')) {
                // Chat 전용 표시자 제거
                if (document.body.dataset.chatBg) delete document.body.dataset.chatBg;
                // 인라인으로 변경된 배경 초기화(전역 CSS에서 흰색이 보장됨)
                document.body.style.backgroundColor = '';
            }
        } catch {
            // DOM 접근 실패 시 무시
        }
    }, [location.pathname]);

    // login: 로그인 버튼
    const login = () => {

        // 로그인 페이지 활성화
        setDisplayContent("login");
    }

    // register: 회원가입 버튼
    const register = () => {

        // 회원가입 페이지 활성화
        setDisplayContent("register");
    }

    const goHome = () => {
        if (window.location.pathname === "/") {
            window.location.reload();
        } else {
            navigate("/");
        }
    };

    return (
        <nav style={{ display: "flex", alignItems: "center",justifyContent:"space-between", gap: 12, padding: 12, borderBottom: "1px solid #eee", backgroundColor: '#ffffff' }}>
            <h1
                onClick={goHome}
                title="메인으로 이동"
                style={{ cursor: "pointer", userSelect: "none", flexShrink: 0 }}
            >
                토닥톡
            </h1>

            {/* 가운데 네비게이션: 다이어리 / 챗온 / 히스토리 / 목표 - 로그인 시에만 표시 */}
            {user && (
                <div className="navi" style={{ flex: 1, display: "flex", justifyContent: "center", alignItems:"center",  gap: 16 }}>
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
                        to="/history"
                        style={({ isActive }) => ({
                            padding: "6px 10px",
                            borderRadius: 8,
                            textDecoration: "none",
                            border: isActive ? "1px solid #3b82f6" : "1px solid transparent",
                            background: isActive ? "#dbeafe" : "transparent",
                            color: isActive ? "#1e40af" : "#111",
                            fontWeight: 600,
                        })}
                    >
                        히스토리
                    </NavLink>
                    <NavLink
                        to="/goals"
                        style={({ isActive }) => ({
                            padding: "6px 10px",
                            borderRadius: 8,
                            textDecoration: "none",
                            border: isActive ? "1px solid #8b5cf6" : "1px solid transparent",
                            background: isActive ? "#ede9fe" : "transparent",
                            color: isActive ? "#6d28d9" : "#111",
                            fontWeight: 600,
                        })}
                    >
                        목표
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
                            display:"flex",
                            alignItems:"center",
                            
                        })}
                    >
                        챗온
                        <div>
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M620-520q25 0 42.5-17.5T680-580q0-25-17.5-42.5T620-640q-25 0-42.5 17.5T560-580q0 25 17.5 42.5T620-520Zm-280 0q25 0 42.5-17.5T400-580q0-25-17.5-42.5T340-640q-25 0-42.5 17.5T280-580q0 25 17.5 42.5T340-520Zm140 260q68 0 123.5-38.5T684-400H276q25 63 80.5 101.5T480-260Zm0 180q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
                        </div>
                    </NavLink>
                </div>
            )}

            {/* 오른쪽 영역: 고정 너비로 설정 */}
            <div style={{ minWidth: 250, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
                {loading ? (
                    <span>상태 확인 중...</span>
                ) : user ? (
                    <>
                        <span 
                            onClick={() => navigate('/profile')}
                            style={{ 
                                color: "#2563eb", 
                                cursor: "pointer",
                                fontWeight: 600,
                                padding: "6px 10px",
                                borderRadius: 8,
                                transition: "background 0.2s",
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 150,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#eef2ff";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                            }}
                            title="프로필 페이지로 이동"
                        >
                            {user.nickname || user.email}{" 님"}
                        </span>
                        <button onClick={onLogout}>로그아웃</button>
                    </>
                ) : (
                    <>
                        <button onClick={login}>로그인</button>
                        <button onClick={register}>회원가입</button>
                    </>
                )}
            </div>
        </nav>
    )
}