import { useCallback, useEffect, useState } from 'react';
import fetchWithBackoff from '../utils/api';

export type AuthUser = { 
  id: string; 
  email: string;
  nickname?: string;
  title?: string;
  profileImage?: string;
};

// use fetchWithBackoff helper from src/utils/api to dedupe and handle 429s

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
  const res = await fetchWithBackoff('/api/me', { 
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
      await fetchWithBackoff('/api/logout', { method: 'POST', credentials: 'include' });
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
