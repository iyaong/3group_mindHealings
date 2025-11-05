// EmotionHistoryChart.tsx - 감정 히스토리 차트 컴포넌트
import { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

interface EmotionHistoryData {
  date: string;
  timestamp: string;
  mood: {
    emotion: string;
    score: number;
    color: string;
  };
  enhancedMood?: any;
  type: 'ai' | 'online';
}

interface EmotionStats {
  totalSessions: number;
  emotionDistribution: {
    [emotion: string]: {
      count: number;
      percentage: number;
      avgIntensity: number;
    };
  };
  averageIntensity: number;
  dominantEmotion: string | null;
  positiveRate: number;
}

interface EmotionHistoryChartProps {
  days?: number; // 조회할 일수 (기본: 7일)
}

export default function EmotionHistoryChart({ days = 7 }: EmotionHistoryChartProps) {
  const [loading, setLoading] = useState(true);
  const [aiHistory, setAiHistory] = useState<EmotionHistoryData[]>([]);
  const [onlineHistory, setOnlineHistory] = useState<EmotionHistoryData[]>([]);
  const [stats, setStats] = useState<EmotionStats | null>(null);
  const [chartType, setChartType] = useState<'line' | 'area' | 'pie'>('area');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEmotionHistory();
  }, [days]);

  const loadEmotionHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/emotion/history?days=${days}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('감정 히스토리를 불러올 수 없습니다.');
      }

      const data = await res.json();
      
      setAiHistory(data.aiHistory || []);
      setOnlineHistory(data.onlineHistory || []);
      setStats(data.stats || null);
    } catch (e: any) {
      console.error('감정 히스토리 로드 오류:', e);
      setError(e.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 차트 데이터 가공
  const chartData = [...aiHistory, ...onlineHistory]
    .filter(item => item.mood) // mood가 없는 항목 제외
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(item => {
      const intensity = item.enhancedMood?.primary?.intensity || (item.mood?.score ? item.mood.score * 100 : 50);
      return {
        date: format(parseISO(item.timestamp), 'MM/dd HH:mm', { locale: ko }),
        emotion: item.mood?.emotion || '알 수 없음',
        intensity,
        color: item.mood?.color || '#bdbdbd',
        type: item.type === 'ai' ? 'AI 대화' : '온라인 채팅'
      };
    });

  // 파이 차트 데이터
  const pieData = stats ? Object.entries(stats.emotionDistribution).map(([emotion, data]) => ({
    name: emotion,
    value: data.count,
    percentage: data.percentage,
    fill: getEmotionColor(emotion)
  })) : [];

  // 로딩 중
  if (loading) {
    return (
      <div style={{ 
        padding: 40, 
        textAlign: 'center', 
        color: '#9ca3af' 
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
        <div>감정 히스토리를 불러오는 중...</div>
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
  if (chartData.length === 0) {
    return (
      <div style={{ 
        padding: 40, 
        textAlign: 'center', 
        color: '#9ca3af' 
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          감정 기록이 없습니다
        </div>
        <div style={{ fontSize: 14 }}>
          AI와 대화하거나 온라인 채팅을 시작해보세요!
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px',
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
            📊 감정 히스토리
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            최근 {days}일간의 감정 변화
          </p>
        </div>
        
        {/* 차트 타입 전환 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setChartType('area')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: chartType === 'area' ? '#6366f1' : '#e5e7eb',
              color: chartType === 'area' ? '#fff' : '#6b7280',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            📈 추세
          </button>
          <button
            onClick={() => setChartType('line')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: chartType === 'line' ? '#6366f1' : '#e5e7eb',
              color: chartType === 'line' ? '#fff' : '#6b7280',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            📉 선형
          </button>
          <button
            onClick={() => setChartType('pie')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: chartType === 'pie' ? '#6366f1' : '#e5e7eb',
              color: chartType === 'pie' ? '#fff' : '#6b7280',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            🥧 분포
          </button>
        </div>
      </div>

      {/* 통계 요약 */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 12,
          marginBottom: 20
        }}>
          <StatCard
            icon="💬"
            label="전체 대화"
            value={stats.totalSessions}
            unit="회"
          />
          <StatCard
            icon="🎯"
            label="주요 감정"
            value={stats.dominantEmotion || '-'}
            unit=""
          />
          <StatCard
            icon="💪"
            label="평균 강도"
            value={stats.averageIntensity}
            unit="%"
          />
          <StatCard
            icon="😊"
            label="긍정률"
            value={stats.positiveRate}
            unit="%"
            color={stats.positiveRate >= 50 ? '#10b981' : '#ef4444'}
          />
        </div>
      )}

      {/* 차트 영역 */}
      <div style={{ width: '100%', height: 300, minHeight: 300, position: 'relative' }}>
        {chartType === 'area' && (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                style={{ fontSize: 12 }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="intensity"
                name="감정 강도"
                stroke="#8b5cf6"
                fillOpacity={1}
                fill="url(#colorIntensity)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {chartType === 'line' && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                style={{ fontSize: 12 }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="intensity"
                name="감정 강도"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {chartType === 'pie' && (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderPieLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 감정 분포 리스트 */}
      {stats && chartType === 'pie' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            marginBottom: 12,
            color: '#374151'
          }}>
            감정 분포 상세
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(stats.emotionDistribution)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([emotion, data]) => (
                <div 
                  key={emotion}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#f9fafb',
                    borderRadius: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div 
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: getEmotionColor(emotion)
                      }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{emotion}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      {data.count}회 ({data.percentage}%)
                    </span>
                    <span style={{ 
                      fontSize: 12, 
                      color: '#9ca3af',
                      fontFamily: 'monospace'
                    }}>
                      평균 {data.avgIntensity}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ 
  icon, 
  label, 
  value, 
  unit, 
  color = '#6366f1' 
}: { 
  icon: string; 
  label: string; 
  value: string | number; 
  unit: string;
  color?: string;
}) {
  return (
    <div style={{
      padding: 12,
      background: '#f9fafb',
      borderRadius: 8,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>
        {value}{unit}
      </div>
    </div>
  );
}

// 커스텀 툴팁
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        padding: 12,
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          {data.date}
        </div>
        <div style={{ 
          fontSize: 14, 
          fontWeight: 700, 
          color: data.color,
          marginBottom: 4
        }}>
          {data.emotion}
        </div>
        <div style={{ fontSize: 13, color: '#111827' }}>
          강도: <strong>{data.intensity}%</strong>
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {data.type}
        </div>
      </div>
    );
  }
  return null;
}

// 파이 차트 라벨
function renderPieLabel({ name, percentage }: any) {
  return `${name} ${percentage}%`;
}

// 감정별 색상 매핑
function getEmotionColor(emotion: string): string {
  const colorMap: { [key: string]: string } = {
    '기쁨': '#FFD93D',
    '행복': '#FFB5E8',
    '슬픔': '#93C5FD',
    '우울': '#6B7280',
    '화남': '#FCA5A5',
    '짜증': '#F87171',
    '불안': '#C4B5FD',
    '스트레스': '#A78BFA',
    '평온/안도': '#A8E6CF',
    '만족': '#B4E7CE',
    '외로움': '#D1D5DB',
    '감사': '#FDE68A',
    '설렘': '#FDA4AF',
    '후회': '#9CA3AF',
    '희망': '#FBBF24'
  };
  
  return colorMap[emotion] || '#A8E6CF';
}
