// Login.tsx
// 로그인 페이지입니다.

import { useNavigate } from "react-router-dom";
import { useDisplay } from "../contexts/DisplayContext";
import { useState } from "react";
import { useToast } from "../components/Toast";

import "../styles/Login.css";

export default function Login() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();

    // 추가 페이지 활성화 설정
    const { setDisplayContent } = useDisplay();

    const { showToast, ToastContainer } = useToast();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // 커스텀 validation 메시지 설정
    const handleEmailInvalid = (e: React.InvalidEvent<HTMLInputElement>) => {
        e.target.setCustomValidity('이메일 주소를 입력해주세요.');
    };

    const handlePasswordInvalid = (e: React.InvalidEvent<HTMLInputElement>) => {
        e.target.setCustomValidity('비밀번호를 입력해주세요.');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.setCustomValidity('');
    };

    // back: 뒤로가기 버튼
    const back = () => {

        // 기본 페이지 활성화
        setDisplayContent("default");
    }

    // register: 회원가입 버튼
    const register = () => {

        // 회원가입 페이지 활성화
        setDisplayContent("register");
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            showToast({ message: "이메일과 비밀번호를 입력하세요.", type: 'warning' });
            return;
        }
        try {
            setLoading(true);
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });
            if (!res.ok) {
                const msg = (await res.json().catch(() => ({})))?.message || "로그인에 실패했습니다.";
                throw new Error(msg);
            }
            // 성공 시 네비게이션 상태 갱신 후 홈으로 이동
            showToast({ message: "로그인 성공! 환영합니다! 🎉", type: 'success', duration: 2000 });
            window.dispatchEvent(new Event('auth:changed'));
            setTimeout(() => setDisplayContent("default"), 800);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";
            showToast({ message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ToastContainer />
            <div className="login-wrapper">
                <div className="login-container">
                    <h1 className="login-title">토닥톡</h1>
                    
                    <div className="login-tabs">
                        <button className="login-tab active">이메일 로그인</button>
                        <button className="login-tab">QR 로그인</button>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <input
                                id="login-email"
                                name="email"
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    handleInputChange(e);
                                }}
                                onInvalid={handleEmailInvalid}
                                placeholder="이메일 주소"
                                required
                                autoComplete="email"
                                className="form-input"
                            />
                            <label htmlFor="login-email" className="form-label">이메일 주소</label>
                        </div>
                        <div className="form-group">
                            <input
                                id="login-password"
                                name="password"
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    handleInputChange(e);
                                }}
                                onInvalid={handlePasswordInvalid}
                                placeholder="비밀번호"
                                required
                                autoComplete="current-password"
                                className="form-input"
                            />
                            <label htmlFor="login-password" className="form-label">비밀번호</label>
                        </div>
                        <div className="button-group">
                            <button className="btn-primary" type="submit" disabled={loading}>
                                {loading ? '로그인 중...' : '로그인'}
                            </button>
                            <button className="btn-secondary" type="button" onClick={back}>
                                뒤로
                            </button>
                        </div>
                    </form>

                    <div className="login-links">
                        <a href="#" onClick={register} className="login-link">회원가입</a>
                        <span className="link-divider">|</span>
                        <a href="#" className="login-link">아이디 찾기</a>
                        <span className="link-divider">|</span>
                        <a href="#" className="login-link">비밀번호 찾기</a>
                    </div>

                    <div className="sns-login">
                        <div className="sns-buttons">
                            <button className="sns-button naver" type="button">
                                N
                            </button>
                            <button className="sns-button google" type="button">
                                G
                            </button>
                            <button className="sns-button kakao" type="button">
                                K
                            </button>
                        </div>
                        <p className="sns-text">SNS 계정으로 간편로그인하세요.</p>
                    </div>
                </div>
            </div>
        </>
    )
}