# 🌟 Emotion Orb Premium - 사용 가이드

## 📋 개요

**EmotionOrbPremium**은 [minitap.ai](https://minitap.ai/)의 3D 구체 스타일에서 영감을 받아 제작된 프리미엄 3D 감정 시각화 컴포넌트입니다.

### ✨ 주요 특징

- **프리미엄 유리 질감**: MeshTransmissionMaterial을 사용한 사실적인 유리 효과
- **부드러운 그라데이션**: 느리고 유기적인 색상 변화 애니메이션
- **고급 셰이더**: 커스텀 Fragment/Vertex Shader로 구현된 액체 같은 내부 효과
- **최적화된 성능**: React.memo와 useMemo를 활용한 성능 최적화
- **반응형 디자인**: 크기와 강도를 자유롭게 조절 가능

---

## 🎨 컴포넌트 비교

### 1. **EmotionOrb** (기본)
- 부드러운 파스텔 효과
- 안정적인 색상 표현
- 가벼운 애니메이션
- 일반적인 용도에 적합

### 2. **EmotionOrbv1** (오로라 버전)
- 역동적인 오로라 효과
- 빠른 색상 변화
- 강렬한 시각적 임팩트
- 감정 강도가 높을 때 추천

### 3. **EmotionOrbPremium** (프리미엄) ⭐ **추천**
- minitap.ai 스타일의 고급 질감
- 느리고 부드러운 움직임
- 최고급 렌더링 퀄리티
- 프리미엄 UX가 필요한 경우

---

## 🚀 설치 및 사용법

### 기본 사용

```tsx
import EmotionOrbPremium from './components/EmotionOrbPremium';

function MyComponent() {
  const emotionColor = "#FFD54F"; // AI에서 분석된 감정 색상
  
  return (
    <EmotionOrbPremium 
      color={emotionColor}
      size={280}
      intensity={1}
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color` | `string` | - | 감정 색상 (HEX 코드, 예: `#FFD54F`) |
| `size` | `number` | `280` | 구체의 크기 (픽셀) |
| `className` | `string` | `''` | 추가 CSS 클래스 |
| `intensity` | `number` | `1` | 빛의 강도 (0.3 ~ 1.5 권장) |

### 고급 사용 예제

#### 1. AI 감정 분석과 연동

```tsx
import { useState, useEffect } from 'react';
import EmotionOrbPremium from './components/EmotionOrbPremium';

function ChatWithOrb() {
  const [emotionColor, setEmotionColor] = useState('#A8E6CF');
  const [mood, setMood] = useState(null);

  useEffect(() => {
    // AI 감정 분석 API 호출
    fetch('/api/analyze-emotion', {
      method: 'POST',
      body: JSON.stringify({ message: userMessage })
    })
    .then(res => res.json())
    .then(data => {
      setEmotionColor(data.color);
      setMood(data.emotion);
    });
  }, [userMessage]);

  return (
    <div>
      <EmotionOrbPremium 
        color={emotionColor}
        size={300}
        intensity={1.2}
      />
      <p>현재 감정: {mood}</p>
    </div>
  );
}
```

#### 2. 반응형 크기 조절

```tsx
import { useState, useEffect } from 'react';
import EmotionOrbPremium from './components/EmotionOrbPremium';

function ResponsiveOrb() {
  const [orbSize, setOrbSize] = useState(280);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setOrbSize(200); // 모바일
      } else if (width < 1024) {
        setOrbSize(250); // 태블릿
      } else {
        setOrbSize(300); // 데스크탑
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <EmotionOrbPremium color="#4DA6FF" size={orbSize} />;
}
```

#### 3. 다중 구체 배치

```tsx
import EmotionOrbPremium from './components/EmotionOrbPremium';

const emotions = [
  { color: '#FFD54F', name: '기쁨' },
  { color: '#FF6B6B', name: '사랑' },
  { color: '#4DA6FF', name: '신뢰' },
];

function EmotionGallery() {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: 40,
      padding: 40
    }}>
      {emotions.map(({ color, name }) => (
        <div key={name} style={{ textAlign: 'center' }}>
          <EmotionOrbPremium 
            color={color} 
            size={220}
            intensity={0.9}
          />
          <p style={{ marginTop: 20, fontSize: 18, fontWeight: 600 }}>
            {name}
          </p>
        </div>
      ))}
    </div>
  );
}
```

---

## 🎨 색상 가이드

### 감정별 추천 색상

```javascript
const emotionColors = {
  // 긍정 감정
  기쁨: '#FFD54F',      // 밝은 노란색
  사랑: '#FF6B6B',      // 따뜻한 분홍색
  평온: '#A8E6CF',      // 부드러운 민트
  신뢰: '#4DA6FF',      // 맑은 파란색
  희망: '#8BC34A',      // 생기 있는 초록색
  흥분: '#FF6D00',      // 활기찬 주황색
  
  // 중립 감정
  놀람: '#FFC107',      // 황금빛 노란색
  무기력: '#B0BEC5',    // 연한 회색
  
  // 부정 감정
  슬픔: '#4A90E2',      // 깊은 파란색
  분노: '#D32F2F',      // 강렬한 빨간색
  불안: '#9B59B6',      // 차분한 보라색
  두려움: '#607D8B',    // 어두운 청회색
};
```

### 색상 팔레트 생성

프로젝트에 포함된 `colorUtils.ts`를 사용하면 자동으로 3색 그라데이션 팔레트가 생성됩니다:

```typescript
import { paletteFromBase } from '../utils/colorUtils';

const baseColor = '#FFD54F';
const palette = paletteFromBase(baseColor);
// palette = { c1: '#FFE082', c2: '#4A90E2', c3: '#FFF176' }
```

---

## ⚡ 성능 최적화 팁

### 1. 메모이제이션 활용

```tsx
import { useMemo } from 'react';
import EmotionOrbPremium from './components/EmotionOrbPremium';

function OptimizedOrb({ mood }) {
  const orbColor = useMemo(() => {
    return mood?.color || '#A8E6CF';
  }, [mood?.color]);

  return <EmotionOrbPremium color={orbColor} />;
}
```

### 2. 조건부 렌더링

```tsx
function ConditionalOrb({ showOrb, color }) {
  if (!showOrb) return null;
  
  return <EmotionOrbPremium color={color} />;
}
```

### 3. Lazy Loading

```tsx
import { lazy, Suspense } from 'react';

const EmotionOrbPremium = lazy(() => import('./components/EmotionOrbPremium'));

function LazyOrb() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmotionOrbPremium color="#FFD54F" />
    </Suspense>
  );
}
```

---

## 🎬 애니메이션 커스터마이징

구체의 애니메이션을 수정하려면 `EmotionOrbPremium.tsx`의 `useFrame` 훅을 편집하세요:

```typescript
useFrame(({ clock }) => {
  const t = clock.getElapsedTime();
  
  // 부유 효과 속도 조절
  if (groupRef.current) {
    groupRef.current.position.y = Math.sin(t * 0.4) * 0.06; // 0.4를 조절
  }
  
  // 회전 속도 조절
  if (coreRef.current) {
    coreRef.current.rotation.y = t * 0.12; // 0.12를 조절
  }
});
```

---

## 🔧 트러블슈팅

### 문제 1: 구체가 흰색으로 표시됨

**원인**: 색상 prop이 올바르게 전달되지 않음

**해결**:
```tsx
// ✅ 올바른 사용
<EmotionOrbPremium color="#FFD54F" />

// ❌ 잘못된 사용
<EmotionOrbPremium color="FFD54F" />  // # 빠짐
<EmotionOrbPremium color={undefined} />
```

### 문제 2: 성능 저하

**원인**: 여러 구체를 동시에 렌더링

**해결**:
1. `size`를 줄이세요 (예: 280 → 200)
2. `intensity`를 낮추세요 (예: 1 → 0.7)
3. Three.js의 `dpr`를 조절하세요

```tsx
// EmotionOrbPremium.tsx의 Canvas 컴포넌트에서
<Canvas
  dpr={[0.8, 1.5]}  // [최소, 최대] 픽셀 비율
  // ...
/>
```

### 문제 3: 색상 전환이 부자연스러움

**원인**: 색상이 너무 자주 변경됨

**해결**: `useMemo`로 색상 변경 주기를 제어

```tsx
const stableColor = useMemo(() => color, [color]);
```

---

## 📱 반응형 디자인

### 모바일 최적화

```tsx
import { useState, useEffect } from 'react';

function MobileOptimizedOrb({ color }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  return (
    <EmotionOrbPremium 
      color={color}
      size={isMobile ? 180 : 280}
      intensity={isMobile ? 0.8 : 1}
    />
  );
}
```

### CSS 미디어 쿼리

```css
/* EmotionOrbPremium.css */
@media (max-width: 768px) {
  .emotion-orb-premium-wrapper {
    max-width: 200px !important;
  }
}
```

---

## 🎯 실전 예제

### Diary 페이지에 적용

```tsx
import { useMemo } from 'react';
import EmotionOrbPremium from '../components/EmotionOrbPremium';

function Diary() {
  const [mood, setMood] = useState(null);

  const emotionOrbColor = useMemo(() => {
    return mood?.color || '#A8E6CF';
  }, [mood?.color]);

  return (
    <div style={{ 
      background: `linear-gradient(to bottom, 
        rgba(255,255,255,0.7), 
        ${emotionOrbColor})`
    }}>
      <EmotionOrbPremium 
        color={emotionOrbColor}
        size={260}
        intensity={1}
      />
      {/* 나머지 UI */}
    </div>
  );
}
```

---

## 🌐 브라우저 호환성

| 브라우저 | 지원 여부 | 비고 |
|---------|----------|------|
| Chrome 90+ | ✅ | 완벽 지원 |
| Firefox 88+ | ✅ | 완벽 지원 |
| Safari 14+ | ✅ | 완벽 지원 |
| Edge 90+ | ✅ | 완벽 지원 |
| IE 11 | ❌ | 미지원 (WebGL 2.0 필요) |

---

## 📚 참고 자료

- [Three.js 공식 문서](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [React Three Drei](https://github.com/pmndrs/drei)
- [minitap.ai](https://minitap.ai/) - 디자인 영감

---

## 🤝 기여

개선 사항이나 버그를 발견하시면 이슈를 등록해주세요!

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

---

**제작**: team-project1
**최종 업데이트**: 2025-11-03

