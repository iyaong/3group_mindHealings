# EmotionOrbv1 색상 테스트 가이드

## 🐛 디버깅 체크리스트

페이지를 새로고침한 후 브라우저 콘솔(F12)에서 다음을 확인하세요:

### 1. Diary.tsx 색상 전달 확인
```
🎨 EmotionOrb Color Update: {
  mood: undefined,  // ← null이면 AI가 아직 분석 안 함
  color: "#6366f1", // ← 기본 파란색 (mood 없으면)
  hasMood: false,
  hasColor: false,
  defaultUsed: true  // ← true면 기본색 사용 중
}
```

### 2. EmotionOrbv1 컴포넌트 수신 확인
```
🌈 EmotionOrbv1 Render: {
  color: "#6366f1",  // ← 이 색상이 전달되었는지 확인
  size: 150,
  intensity: 0.85
}
```

### 3. LiquidGlassSphere 팔레트 생성 확인
```
🎨 EmotionOrbv1 Color Change: {
  inputColor: "#6366f1",
  palette: {
    c1: "#7c3aed",  // ← 팔레트 3색이 생성되었는지
    c2: "#c084fc",
    c3: "#a78bfa"
  }
}
```

### 4. 서버 응답 확인 (메시지 전송 시)
```
📨 Server Response: {
  mood: {
    emotion: "joy",
    score: 85,
    color: "#FFD54F"  // ← AI가 준 색상
  },
  extractedColor: "#FFD54F"  // ← JSON에서 추출된 색상
}
```

## 🎨 테스트 색상 코드

### 현재 기본값:
- **#6366f1** (파란색) - mood가 없을 때
- mood가 있으면 AI가 준 색상 사용

### 테스트할 색상들:
```typescript
'#FFD54F'  // 노란색 (기쁨)
'#FF6B6B'  // 빨간색 (사랑)
'#A8E6CF'  // 민트색 (평온)
'#4DA6FF'  // 파란색 (신뢰)
'#FF6D00'  // 주황색 (흥분)
```

## 🔧 문제 해결

### 문제 1: 구체가 회색/흰색만 보임
**원인:** mood가 null이고 기본색도 안 보임
**해결:**
1. 콘솔에서 `color: "#6366f1"` 확인
2. 안 보이면 EmotionOrbv1 렌더링 오류

### 문제 2: 색상이 전달되지만 안 보임
**원인:** Three.js 쉐이더 문제
**해결:**
1. `palette` 로그 확인
2. c1, c2, c3가 정상인지 확인

### 문제 3: AI 메시지 후에도 색상 안 변함
**원인:** 서버 응답에 mood가 없음
**해결:**
1. 서버 로그 확인: `🎨 AI가 선택한 색상:`
2. `extractedColor` 확인

## 📝 수동 테스트 방법

Diary.tsx에서 하드코딩 테스트:
```typescript
// 97번 줄 수정 (테스트용)
const color = '#FF6B6B'; // 강제로 빨간색
```

EmotionOrbv1에 직접 props 전달:
```tsx
<EmotionOrbv1 
  color="#FFD54F"  // 노란색 하드코딩
  size={150}
  intensity={0.85}
/>
```

