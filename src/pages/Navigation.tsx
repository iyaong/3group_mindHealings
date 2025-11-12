// Navigation.tsx
// 상단에 고정되어 있는 메뉴창입니다.

import { useNavigate, NavLink, useLocation } from "react-router-dom";
import { useDisplay } from "../contexts/DisplayContext";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import "./Navigation.css";


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

    // location: 현재 라우트 확인
    const location = useLocation();

    // 현재 경로가 "/" (메인 페이지) 인지 확인
    const isMainPage = location.pathname === "/";

    // menuOpen: 모바일 메뉴 활성화 상태
    const [displayMobileMenu, setDisplayMobileMenu] = useState(false);

    // 화면 크기가 변경되면 모바일 메뉴 자동 닫기
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 769 && displayMobileMenu) {
                setDisplayMobileMenu(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [displayMobileMenu]);

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
        // 네비게이션 전체
        <div id="navWrap" className={`${isMainPage ? "main-page" : ""}`}>
        <nav className={`${isMainPage ? "main" : ""}`}>
            <div className={`nav-left ${displayMobileMenu ? "mobile-nav-left" : ""}`}>
                <div className="hamburger" onClick={() => setDisplayMobileMenu(!displayMobileMenu)}>
                    ☰
                </div>
                <h1
                    onClick={goHome}
                    title="메인으로 이동"
                    style={{fontWeight:"500", cursor: "pointer", userSelect: "none", flexShrink: 0, display:"flex", }}
                >
                   

                    <p>토닥톡</p>
                     {/* <svg width="40" height="40" viewBox="0 0 92 83" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20.6705 83C20.3166 82.7313 19.8791 82.5669 19.5012 82.3102C16.0648 79.9881 11.7733 76.5591 8.659 73.9402C3.73904 69.8014 0.640703 65.1491 0.231038 59.4141C-0.504769 49.083 0.803773 38.2385 0.231038 27.8553C0.935025 22.1804 9.06071 19.0562 15.2773 22.3368C17.3694 23.4397 19.4177 26.0104 19.4177 27.9956V46.055C23.741 43.8051 28.1002 44.3145 31.9662 46.813C34.9492 48.7421 38.3816 51.2767 41.1975 53.3823C42.9754 54.7138 44.6539 56.0773 46.034 57.6735C46.2925 57.7257 46.3283 57.5452 46.4516 57.4449C47.0721 56.9356 47.6925 56.0412 48.3568 55.4557C51.3437 52.8328 56.5739 49.2394 60.0978 46.9454C60.8495 46.4561 61.8081 45.8144 62.6672 45.4695C65.861 44.1781 69.9377 44.4107 72.8253 46.047V27.8512C72.8253 26.3032 74.4799 23.961 75.9554 22.9343C81.2453 19.2607 89.4744 21.0735 91.5903 26.231L92 27.5063V59.8873L91.2324 63.3765C89.9676 67.5274 87.263 70.8401 83.584 73.9362C80.4657 76.5591 76.1742 79.9841 72.7418 82.3062C72.3639 82.5629 71.9304 82.7273 71.5724 82.996H70.4986C68.6133 82.23 68.6889 81.3316 69.9576 80.1565C78.2862 72.4242 87.5056 70.1864 88.2494 58.4395C88.8738 48.5736 87.7681 38.3147 88.2374 28.4087C87.6408 22.8942 78.4214 22.3608 76.7867 27.5866C76.2856 35.5314 77.3992 43.9014 76.7787 51.7941C76.4805 55.56 74.3884 56.7952 71.3059 59.3299C68.9713 61.2509 66.4655 63.0717 64.1348 65.0008C62.2854 65.9312 60.3365 64.3671 61.4541 62.9313L71.4849 54.9022C75.7685 50.7995 69.4445 45.3251 63.6019 48.5375C60.1217 50.4546 56.9637 53.651 53.4676 55.6602C52.4733 56.4222 51.475 57.1642 50.6119 58.0184C50.0233 58.6 48.1937 60.5491 48.2772 61.1827C51.3039 67.6838 49.3193 74.8907 49.892 81.6765C49.7806 82.4425 49.3511 82.5789 48.6312 82.988H47.5573C46.6783 82.6431 46.2408 82.3222 46.1255 81.5362C45.847 76.8118 46.4954 71.8347 46.1334 67.1384C45.4294 58.0505 35.7963 54.0079 28.2633 48.2809C22.5677 45.6179 16.5659 50.8436 20.762 54.9022L30.8684 63.0115C31.8031 64.5436 29.8741 65.9472 28.0167 64.9366C24.9263 62.1413 20.7819 59.5825 17.8148 56.7631C15.2335 54.3087 15.7983 52.6002 15.6671 49.7046C15.329 42.3533 15.5438 34.9579 15.4642 27.5825C13.9329 22.413 4.64985 22.8702 4.01348 28.2643C4.49076 38.2626 3.37313 48.6137 4.00155 58.5719C4.73338 70.1062 14.1079 72.5486 22.2973 80.1485C23.5462 81.3076 23.6018 82.226 21.7564 82.988H20.6825L20.6705 83Z" fill="black"/>
<path d="M23 4.89546C23.4281 2.28262 25.4634 0.293983 28.1449 0.0218955C39.9613 0.101921 51.8141 -0.146159 63.6103 0.149936C65.6133 0.430026 68 2.93883 68 4.94347V37.2058H55.1255C52.65 39.0224 50.3481 41.3912 47.8685 43.1637C47.3112 43.5599 46.6328 43.916 45.9422 44H45.0618C44.2542 43.8279 43.7049 43.5559 43.0507 43.0757C40.6438 41.3231 38.4308 39.0264 36.036 37.2258L23.004 37.2098V4.89546H23ZM64.2201 33.4566V5.11153C64.2201 4.60336 63.166 3.67107 62.5966 3.75909H28.4882C27.8946 3.60705 26.78 4.61137 26.78 5.11153V33.4566H37.3727L45.4576 40.2468L53.809 33.4566H64.2241H64.2201Z" fill="black"/>
</svg> */}
                </h1>
            </div>

            {/* 가운데 네비게이션: 다이어리 / 챗온 / 히스토리 / 목표 - 로그인 시에만 표시 */}
            {user && (
                <div className="nav-center">
                    <NavLink
                        to="/diary" className="link-button"
                        style={({ isActive }) => ({
                            color: "#111",
                            borderBottom: isActive ? "2px solid #D5BCFF" : "2px solid transparent"
                        })}
                    >
                        <span>다이어리</span>
                    </NavLink>

                    <NavLink
                        to="/history" className="link-button"
                        style={({ isActive }) => ({
                            color: "#111",
                            borderBottom: isActive ? "2px solid #D5BCFF" : "2px solid transparent"
                        })}
                    >
                        <span>히스토리</span>
                    </NavLink>
                    <NavLink
                        to="/goals" className="link-button"
                        style={({ isActive }) => ({
                            color: "#111",
                            borderBottom: isActive ? "2px solid #D5BCFF" : "2px solid transparent"
                        })}
                    >
                        <span>목표</span>
                    </NavLink>
                    <NavLink
                        to="/online" className="link-button"
                        style={({ isActive }) => ({
                            color: "#111",
                            fill: "#111",
                            borderBottom: isActive ? "2px solid #D5BCFF" : "2px solid transparent"
                        })}
                    >
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            챗온
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M620-520q25 0 42.5-17.5T680-580q0-25-17.5-42.5T620-640q-25 0-42.5 17.5T560-580q0 25 17.5 42.5T620-520Zm-280 0q25 0 42.5-17.5T400-580q0-25-17.5-42.5T340-640q-25 0-42.5 17.5T280-580q0 25 17.5 42.5T340-520Zm140 260q68 0 123.5-38.5T684-400H276q25 63 80.5 101.5T480-260Zm0 180q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z" /></svg>
                        </span>
                    </NavLink>
                    <NavLink
                        to="/support" className="link-button"
                        style={({ isActive }) => ({
                            color: "#111",
                            borderBottom: isActive ? "2px solid #D5BCFF" : "2px solid transparent"
                        })}
                    >
                        <span>고객센터</span>
                    </NavLink>
                </div>
            )}

            {/* 오른쪽 영역: 고정 너비로 설정 */}
            <div className="nav-right">
                {loading ? (
                    <span>상태 확인 중...</span>
                ) : user ? (
                    <>
                        <span
                            className="profile"
                            onClick={() => navigate('/profile')}
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
                        <button className="logout-btn" onClick={onLogout}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"/></svg>
                            로그아웃
                            </button>
                    </>
                ) : (
                    <>
                        <button className="login-btn" onClick={login}>로그인</button>
                        <button className="register-btn" onClick={register}>회원가입</button>
                    </>
                )}
            </div>

            {/* 모바일 메뉴 */}
            {displayMobileMenu && (
                <div className="mobile-menu">
                    <div className="mobile-wrap">
                    <div className="mobile-menu-top">
                    <NavLink
                        to="/diary" className="link-button"
                        style={({ isActive }) => ({
                            color: isActive ? "#2563eb" : "#111"
                        })}
                    >
                        다이어리
                    </NavLink>

                    <NavLink
                        to="/history" className="link-button"
                        style={({ isActive }) => ({
                            color: isActive ? "#2563eb" : "#111"
                        })}
                    >
                        히스토리
                    </NavLink>
                    <NavLink
                        to="/goals" className="link-button"
                        style={({ isActive }) => ({
                            color: isActive ? "#2563eb" : "#111"
                        })}
                    >
                        목표
                    </NavLink>
                    <NavLink
                        to="/online" className="link-button"
                        style={({ isActive }) => ({
                            color: isActive ? "#2563eb" : "#111",
                            fill: isActive ? "#2563eb" : "#111",
                            display: "flex"
                        })}
                    >
                        챗온
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M620-520q25 0 42.5-17.5T680-580q0-25-17.5-42.5T620-640q-25 0-42.5 17.5T560-580q0 25 17.5 42.5T620-520Zm-280 0q25 0 42.5-17.5T400-580q0-25-17.5-42.5T340-640q-25 0-42.5 17.5T280-580q0 25 17.5 42.5T340-520Zm140 260q68 0 123.5-38.5T684-400H276q25 63 80.5 101.5T480-260Zm0 180q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z" /></svg>
                    </NavLink>
                    <NavLink
                        to="/support" className="link-button"
                        style={({ isActive }) => ({
                            color: isActive ? "#2563eb" : "#111"
                        })}
                    >
                        고객센터
                    </NavLink>
                    </div>

                    <div className="mobile-menu-bottom">
                    {loading ? (
                        <p>상태 확인 중...</p>
                    ) : user ? (
                        <>
                        <p
                                className="m-profile"
                                onClick={() => navigate('/profile')}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#eef2ff";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                }}
                                title="프로필 페이지로 이동"
                            >
                                {user.nickname || user.email}{" 님"}
                            </p>
                            <button className="m-logout-btn" onClick={onLogout}>로그아웃</button>
                        </>
                    ) : (
                        <>
                            <button className="m-login-btn" onClick={login}>로그인</button>
                            <button className="m-register-btn" onClick={register}>회원가입</button>
                        </>
                    )}
                    </div>
                    </div>
                </div>
            )}

            {/* 메뉴 밖 터치 시 닫기 */}
            {displayMobileMenu && (
                <div className="close-mobile-menu" onClick={() => setDisplayMobileMenu(false)}></div>
            )}

        </nav>
        </div>
    )
}