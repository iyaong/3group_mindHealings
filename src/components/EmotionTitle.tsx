// EmotionTitle.tsx - 감정 칭호 컴포넌트
import { useEffect, useState, useRef } from 'react';
import Toast from './Toast';

const CACHE_KEY = 'emotion_title_cache';
const CACHE_DURATION = 1000 * 60 * 60; // 1시간

export default function EmotionTitle() {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const isFetchingRef = useRef(false);
  const previousTitleRef = useRef<string>('');

  useEffect(() => {
    // 캐시된 칭호 먼저 로드
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { title: cachedTitle, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_DURATION;
        
        if (!isExpired) {
          setTitle(cachedTitle);
          previousTitleRef.current = cachedTitle; // 초기 칭호 저장
          setLoading(false);
          return;
        }
      } catch (e) {
        // 캐시 파싱 오류 시 무시
      }
    }

    // 중복 호출 방지
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    fetchEmotionTitle();

    return () => {
      isFetchingRef.current = false;
    };
  }, []);

  const fetchEmotionTitle = async () => {
    try {
      const res = await fetch('/api/user/emotion-title', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          const newTitle = data.title || '감정 탐험가';
          
          // 칭호가 변경되었는지 확인 (첫 로드가 아닌 경우에만)
          if (previousTitleRef.current && previousTitleRef.current !== newTitle) {
            setToastMessage(`새로운 칭호를 받았습니다: 🏆 ${newTitle}`);
            setShowToast(true);
          }
          
          previousTitleRef.current = newTitle;
          setTitle(newTitle);
          
          // 캐시 저장
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            title: newTitle,
            timestamp: Date.now()
          }));

          // 커스텀 이벤트 발생 (다른 컴포넌트에서 감지 가능)
          window.dispatchEvent(new Event('titleUpdated'));
        }
      }
    } catch (e) {
      console.error('감정 칭호 조회 오류:', e);
      setTitle('감정 탐험가');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const regenerateTitle = async () => {
    setRegenerating(true);
    
    // 현재 칭호를 previousTitleRef에 저장 (변경 감지용)
    previousTitleRef.current = title;
    
    // 캐시 삭제
    localStorage.removeItem(CACHE_KEY);
    
    await fetchEmotionTitle();
    setRegenerating(false);
  };

  if (loading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16,
        padding: '32px 40px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
        textAlign: 'center',
        color: '#fff'
      }}>
        <div style={{ fontSize: 16, opacity: 0.9 }}>
          당신의 감정을 분석하고 있습니다...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 16,
      padding: '32px 40px',
      boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 배경 장식 */}
      <div style={{
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        filter: 'blur(40px)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: -30,
        left: -30,
        width: 150,
        height: 150,
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '50%',
        filter: 'blur(30px)'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 아이콘 */}
        <div style={{
          fontSize: 48,
          marginBottom: 16,
          textAlign: 'center',
          animation: 'float 3s ease-in-out infinite'
        }}>
          👤
        </div>

        {/* 라벨 */}
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center',
          marginBottom: 12,
          letterSpacing: '2px'
        }}>
          YOUR EMOTION TITLE
        </div>

        {/* 칭호 */}
        <div style={{
          fontSize: 32,
          fontWeight: 900,
          color: '#fff',
          textAlign: 'center',
          marginBottom: 20,
          textShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          lineHeight: 1.4,
          wordBreak: 'keep-all'
        }}>
          {title}
        </div>

        {/* 새로고침 버튼 */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={regenerateTitle}
            disabled={regenerating}
            style={{
              padding: '10px 24px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 8,
              color: '#fff',
              cursor: regenerating ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => {
              if (!regenerating) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            {regenerating ? '생성 중...' : '🔄 칭호 새로 받기'}
          </button>
        </div>

        {/* 설명 */}
        <div style={{
          marginTop: 16,
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          lineHeight: 1.6
        }}>
          AI가 당신의 최근 대화를 분석하여<br />
          감정 특성을 한 문구로 표현했습니다
        </div>
      </div>

      {/* 칭호 변경 토스트 */}
      {showToast && (
        <Toast
          message={toastMessage}
          type="success"
          duration={4000}
          onClose={() => setShowToast(false)}
        />
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
