// EmotionInsights.tsx - 감정 패턴 분석 및 인사이트 컴포넌트
import { useEffect, useState } from 'react';
import fetchWithBackoff from '../utils/api';

interface Insights {
  summary: string;
  patterns: string[];
  recommendations: string[];
  weeklyTrend: 'improving' | 'stable' | 'declining';
  bestDay: { day: string; average: number } | null;
  worstDay: { day: string; average: number } | null;
  totalSessions: number;
  analyzedDays: number;
}

interface EmotionInsightsProps {
  days?: number; // 분석 기간 (기본: 30일)
}

export default function EmotionInsights({ days = 30 }: EmotionInsightsProps) {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInsights();
  }, [days]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchWithBackoff(`/api/emotion/insights?days=${days}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('인사이트를 불러올 수 없습니다.');
      }

      const data = await res.json();
      setInsights(data.insights);
    } catch (e) {
      const error = e as Error;
      console.error('인사이트 로드 오류:', error);
      setError(error.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: '#9ca3af'
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
        <div>감정 패턴을 분석하는 중...</div>
      </div>
    );
  }

  // 에러 발생
  if (error) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: '#ef4444'
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div>{error}</div>
      </div>
    );
  }

  // 데이터 없음
  if (!insights) {
    return null;
  }

  return (
    <div style={{
      padding: '24px',
      background: '#ffffff',
      borderRadius: 16,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
            💡 감정 인사이트
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            최근 {insights.analyzedDays}일간의 감정 패턴 분석
          </p>
        </div>

        {/* 추세 아이콘 */}
        <div style={{
          fontSize: 32,
          animation: insights.weeklyTrend === 'improving' ? 'pulse 2s infinite' : 'none'
        }}>
          {insights.weeklyTrend === 'improving' && '📈'}
          {insights.weeklyTrend === 'stable' && '➡️'}
          {insights.weeklyTrend === 'declining' && '📉'}
        </div>
      </div>

      {/* 요약 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
        color: '#fff'
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
          📊 종합 분석
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6 }}>
          {insights.summary}
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 20
      }}>
        <StatCard
          icon="💬"
          label="전체 대화"
          value={insights.totalSessions}
          color="#6366f1"
        />
        {insights.bestDay && (
          <StatCard
            icon="⭐"
            label="최고의 요일"
            value={insights.bestDay.day}
            subValue={`평균 ${insights.bestDay.average}%`}
            color="#10b981"
          />
        )}
        {insights.worstDay && (
          <StatCard
            icon="💪"
            label="힘들었던 요일"
            value={insights.worstDay.day}
            subValue={`평균 ${insights.worstDay.average}%`}
            color="#f59e0b"
          />
        )}
      </div>

      {/* 발견된 패턴 */}
      {insights.patterns && insights.patterns.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 12,
            color: '#374151'
          }}>
            🔍 발견된 패턴
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.patterns.map((pattern, index) => (
              <div
                key={index}
                style={{
                  padding: '12px 16px',
                  background: '#f9fafb',
                  borderLeft: '4px solid #6366f1',
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#374151'
                }}
              >
                {pattern}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 추천 사항 */}
      {insights.recommendations && insights.recommendations.length > 0 && (
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 12,
            color: '#374151'
          }}>
            💬 추천 사항
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.recommendations.map((rec, index) => (
              <div
                key={index}
                style={{
                  padding: '12px 16px',
                  background: '#eff6ff',
                  borderLeft: '4px solid #3b82f6',
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#1e40af'
                }}
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 추세 설명 */}
      <div style={{
        marginTop: 20,
        padding: 16,
        background: getTrendColor(insights.weeklyTrend),
        borderRadius: 12,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
          {getTrendTitle(insights.weeklyTrend)}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
          {getTrendDescription(insights.weeklyTrend)}
        </div>
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({
  icon,
  label,
  value,
  subValue,
  color = '#6366f1'
}: {
  icon: string;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <div style={{
      padding: 16,
      background: '#f9fafb',
      borderRadius: 12,
      textAlign: 'center',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

// 추세별 색상
function getTrendColor(trend: string): string {
  if (trend === 'improving') return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  if (trend === 'declining') return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
}

// 추세별 제목
function getTrendTitle(trend: string): string {
  if (trend === 'improving') return '✨ 긍정적인 변화가 감지되었어요!';
  if (trend === 'declining') return '💪 힘든 시기를 겪고 계시네요';
  return '➡️ 안정적인 감정 상태를 유지 중이에요';
}

// 추세별 설명
function getTrendDescription(trend: string): string {
  if (trend === 'improving') return '최근 감정 상태가 개선되고 있습니다. 계속 이런 패턴을 유지해보세요!';
  if (trend === 'declining') return '최근 감정이 조금 힘들어 보여요. 필요하다면 도움을 요청하는 것도 좋아요.';
  return '감정이 비교적 안정적입니다. 현재의 균형을 잘 유지하고 계시네요.';
}
