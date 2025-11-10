# 감정 색상 이름 통합 가이드

## 📋 개요

감정 진단 시 서버에서 생성되는 색상 코드에 대응하는 **한글 색상 이름**을 모달에 표시하도록 시스템을 개선했습니다.

**문제점**: 진단 결과에서 "부드러운 노랑"으로 표시되는데, 모달에는 단순히 "노란색"으로 표시되어 일관성이 부족했습니다.

**해결책**: 서버에서 색상 코드와 함께 한글 색상 이름(`colorName`)도 반환하도록 수정하여, 모달에 정확한 색상 이름이 표시되도록 개선했습니다.

---

## 🎯 주요 변경사항

### 1. 서버 측 변경사항

#### 1.1 색상 이름 매핑 파일 추가 (`server/emotion_color_names.json`)

```json
{
  "기쁨": "황금빛",
  "행복": "밝은 노랑",
  "사랑/애정": "선명한 빨강",
  "애정": "로즈 핑크",
  "평온/안도": "민트 초록",
  "평온": "에메랄드",
  ...
}
```

- 41가지 감정별 색상 이름 정의
- 감정에 어울리는 시적이고 감성적인 한글 색상 이름 사용

#### 1.2 서버 코드 수정 (`server/index.ts`)

**색상 이름 로딩 함수 추가:**
```typescript
const EMOTION_COLOR_NAMES = loadEmotionColorNames();

function loadEmotionColorNames(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), 'server/emotion_color_names.json'),
    path.resolve(process.cwd(), 'emotion_color_names.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      // ignore parse errors and try next location
    }
  }
  return {};
}
```

**감정 분석 함수 업데이트:**
```typescript
async function detectEmotionFromText(text: string): Promise<{ 
  emotion: string; 
  score: number; 
  color: string; 
  colorName: string // ✅ 추가
}> {
  // ... 분석 로직 ...
  
  const colorName = EMOTION_COLOR_NAMES[emotion] || '부드러운 노랑';
  
  return { emotion, score, color, colorName };
}
```

**타입 정의 업데이트:**
```typescript
type DiarySessionDoc = {
  // ...
  mood?: { 
    emotion: string; 
    score: number; 
    color: string; 
    colorName: string // ✅ 추가
  } | null;
  // ...
};
```

### 2. 프론트엔드 측 변경사항

#### 2.1 타입 정의 업데이트 (`src/types/api.ts`)

```typescript
export interface DiarySessionResponse {
  _id: string;
  date: string;
  title?: string;
  type?: 'ai' | 'online';
  mood?: { 
    emotion: string; 
    score: number; 
    color: string; 
    colorName: string // ✅ 추가
  } | null;
  // ...
}
```

#### 2.2 Diary 컴포넌트 수정 (`src/pages/Diary.tsx`)

**상태 타입 업데이트:**
```typescript
const [mood, setMood] = useState<{ 
  emotion: string; 
  score: number; 
  color: string; 
  colorName: string // ✅ 추가
} | null>(null);
```

**모달에 colorName 전달:**
```tsx
{showMatchingSuggestion && mood && (
  <MatchingSuggestionModal
    emotion={mood.emotion}
    color={mood.color}
    colorName={mood.colorName} // ✅ 추가
    onClose={() => setShowMatchingSuggestion(false)}
  />
)}
```

#### 2.3 모달 컴포넌트 수정 (`src/components/MatchingSuggestionModal.tsx`)

**Props 타입 업데이트:**
```typescript
interface MatchingSuggestionModalProps {
  emotion: string;
  color: string;
  colorName?: string; // ✅ 추가 (선택적)
  onClose: () => void;
}
```

**서버 색상 이름 우선 사용:**
```typescript
export default function MatchingSuggestionModal({ 
  emotion, 
  color, 
  colorName, // ✅ 추가
  onClose 
}: MatchingSuggestionModalProps) {
  const colorConfig = getEmotionColorConfig(emotion);
  
  // 서버에서 제공한 colorName 우선 사용
  const displayColorName = colorName || colorConfig.colorName;
  const displayColor = color || colorConfig.background;
  
  return (
    // ...
    <div 
      className="matching-modal-color-badge" 
      style={{ 
        backgroundColor: displayColor,
        color: colorConfig.text
      }}
    >
      {displayColorName} {/* ✅ 서버의 색상 이름 표시 */}
    </div>
    // ...
  );
}
```

---

## 📊 동작 흐름

```
1. 사용자가 감정 진단 실행
   ↓
2. 서버: detectEmotionFromText() 호출
   - emotion: "기쁨"
   - color: "#FFE066"
   - colorName: "황금빛" ✅
   ↓
3. 클라이언트: mood 상태 업데이트
   - { emotion: "기쁨", score: 85, color: "#FFE066", colorName: "황금빛" }
   ↓
4. 모달 표시
   - 배지 배경색: #FFE066
   - 배지 텍스트: "황금빛" ✅
```

---

## 🎨 색상 이름 예시

| 감정 | 색상 코드 | 색상 이름 |
|------|-----------|-----------|
| 기쁨 | `#FFE066` | 황금빛 |
| 행복 | `#FFF176` | 밝은 노랑 |
| 사랑/애정 | `#FF5252` | 선명한 빨강 |
| 평온/안도 | `#69F0AE` | 민트 초록 |
| 슬픔/우울 | `#5C6BC0` | 인디고 |
| 불안/걱정 | `#AB47BC` | 자주색 |
| 분노/화 | `#F44336` | 진한 빨강 |
| 희망/기대 | `#9CCC65` | 라임 초록 |
| 감사 | `#FFD54F` | 골든 옐로우 |
| 만족 | `#26C6DA` | 청록색 |

---

## 🧪 테스트 방법

### 1. 감정 진단 테스트
```bash
# 1. 다이어리 페이지 접속
# 2. AI와 5턴 이상 대화
# 3. "감정 진단하기" 버튼 클릭
# 4. 모달 확인:
#    - 상단 배지에 "황금빛", "민트 초록" 등 서버의 색상 이름 표시되는지 확인
#    - 색상과 이름이 일치하는지 확인
```

### 2. API 응답 확인
```bash
# 브라우저 개발자 도구 → Network 탭
# /api/diary/session/:id/analyze 요청 확인
# Response:
{
  "ok": true,
  "mood": {
    "emotion": "기쁨",
    "score": 85,
    "color": "#FFE066",
    "colorName": "황금빛" // ✅ 확인
  }
}
```

---

## 🔧 문제 해결

### 문제 1: 모달에 색상 이름이 표시되지 않음
**원인**: 서버에서 `colorName`을 반환하지 않음
**해결**:
```bash
# emotion_color_names.json 파일 존재 확인
ls server/emotion_color_names.json

# 서버 재시작
npm run dev
```

### 문제 2: 기본 색상 이름("노란색")이 표시됨
**원인**: API 응답에 `colorName`이 없거나 fallback 사용 중
**해결**:
1. 서버 로그 확인: `console.log('✅ 최종 감정 분석:', { emotion, score, color, colorName })`
2. `EMOTION_COLOR_NAMES` 객체에 해당 감정 키가 있는지 확인
3. 감정 키 철자가 정확한지 확인 ("기쁨" vs "기뿜")

### 문제 3: 일부 감정만 색상 이름이 표시됨
**원인**: `emotion_color_names.json`에 일부 감정이 누락됨
**해결**:
```json
// 누락된 감정 추가
{
  "새로운감정": "색상이름",
  ...
}
```

---

## 🎯 기대 효과

1. **일관성 향상**: 진단 결과와 모달의 색상 이름이 정확히 일치
2. **사용자 경험 개선**: 감성적이고 시적인 색상 이름으로 감정 표현 강화
3. **유지보수 용이**: 색상 이름을 JSON 파일에서 중앙 관리
4. **확장성**: 새로운 감정 추가 시 JSON 파일만 수정하면 됨

---

## 📝 추가 개선 사항

### 향후 계획
- [ ] 색상 이름 다국어 지원 (영어, 일본어 등)
- [ ] 사용자 커스텀 색상 이름 설정 기능
- [ ] 색상 이름 투표 시스템 (가장 어울리는 이름 선택)
- [ ] 계절/시간대별 색상 이름 변화

---

## 📚 관련 파일

### 서버
- `server/emotion_color_names.json` - 색상 이름 매핑 데이터
- `server/index.ts` - 감정 분석 로직 및 API

### 클라이언트
- `src/types/api.ts` - 타입 정의
- `src/pages/Diary.tsx` - 다이어리 페이지
- `src/components/MatchingSuggestionModal.tsx` - 매칭 권유 모달
- `src/utils/emotionColorUtils.ts` - 색상 유틸리티 (fallback용)

---

## ✅ 체크리스트

- [x] 서버에 `emotion_color_names.json` 추가
- [x] 서버 `detectEmotionFromText()` 함수에 `colorName` 반환 추가
- [x] 서버 타입 정의 업데이트
- [x] 클라이언트 타입 정의 업데이트
- [x] Diary 컴포넌트 수정
- [x] MatchingSuggestionModal 컴포넌트 수정
- [x] 서버 재시작 및 테스트
- [x] 문서화 완료

---

## 🚀 배포 전 확인사항

1. ✅ `emotion_color_names.json` 파일이 배포 환경에 포함되는지 확인
2. ✅ 모든 감정에 대한 색상 이름이 정의되어 있는지 확인
3. ✅ 기본값(fallback) 처리가 올바른지 확인
4. ✅ 프로덕션 빌드 테스트
5. ✅ API 응답에 `colorName` 필드가 포함되는지 확인

---

**구현 완료일**: 2025년 11월 10일
**버전**: 1.0.0
