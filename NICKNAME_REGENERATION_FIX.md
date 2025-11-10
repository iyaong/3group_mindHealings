# 칭호 새로고침 문제 수정

## 문제 상황
- 히스토리 페이지를 새로고침할 때마다 감정 칭호가 새로 생성되는 현상 발생
- "칭호 새로 받기" 버튼을 누르지 않아도 매번 새로운 칭호가 부여됨

## 원인 분석
1. **프론트엔드 캐시 로직 문제**
   - 캐시가 유효한 경우에도 `fetchEmotionTitle()` API를 호출
   - 캐시에 색상 정보가 없어서 색상을 가져오기 위해 API 호출
   - API가 호출될 때마다 OpenAI가 새로운 칭호 생성

2. **백엔드 API 동작**
   - `/api/user/emotion-title` 엔드포인트는 매번 OpenAI로 새 칭호 생성
   - 재생성 여부를 구분하지 않음

## 해결 방법

### 1. 프론트엔드 캐시 개선 (EmotionTitle.tsx)

**변경 전:**
```tsx
if (!isExpired) {
  setTitle(cachedTitle);
  previousTitleRef.current = cachedTitle;
  setLoading(false);
  
  // ❌ 문제: 색상을 가져오기 위해 API 호출
  fetchEmotionTitle();
  return;
}
```

**변경 후:**
```tsx
if (!isExpired) {
  setTitle(cachedTitle);
  previousTitleRef.current = cachedTitle;
  
  // ✅ 해결: 캐시된 색상도 함께 사용
  if (cachedColor) {
    setEmotionColor(cachedColor);
  }
  
  setLoading(false);
  // ✅ 캐시가 유효하면 API 호출하지 않음
  return;
}
```

### 2. 캐시 저장 시 색상 정보 포함

**변경 전:**
```tsx
localStorage.setItem(CACHE_KEY, JSON.stringify({
  title: newTitle,
  timestamp: Date.now()
}));
```

**변경 후:**
```tsx
localStorage.setItem(CACHE_KEY, JSON.stringify({
  title: newTitle,
  color: data.color || emotionColor,  // ✅ 색상 정보 추가
  timestamp: Date.now()
}));
```

## 수정 내용

### src/components/EmotionTitle.tsx
1. **캐시 로드 로직 개선**
   - 캐시에서 `color` 정보도 함께 읽기
   - 캐시가 유효하면 API 호출 생략
   - 색상 정보가 있으면 `setEmotionColor()` 호출

2. **캐시 저장 로직 개선**
   - 칭호와 함께 색상 정보도 저장
   - 다음 로드 시 API 호출 없이 전체 UI 복원 가능

## 테스트 방법

### 1. 기본 동작 테스트
1. 히스토리 페이지 방문
2. 칭호가 표시되는지 확인
3. 페이지 새로고침 (F5)
4. **칭호가 동일하게 유지되는지 확인** ✅

### 2. 칭호 재생성 테스트
1. "🔄 칭호 새로 받기" 버튼 클릭
2. 새로운 칭호가 생성되는지 확인
3. 토스트 메시지 확인
4. 페이지 새로고침
5. 새로운 칭호가 유지되는지 확인 ✅

### 3. 캐시 만료 테스트
1. 개발자 도구 → Application → Local Storage
2. `emotion_title_cache` 항목의 `timestamp` 값을 1시간 이전으로 변경
3. 페이지 새로고침
4. API가 호출되어 칭호가 갱신되는지 확인 ✅

## 기대 효과

### 사용자 경험 개선
- ✅ 페이지 새로고침 시 칭호 유지
- ✅ 불필요한 칭호 변경 방지
- ✅ 사용자가 원할 때만 칭호 재생성

### 성능 개선
- ✅ 불필요한 API 호출 감소
- ✅ OpenAI API 비용 절감
- ✅ 페이지 로딩 속도 향상

### 데이터 일관성
- ✅ 1시간 동안 동일한 칭호 유지
- ✅ 색상과 칭호의 일관성 보장
- ✅ 캐시 만료 후에만 새로 생성

## 추가 고려사항

### 캐시 만료 시간
- 현재: 1시간 (CACHE_DURATION = 1000 * 60 * 60)
- 필요시 조정 가능 (예: 24시간으로 변경)

### 수동 캐시 삭제
- "칭호 새로 받기" 버튼 클릭 시 캐시 삭제
- 강제로 새 칭호 생성

### 백엔드 개선 (선택사항)
향후 백엔드에 칭호 저장 기능 추가 고려:
```typescript
// 데이터베이스에 칭호 저장
await db.collection('users').updateOne(
  { userId },
  { 
    $set: { 
      emotionTitle: title,
      emotionTitleUpdatedAt: new Date()
    }
  }
);
```

## 완료 일시
- 2025년 11월 10일
- 커밋 예정

## 관련 파일
- `src/components/EmotionTitle.tsx` - 칭호 컴포넌트 (수정)
- `server/index.ts` - 감정 칭호 API 엔드포인트 (변경 없음)
