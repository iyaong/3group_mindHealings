# 토닥톡 - 감정기반 성장 다이어리

**TodakTalk**: AI 기반 감정 분석 및 성장 지원 플랫폼

---

## 📋 프로젝트 개요

### 핵심 기능
- **AI 감정 일기**: OpenAI GPT 기반 대화형 일기 작성 및 감정 분석
- **감정 시각화**: 감정을 색상으로 표현하고 캘린더에 기록
- **1:1 익명 매칭**: Socket.IO 기반 실시간 감정 공유 채팅
- **감정 히스토리**: 감정 변화 추적 및 통계 분석
- **온보딩 시스템**: 신규 사용자를 위한 4단계 가이드 투어

### 기술 스택
```
Frontend
├── React 19.1.1 + TypeScript 5.9
├── Vite 7.1 (빌드 도구)
├── React Router 7.9
├── Three.js + @react-three/fiber (3D 시각화)
├── Framer Motion + GSAP (애니메이션)
├── Recharts (차트)
└── Socket.IO Client (실시간 통신)

Backend
├── Node.js + Express 4.21
├── MongoDB 6.20 (데이터베이스)
├── JWT + bcryptjs (인증/보안)
├── Socket.IO 4.8 (WebSocket)
├── OpenAI API 4.56 (AI 대화)
└── Express Rate Limit (보안)
```

---

## 🚀 시작하기

### 1. 환경 설정

```bash
# 저장소 클론
git clone https://github.com/als51406/3group_mindHealing.git
cd 3group_mindHealing

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
```

`.env` 파일 수정:
```env
# MongoDB 설정
MONGO_URI=mongodb://USER:PASS@HOST:27017/?authSource=admin
DB_NAME=appdb

# 보안 설정 (32자 이상 권장)
JWT_SECRET=your-strong-secret-key-here

# 서버 포트
PORT=7780

# OpenAI API
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
```

### 2. 개발 서버 실행

**옵션 1: 백엔드 + 프론트엔드 동시 실행**
```bash
npm run dev:full
```

**옵션 2: 개별 실행**
```bash
# 터미널 1: 백엔드 서버
npm run server

# 터미널 2: 프론트엔드 개발 서버
npm run dev
```

### 3. 접속
- **로컬**: http://localhost:5173
- **네트워크**: http://[YOUR-IP]:5173
- **API 서버**: http://localhost:7780

### 4. 상태 확인
```bash
# API 헬스체크
curl http://localhost:7780/api/health
```

---

## 📦 빌드 및 배포

### 프로덕션 빌드
```bash
npm run build
```

### 빌드 결과 미리보기
```bash
npm run preview
```

### 빌드 산출물
- `dist/` 폴더에 정적 파일 생성
- 청크 분리 최적화 (react-vendor, three-vendor)
- Gzip 압축 적용

---

## 🔒 보안 기능

### 구현된 보안 조치
- ✅ **JWT 인증**: Cookie 기반, HttpOnly 플래그
- ✅ **비밀번호 해싱**: bcryptjs (Salt 10 rounds)
- ✅ **Rate Limiting**: 4단계 속도 제한
  - 일반 API: 15분당 300회
  - 인증 API: 15분당 5회
  - AI API: 1분당 10회
  - 업로드: 1시간당 20회
- ✅ **CORS 화이트리스트**: 허용된 origin만 접근
- ✅ **MongoDB 인덱스**: 쿼리 성능 최적화

---

## 🎨 디자인 시스템

### 주요 디자인 요소
- **Glassmorphism**: 유리 느낌의 반투명 UI
- **Liquid Design**: 부드러운 액체 애니메이션
- **Mesh Gradients**: 복잡한 그라디언트 배경
- **3D Effects**: Three.js 기반 입체 시각화
- **Emotion Colors**: 감정별 색상 시스템 (75개 감정 매핑)

### 커스텀 컴포넌트
- `EmotionOrbPremium`: 3D 감정 구체
- `SiriOrb`: Siri 스타일 애니메이션 오브
- `EmotionCalendar`: 감정 색상 캘린더
- `MatchingSuggestionModal`: 매칭 제안 모달

---

## 📡 네트워크 설정

### 로컬 네트워크 접속 (같은 WiFi)

**서버 기기**
```bash
# 백엔드 서버 (백그라운드)
npm run server > server.log 2>&1 &

# 프론트엔드 서버
npm run dev
```

**클라이언트 기기**
```bash
# 서버 기기의 IP 확인 (예: 192.168.4.8)
# 브라우저에서 접속
http://192.168.4.8:5173
```

### 자동 서버 주소 감지
- `localhost` 접속 시 → `http://localhost:7780` 사용
- IP 접속 시 → `http://[IP]:7780` 사용
- Socket.IO는 자동으로 서버 주소 감지 및 연결

---

## 🧪 주요 API 엔드포인트

### 인증
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/me` - 현재 사용자 정보

### 다이어리
- `GET /api/diary/list` - 다이어리 목록
- `GET /api/diary/:date` - 특정 날짜 다이어리
- `POST /api/diary/:date/chat` - AI 대화 추가

### 감정 분석
- `POST /api/emotions/analyze` - 텍스트 감정 분석
- `GET /api/emotions/history` - 감정 히스토리

### 매칭 (Socket.IO)
- `request-match` - 매칭 요청
- `cancel-match` - 매칭 취소
- `chat-message` - 메시지 전송

---

## 📂 프로젝트 구조

```
team-project1/
├── src/
│   ├── components/      # React 컴포넌트
│   ├── pages/          # 페이지 컴포넌트
│   ├── contexts/       # Context API
│   ├── hooks/          # Custom Hooks
│   ├── styles/         # 전역 스타일
│   ├── types/          # TypeScript 타입
│   └── utils/          # 유틸리티 함수
├── server/
│   ├── index.ts        # Express 서버
│   ├── emotion_colors.json
│   └── emotion_color_names.json
├── public/
│   ├── favicon_io/     # 파비콘
│   ├── fonts/          # 웹폰트
│   └── images/         # 정적 이미지
├── dist/               # 빌드 결과물
├── vite.config.ts      # Vite 설정
├── tsconfig.json       # TypeScript 설정
└── package.json        # 의존성 관리
```

---

## 🎯 개발 가이드

### 온보딩 테스트
```bash
# 브라우저 개발자 도구 > Application > Local Storage
# 'onboarding_completed' 키 삭제 후 새로고침
```

### 에러 확인
- Chrome DevTools > Console
- 서버 로그: `tail -f server.log`
- MongoDB 연결: `.env`의 `MONGO_URI` 확인

### 린트 및 포맷
```bash
npm run lint
```

---

## 🔧 개발 스크립트

```json
{
  "dev": "vite",                    // 프론트엔드 개발 서버
  "server": "tsx server/index.ts",  // 백엔드 서버
  "dev:full": "run-p server dev",   // 병렬 실행
  "build": "tsc -b && vite build",  // 프로덕션 빌드
  "lint": "eslint .",               // 코드 린트
  "preview": "vite preview"         // 빌드 미리보기
}
```

---

## 📊 성능 최적화

### 적용된 최적화
- ✅ **코드 스플리팅**: react-vendor, three-vendor 분리
- ✅ **Tree Shaking**: 사용하지 않는 코드 제거
- ✅ **Lazy Loading**: React.lazy + Suspense
- ✅ **이미지 최적화**: WebP 포맷 사용 권장
- ✅ **캐싱**: Service Worker 고려 (향후)

---

## 🐛 트러블슈팅

### MongoDB 연결 실패
```bash
# MongoDB 서버 상태 확인
# .env의 MONGO_URI 검증
# 방화벽/포트 27017 개방 확인
```

### Socket.IO 연결 실패
```bash
# CORS 설정 확인
# 서버 포트 7780 리스닝 확인
# 클라이언트 자동 주소 감지 로그 확인
```

### 빌드 청크 크기 경고
```bash
# vite.config.ts에서 manualChunks 조정
# chunkSizeWarningLimit 증가 (현재 1000KB)
```

---

## 📄 라이선스

이 프로젝트는 교육 목적으로 개발되었습니다.

---

## 👥 기여자

- **개발팀**: 3group_mindHealings
- **리포지토리**: https://github.com/als51406/3group_mindHealing

---

## 📞 문의

프로젝트 관련 문의사항이 있으시면 GitHub Issues를 통해 연락주세요.
