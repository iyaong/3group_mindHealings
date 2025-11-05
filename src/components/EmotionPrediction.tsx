// EmotionPrediction.tsx - 감정 예측 컴포넌트
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { BarTooltipPayload } from '../types/api';

interface WeeklyPattern {
  day: number;
  dayName: string;
  emotion: string;
  count: number;
  total: number;
}

interface Prediction {
  prediction: string;
  confidence: number;
  reason: string;
  advice: string;
  activities: string[];
}

const EmotionPrediction: React.FC = () => {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [tomorrowDay, setTomorrowDay] = useState('');

  useEffect(() => {
    fetchPrediction();
  }, []);

  const fetchPrediction = async () => {
    try {
      const res = await fetch('/api/user/emotion-prediction', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setPrediction(data.prediction);
          setWeeklyPattern(data.weeklyPattern || []);
          setMessage(data.message || '');
          setTomorrowDay(data.tomorrowDay || '');
        }
      }
    } catch (e) {
      console.error('예측 조회 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  // 감정별 색상 매핑 (기존 emotion_colors.json 기반)
  const getEmotionColor = (emotion: string): string => {
    const colorMap: Record<string, string> = {
      '행복': '#FFD93D',
      '슬픔': '#6C91BF',
      '분노': '#FF6B6B',
      '불안': '#A8E6CF',
      '평온함': '#B4E7CE',
      '기쁨': '#FFD93D',
      '피곤함': '#95A3B3',
      '스트레스': '#FF8787'
    };
    return colorMap[emotion] || '#9ca3af';
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
          🔮 감정 예측
        </h2>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          AI가 당신의 감정 패턴을 분석하고 있습니다...
        </div>
      </div>
    );
  }

  // 데이터 부족 시
  if (!prediction) {
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
          🔮 감정 예측
        </h2>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
          borderRadius: 12
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <p style={{ fontSize: 16, color: '#6b7280', margin: 0 }}>
            {message || '감정 예측을 위해 더 많은 대화가 필요합니다.'}
          </p>
        </div>
      </div>
    );
  }

  // 차트 데이터 준비
  const chartData = weeklyPattern.map(p => ({
    name: p.dayName,
    percentage: Math.round((p.count / p.total) * 100),
    emotion: p.emotion,
    color: getEmotionColor(p.emotion)
  }));

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 16,
      padding: 32,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
    }}>
      {/* 헤더 */}
      <h2 style={{
        fontSize: 24,
        fontWeight: 800,
        marginBottom: 24,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        🔮 감정 예측
      </h2>

      {/* 예측 결과 카드 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 12,
        padding: 32,
        marginBottom: 32,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 배경 패턴 */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          fontSize: 120,
          opacity: 0.1,
          lineHeight: 1
        }}>
          🔮
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            opacity: 0.9,
            marginBottom: 12,
            letterSpacing: '1px'
          }}>
            내일 ({tomorrowDay}요일) 예상 감정
          </div>

          <div style={{
            fontSize: 36,
            fontWeight: 900,
            marginBottom: 16,
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
          }}>
            {prediction.prediction}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20
          }}>
            <div style={{
              flex: 1,
              height: 8,
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${prediction.confidence}%`,
                height: '100%',
                background: '#fff',
                borderRadius: 4,
                transition: 'width 1s ease-out'
              }} />
            </div>
            <span style={{
              fontSize: 18,
              fontWeight: 700,
              minWidth: 60,
              textAlign: 'right'
            }}>
              {prediction.confidence}%
            </span>
          </div>

          <div style={{
            fontSize: 14,
            opacity: 0.95,
            lineHeight: 1.6,
            marginBottom: 20
          }}>
            💡 {prediction.reason}
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 8,
            padding: 16,
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
              opacity: 0.9
            }}>
              추천 조언
            </div>
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.5
            }}>
              {prediction.advice}
            </div>
          </div>
        </div>
      </div>

      {/* 추천 활동 */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#374151',
          marginBottom: 12
        }}>
          내일을 위한 추천 활동
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12
        }}>
          {prediction.activities.map((activity, index) => (
            <div
              key={index}
              style={{
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                borderRadius: 8,
                padding: '12px 16px',
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 600,
                color: '#6366f1',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}
            >
              ✨ {activity}
            </div>
          ))}
        </div>
      </div>

      {/* 요일별 감정 패턴 차트 */}
      {chartData.length > 0 && (
        <div>
          <h3 style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#374151',
            marginBottom: 12
          }}>
            요일별 감정 패턴
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                label={{ value: '빈도 (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 12
                }}
                formatter={(value: number, _name: string, props: { payload?: BarTooltipPayload }) => {
                  const emotion = props.payload?.emotion || 'Unknown';
                  return [`${value}% (${emotion})`, '주요 감정'];
                }}
              />
              <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default EmotionPrediction;
