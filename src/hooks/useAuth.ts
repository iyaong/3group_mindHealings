import { useCallback, useEffect, useState } from 'react';

export type AuthUser = { id: string; email: string };

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1초

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithRetry('/api/me', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          // 인증되지 않은 사용자 - 정상 케이스
          setUser(null);
          return;
        }
        throw new Error(`인증 확인 실패: ${res.status}`);
      }
      const data = await res.json();
      setUser(data.user ?? null);
    } catch (err) {
      console.error('Auth refresh error:', err);
      setError(err instanceof Error ? err.message : '인증 확인 중 오류가 발생했습니다');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetchWithRetry('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      window.dispatchEvent(new Event('auth:changed'));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, loading, error, refresh, logout };
}
