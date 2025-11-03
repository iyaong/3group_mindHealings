// Login.tsx
// 로그인 페이지입니다.

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useToast } from "../components/Toast";

export default function Login() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();
    const { showToast, ToastContainer } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // back: 뒤로가기 버튼
    const back = () => {

        // 페이지 이동("경로");
        navigate("/");
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
            setTimeout(() => navigate("/"), 800);
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
            <div style={{ width: '100%', minHeight: 'calc(100vh - 56px)', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, #f9fafb 0%, #eef2ff 100%)' }}>
                <div className="auth-container" style={{ width: 'min(420px, 92%)', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
                    <div className="auth-title" style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>로그인</div>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label htmlFor="login-email" style={{ fontSize: 12, color: '#374151' }}>이메일</label>
                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                        />
                        <label htmlFor="login-password" style={{ fontSize: 12, color: '#374151' }}>비밀번호</label>
                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <button className="auth-button" type="submit" disabled={loading} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #2563eb', background: loading ? '#93c5fd' : '#2563eb', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', flex: 1 }}>
                                {loading ? '로그인 중...' : '로그인'}
                            </button>
                            <button className="auth-button" type="button" onClick={back} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', flex: 1 }}>뒤로</button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}