import { useCallback, useEffect, useState } from 'react';

export type AuthUser = { 
  id: string; 
  email: string;
  nickname?: string;
  title?: string;
  profileImage?: string;
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1초

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, options);
    // 401이나 4xx 에러는 재시도하지 않음 (인증 문제는 재시도해도 소용없음)
    if (response.status === 401 || (response.status >= 400 && response.status < 500)) {
      return response;
    }
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
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/me', { 
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!res.ok) {
        throw new Error(`인증 확인 실패: ${res.status}`);
      }
      
      const data = await res.json();
      
      // 서버가 authenticated: false를 반환하면 로그아웃 상태
      if (data.authenticated === false || !data.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      setUser(data.user ?? null);
    } catch (err) {
      console.error('Auth refresh error:', err);
      setError(err instanceof Error ? err.message : '인증 확인 중 오류');
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
    
    // 프로필 업데이트 이벤트 리스너 추가
    const handleProfileUpdate = () => {
      refresh();
    };
    
    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [refresh]);

  return { user, loading, error, refresh, logout };
}
