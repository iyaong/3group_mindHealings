// Register.tsx
// 회원가입 페이지입니다.

import { useNavigate } from "react-router-dom";
import { useDisplay } from "../contexts/DisplayContext";
import { useState } from "react";
import { useToast } from "../components/Toast";
import "../styles/Register.css";

export default function Register() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();

    // 추가 페이지 활성화 설정
    const { setDisplayContent } = useDisplay();

    const { showToast, ToastContainer } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [loading, setLoading] = useState(false);

    // 약관 동의 상태
    const [agreeAll, setAgreeAll] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [agreePrivacy, setAgreePrivacy] = useState(false);
    const [agreeMarketing, setAgreeMarketing] = useState(false);
    const [agreeAge, setAgreeAge] = useState(false);

    // 커스텀 validation 메시지 설정
    const handleEmailInvalid = (e: React.InvalidEvent<HTMLInputElement>) => {
        e.target.setCustomValidity('이메일 주소를 입력해주세요.');
    };

    const handlePasswordInvalid = (e: React.InvalidEvent<HTMLInputElement>) => {
        e.target.setCustomValidity('비밀번호를 입력해주세요.');
    };

    const handlePasswordConfirmInvalid = (e: React.InvalidEvent<HTMLInputElement>) => {
        e.target.setCustomValidity('비밀번호 확인을 입력해주세요.');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.setCustomValidity('');
    };

    // 모두 동의 체크박스 핸들러
    const handleAgreeAll = (checked: boolean) => {
        setAgreeAll(checked);
        setAgreeTerms(checked);
        setAgreePrivacy(checked);
        setAgreeMarketing(checked);
        setAgreeAge(checked);
    };

    // 개별 체크박스 핸들러
    const handleIndividualCheck = () => {
        if (agreeTerms && agreePrivacy && agreeMarketing && agreeAge) {
            setAgreeAll(true);
        } else {
            setAgreeAll(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || !passwordConfirm) {
            showToast({ message: "모든 항목을 입력하세요.", type: 'warning' });
            return;
        }
        if (password !== passwordConfirm) {
            showToast({ message: "비밀번호가 일치하지 않습니다.", type: 'error' });
            return;
        }
        if (!agreeTerms || !agreePrivacy || !agreeAge) {
            showToast({ message: "필수 약관에 동의해주세요.", type: 'warning' });
            return;
        }
        try {
            setLoading(true);
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });
            if (!res.ok) {
                const msg = (await res.json().catch(() => ({})))?.message || "회원가입에 실패했습니다.";
                throw new Error(msg);
            }
            showToast({ message: "회원가입 성공! 로그인해주세요. 🎉", type: 'success', duration: 2500 });
            setTimeout(() => setDisplayContent("login"), 1000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";
            showToast({ message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // login: 로그인 버튼
    const login = () => {

        // 로그인 페이지 활성화
        setDisplayContent("login");
    }

    return (
        <>
            <ToastContainer />
            <div className="register-wrapper">
                <div className="register-container">
                    <h1 className="register-title">토닥톡</h1>

                    <h2 className="register-subtitle">회원가입</h2>

                    <form onSubmit={handleSubmit} className="register-form">
                        <div className="form-group">
                            <input
                                id="register-email"
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
                            <label htmlFor="register-email" className="form-label">이메일 주소</label>
                        </div>
                        <div className="form-group">
                            <input
                                id="register-password"
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
                                autoComplete="new-password"
                                className="form-input"
                            />
                            <label htmlFor="register-password" className="form-label">비밀번호</label>
                        </div>
                        <div className="form-group">
                            <input
                                id="register-password-confirm"
                                name="passwordConfirm"
                                type="password"
                                value={passwordConfirm}
                                onChange={(e) => {
                                    setPasswordConfirm(e.target.value);
                                    handleInputChange(e);
                                }}
                                onInvalid={handlePasswordConfirmInvalid}
                                placeholder="비밀번호 확인"
                                required
                                autoComplete="new-password"
                                className="form-input"
                            />
                            <label htmlFor="register-password-confirm" className="form-label">비밀번호 확인</label>
                        </div>

                        {/* 약관 동의 섹션 */}
                        <div className="agreement-section">
                            <div className="agreement-item agreement-all">
                                <input
                                    type="checkbox"
                                    id="agree-all"
                                    checked={agreeAll}
                                    onChange={(e) => handleAgreeAll(e.target.checked)}
                                    className="agreement-checkbox"
                                />
                                <label htmlFor="agree-all" className="agreement-label">
                                    모두 동의합니다.
                                </label>
                            </div>

                            <div className="agreement-divider"></div>

                            <div className="agreement-item">
                                <input
                                    type="checkbox"
                                    id="agree-terms"
                                    checked={agreeTerms}
                                    onChange={(e) => {
                                        setAgreeTerms(e.target.checked);
                                        handleIndividualCheck();
                                    }}
                                    className="agreement-checkbox"
                                />
                                <label htmlFor="agree-terms" className="agreement-label">
                                    이용약관 동의 <span className="required">(필수)</span>
                                </label>
                            </div>

                            <div className="agreement-item">
                                <input
                                    type="checkbox"
                                    id="agree-privacy"
                                    checked={agreePrivacy}
                                    onChange={(e) => {
                                        setAgreePrivacy(e.target.checked);
                                        handleIndividualCheck();
                                    }}
                                    className="agreement-checkbox"
                                />
                                <label htmlFor="agree-privacy" className="agreement-label">
                                    개인 정보 취급 방식 동의 <span className="required">(필수)</span>
                                </label>
                            </div>

                            <div className="agreement-item">
                                <input
                                    type="checkbox"
                                    id="agree-marketing"
                                    checked={agreeMarketing}
                                    onChange={(e) => {
                                        setAgreeMarketing(e.target.checked);
                                        handleIndividualCheck();
                                    }}
                                    className="agreement-checkbox"
                                />
                                <label htmlFor="agree-marketing" className="agreement-label">
                                    마케팅 정보 수신 동의 <span className="optional">(선택)</span>
                                </label>
                            </div>

                            <div className="agreement-item">
                                <input
                                    type="checkbox"
                                    id="agree-age"
                                    checked={agreeAge}
                                    onChange={(e) => {
                                        setAgreeAge(e.target.checked);
                                        handleIndividualCheck();
                                    }}
                                    className="agreement-checkbox"
                                />
                                <label htmlFor="agree-age" className="agreement-label">
                                    만 14세 이상입니다. <span className="required">(필수)</span>
                                </label>
                            </div>
                        </div>

                        <div className="button-group">
                            <button className="btn-primary" type="submit" disabled={loading}>
                                {loading ? '가입 중...' : '회원 가입 하기'}
                            </button>
                        </div>
                    </form>

                    <div className="register-links">
                        <span style={{ color: 'var(--text-tertiary)' }}>
                            이미 계정이 있으신가요?
                        </span>
                        <a href="#" onClick={login} className="register-link" style={{ fontWeight: 'var(--font-weight-medium)' }}>
                            로그인
                        </a>
                    </div>
                </div>
            </div>
        </>
    )
}