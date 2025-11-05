// EmotionRecommendations.tsx - 감정 기반 활동 추천 컴포넌트
import { useEffect, useState } from 'react';

interface Recommendation {
  category: string;
  icon: string;
  title: string;
  description: string;
  reason: string;
}

export default function EmotionRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [topEmotions, setTopEmotions] = useState<string[]>([]);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('/api/user/emotion-recommendations', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        console.log('추천 API 응답:', data); // 디버깅용
        if (data.ok) {
          setRecommendations(data.recommendations || []);
          setTopEmotions(data.topEmotions || []);
          console.log('topEmotions:', data.topEmotions); // 디버깅용
        }
      }
    } catch (e) {
      console.error('추천 조회 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
      }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🎯 오늘의 추천
        </h2>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          AI가 당신을 위한 활동을 추천하고 있습니다...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 16,
      padding: 32,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
    }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: 8,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🎯 오늘의 추천
        </h2>
        {topEmotions.length > 0 && (
          <p style={{
            fontSize: 14,
            color: '#6b7280',
            margin: 0
          }}>
            최근 감정: {topEmotions.map((e, i) => {
              // 문자열로 변환 (혹시 객체인 경우 대비)
              const emotionText = typeof e === 'string' ? e : String(e);
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    marginLeft: i > 0 ? 6 : 0
                  }}
                >
                  {emotionText}
                </span>
              );
            })}
          </p>
        )}
      </div>

      {/* 추천 카드 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20
      }}>
        {recommendations.map((rec, index) => (
          <div
            key={index}
            style={{
              background: '#fff',
              border: '2px solid #e5e7eb',
              borderRadius: 12,
              padding: 20,
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(99, 102, 241, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* 배경 그라데이션 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
            }} />

            {/* 카테고리 아이콘 */}
            <div style={{
              fontSize: 48,
              marginBottom: 12,
              textAlign: 'center',
              animation: 'bounce 2s ease-in-out infinite',
              animationDelay: `${index * 0.1}s`
            }}>
              {rec.icon}
            </div>

            {/* 카테고리 */}
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#6366f1',
              textAlign: 'center',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              {rec.category}
            </div>

            {/* 제목 */}
            <h3 style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#1f2937',
              textAlign: 'center',
              marginBottom: 12,
              lineHeight: 1.3
            }}>
              {rec.title}
            </h3>

            {/* 설명 */}
            <p style={{
              fontSize: 14,
              color: '#6b7280',
              textAlign: 'center',
              marginBottom: 16,
              lineHeight: 1.5
            }}>
              {rec.description}
            </p>

            {/* 이유 */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              color: '#6366f1',
              fontWeight: 600,
              textAlign: 'center',
              lineHeight: 1.4
            }}>
              💡 {rec.reason}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
