// OrbShowcase.tsx - 3D 구체 비교 및 테스트 페이지
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmotionOrb from '../components/EmotionOrb';
import EmotionOrbv1 from '../components/EmotionOrbv1';
import EmotionOrbPremium from '../components/EmotionOrbPremium';
import EmotionOrbv2 from '../components/EmotionOrbv2';
import EmotionOrbv3 from '../components/EmotionOrbv3';
import EmotionOrbv4 from '../components/EmotionOrbv4';
import EmotionOrbv5 from '../components/EmotionOrbv5';

// 감정별 색상 프리셋
const emotionPresets = [
  { name: '기쁨', color: '#FFD54F', emotion: 'joy' },
  { name: '사랑', color: '#FF6B6B', emotion: 'love' },
  { name: '평온', color: '#A8E6CF', emotion: 'calm' },
  { name: '신뢰', color: '#4DA6FF', emotion: 'trust' },
  { name: '희망', color: '#8BC34A', emotion: 'hope' },
  { name: '슬픔', color: '#4A90E2', emotion: 'sad' },
  { name: '분노', color: '#D32F2F', emotion: 'anger' },
  { name: '불안', color: '#9B59B6', emotion: 'anxious' },
  { name: '무기력', color: '#B0BEC5', emotion: 'tired' },
  { name: '흥분', color: '#FF6D00', emotion: 'excited' },
];

// 커스텀 색상 프리셋
const customColors = [
  '#FF69B4', '#9D50FF', '#00D9FF', '#00FF9F',
  '#FFEB3B', '#FF5722', '#795548', '#607D8B',
];

export default function OrbShowcase() {
  const navigate = useNavigate();
  const [selectedColor, setSelectedColor] = useState('#FFD54F');
  const [selectedOrb, setSelectedOrb] = useState<'basic' | 'v1' | 'premium' | 'v2' | 'v3' | 'v4' | 'v5'>('v5');
  const [customColor, setCustomColor] = useState('#FFD54F');
  const [orbSize, setOrbSize] = useState(280);
  const [intensity, setIntensity] = useState(1);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: 50,
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              position: 'absolute',
              top: 30,
              left: 30,
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            ← 홈으로
          </button>
          <h1 style={{
            color: 'white',
            fontSize: 48,
            fontWeight: 800,
            marginBottom: 12,
            textShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>
            3D Emotion Orb Showcase
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 18,
            fontWeight: 500,
          }}>
            minitap.ai 스타일의 프리미엄 3D 구체 컴포넌트
          </p>
        </div>

        {/* Main Display Area */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 28,
          padding: '60px 40px',
          marginBottom: 40,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
        }}>
          {/* Orb Type Selector */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 15,
            marginBottom: 50,
          }}>
            {[
              { key: 'basic' as const, label: 'EmotionOrb', desc: '부드러운 파스텔' },
              { key: 'v1' as const, label: 'EmotionOrbv1', desc: '오로라 효과' },
              { key: 'premium' as const, label: 'Premium', desc: '역동적 오로라' },
              { key: 'v2' as const, label: 'V2', desc: '스크린샷 스타일' },
              { key: 'v3' as const, label: 'V3', desc: '오로라 유리 + Bloom' },
              { key: 'v4' as const, label: 'V4 Premium', desc: 'All Features' },
              { key: 'v5' as const, label: 'V5 GSAP', desc: 'Shader + Transmission + HDRI + Post', highlight: true },
            ].map(({ key, label, desc, highlight }) => (
              <button
                key={key}
                onClick={() => setSelectedOrb(key)}
                style={{
                  background: selectedOrb === key 
                    ? (highlight ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
                    : 'rgba(0,0,0,0.03)',
                  color: selectedOrb === key ? 'white' : '#333',
                  border: selectedOrb === key ? 'none' : '2px solid rgba(0,0,0,0.1)',
                  padding: '16px 28px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 700,
                  transition: 'all 0.3s ease',
                  boxShadow: selectedOrb === key ? '0 8px 25px rgba(102, 126, 234, 0.4)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
                onMouseEnter={(e) => {
                  if (selectedOrb !== key) {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedOrb !== key) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <span>{label}</span>
                <span style={{
                  fontSize: 11,
                  opacity: selectedOrb === key ? 0.9 : 0.6,
                  fontWeight: 500,
                }}>
                  {desc}
                </span>
                {highlight && (
                  <span style={{
                    fontSize: 10,
                    background: selectedOrb === key ? 'rgba(255,255,255,0.25)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: selectedOrb === key ? 'white' : 'white',
                    padding: '2px 8px',
                    borderRadius: 8,
                    marginTop: 4,
                    fontWeight: 600,
                  }}>
                    NEW
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Orb Display */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: orbSize + 80,
            marginBottom: 50,
            position: 'relative',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)',
              borderRadius: 24,
              padding: 40,
              boxShadow: 'inset 0 2px 15px rgba(102, 126, 234, 0.1)',
            }}>
              {selectedOrb === 'basic' && (
                <EmotionOrb color={selectedColor} size={orbSize} intensity={intensity} />
              )}
              {selectedOrb === 'v1' && (
                <EmotionOrbv1 color={selectedColor} size={orbSize} intensity={intensity} />
              )}
              {selectedOrb === 'premium' && (
                <EmotionOrbPremium color={selectedColor} size={orbSize} intensity={intensity} />
              )}
              {selectedOrb === 'v2' && (
                <EmotionOrbv2 color={selectedColor} size={orbSize} intensity={intensity} />
              )}
              {selectedOrb === 'v3' && (
                <EmotionOrbv3 color={selectedColor} size={orbSize} intensity={intensity} />
              )}
              {selectedOrb === 'v4' && (
                <EmotionOrbv4 color={selectedColor} size={orbSize} intensity={intensity} />
              )}
              {selectedOrb === 'v5' && (
                <EmotionOrbv5 color={selectedColor} size={orbSize} intensity={intensity} />
              )}
            </div>
            
            {/* Color Info Badge */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,0.95)',
              padding: '12px 24px',
              borderRadius: 12,
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{
                width: 32,
                height: 32,
                background: selectedColor,
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                border: '2px solid white',
              }} />
              <span style={{
                fontWeight: 700,
                color: '#333',
                fontSize: 16,
                fontFamily: 'monospace',
              }}>
                {selectedColor}
              </span>
            </div>
          </div>

          {/* Emotion Preset Buttons */}
          <div style={{ marginBottom: 30 }}>
            <h3 style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#333',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              감정 프리셋
            </h3>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
            }}>
              {emotionPresets.map(({ name, color }) => (
                <button
                  key={name}
                  onClick={() => setSelectedColor(color)}
                  style={{
                    background: color,
                    color: 'white',
                    border: selectedColor === color ? '3px solid #333' : 'none',
                    padding: '10px 20px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s ease',
                    textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div style={{ marginBottom: 30 }}>
            <h3 style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#333',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              커스텀 색상
            </h3>
            <div style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: 20,
            }}>
              {customColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  style={{
                    width: 50,
                    height: 50,
                    background: color,
                    border: selectedColor === color ? '3px solid #333' : '2px solid white',
                    borderRadius: 12,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              ))}
            </div>
            
            {/* Color Picker */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 15,
            }}>
              <label style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#555',
              }}>
                직접 선택:
              </label>
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setSelectedColor(e.target.value);
                }}
                style={{
                  width: 60,
                  height: 40,
                  border: '2px solid #ddd',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              />
              <input
                type="text"
                value={selectedColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    setSelectedColor(val);
                    if (val.length === 7) setCustomColor(val);
                  }
                }}
                style={{
                  padding: '10px 15px',
                  borderRadius: 8,
                  border: '2px solid #ddd',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  width: 120,
                }}
                placeholder="#RRGGBB"
              />
            </div>
          </div>

          {/* Controls */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 25,
          }}>
            {/* Size Control */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 700,
                color: '#555',
                marginBottom: 10,
              }}>
                크기: {orbSize}px
              </label>
              <input
                type="range"
                min="150"
                max="400"
                value={orbSize}
                onChange={(e) => setOrbSize(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 4,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Intensity Control */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 700,
                color: '#555',
                marginBottom: 10,
              }}>
                강도: {intensity.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.3"
                max="1.5"
                step="0.1"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 4,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        </div>

        {/* Feature Comparison */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 28,
          padding: 40,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
        }}>
          <h2 style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#333',
            marginBottom: 30,
            textAlign: 'center',
          }}>
            컴포넌트 비교
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 25,
          }}>
            {[
              {
                title: 'EmotionOrb',
                features: ['부드러운 파스텔 효과', '안정적인 색상 표현', '최적화된 성능', '심플한 애니메이션'],
                color: '#667eea',
              },
              {
                title: 'EmotionOrbv1',
                features: ['역동적인 오로라 효과', '빠른 움직임', '강렬한 색상 변화', '다층 레이어 구조'],
                color: '#f093fb',
              },
              {
                title: 'EmotionOrbPremium',
                features: ['역동적 오로라', '세로 커튼 효과', '빠른 유기적 흐름', '불규칙한 움직임'],
                color: '#764ba2',
              },
              {
                title: 'EmotionOrbv2',
                features: ['스크린샷 스타일', '부드러운 파스텔', '미니멀 디자인', '느린 움직임', '유리 투명감'],
                color: '#FFB6C1',
              },
              {
                title: 'EmotionOrbv3',
                features: ['오로라 유리 재질', 'Bloom 후처리', 'Iridescence 효과', '마우스 회전', '빛 번짐'],
                color: '#d5ccff',
              },
              {
                title: 'EmotionOrbv4',
                features: ['모든 기능 통합', 'HDRI 환경맵', 'ChromaticAberration', '커스텀 GLSL', 'MeshTransmission', '최고급 렌더링'],
                color: '#FFD700',
                highlight: false,
              },
              {
                title: 'EmotionOrbv5',
                features: ['GSAP 애니메이션', 'HDRI+PMREM', 'Bloom/ChromaticAberration', '커스텀 GLSL', 'MeshTransmission'],
                color: '#8ED1FF',
                highlight: true,
              },
            ].map(({ title, features, color, highlight }) => (
              <div
                key={title}
                style={{
                  background: highlight ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                  border: highlight ? 'none' : '2px solid #e0e0e0',
                  borderRadius: 18,
                  padding: 28,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: highlight ? '0 10px 30px rgba(102, 126, 234, 0.3)' : '0 4px 12px rgba(0,0,0,0.05)',
                }}
              >
                {highlight && (
                  <div style={{
                    position: 'absolute',
                    top: 15,
                    right: 15,
                    background: 'rgba(255,255,255,0.25)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    RECOMMENDED
                  </div>
                )}
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: highlight ? 'white' : '#333',
                  marginBottom: 18,
                }}>
                  {title}
                </h3>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                }}>
                  {features.map((feature, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 14,
                        color: highlight ? 'rgba(255,255,255,0.9)' : '#666',
                        marginBottom: 10,
                        paddingLeft: 24,
                        position: 'relative',
                        lineHeight: 1.6,
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        left: 0,
                        color: highlight ? 'rgba(255,255,255,0.8)' : color,
                        fontWeight: 700,
                      }}>
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Example */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 28,
          padding: 40,
          marginTop: 40,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
        }}>
          <h2 style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#333',
            marginBottom: 20,
            textAlign: 'center',
          }}>
            사용 방법
          </h2>
          <pre style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: 25,
            borderRadius: 12,
            overflow: 'auto',
            fontSize: 13,
            lineHeight: 1.6,
            fontFamily: "'Fira Code', 'Consolas', monospace",
          }}>
{`import EmotionOrbPremium from './components/EmotionOrbPremium';

function MyComponent() {
  const emotionColor = "#FFD54F"; // AI에서 분석된 감정 색상
  
  return (
    <EmotionOrbPremium 
      color={emotionColor}
      size={280}
      intensity={1}
    />
  );
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

