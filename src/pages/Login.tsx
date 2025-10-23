// Login.tsx
// 로그인 페이지입니다.

import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Login() {

    // navigate: 페이지를 이동할 때 사용
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // back: 뒤로가기 버튼
    const back = () => {

        // 페이지 이동("경로");
        navigate("/");
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email || !password) {
            setError("이메일과 비밀번호를 입력하세요.");
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
            window.dispatchEvent(new Event('auth:changed'));
            navigate("/");
        } catch (err: any) {
            setError(err.message || "네트워크 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <h2>로그인 페이지</h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
                <label>
                    이메일
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                    />
                </label>
                <label>
                    비밀번호
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />
                </label>
                {error && (
                    <div style={{ color: "red" }}>{error}</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" disabled={loading}>
                        {loading ? "로그인 중..." : "로그인"}
                    </button>
                    <button type="button" onClick={back}>뒤로</button>
                </div>
            </form>
        </>
    )
}