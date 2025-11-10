// API 응답 타입 정의

// 감정 분석 고도화: 복합 감정 타입
export interface EmotionDetail {
  emotion: string;      // 감정 이름
  score: number;        // 강도 (0-1)
  color: string;        // 색상 코드
  intensity: number;    // 강도 레벨 (0-100)
}

// 감정 분석 결과 (확장)
export interface EnhancedMood {
  primary: EmotionDetail;           // 주 감정
  secondary: EmotionDetail[];       // 부 감정들 (최대 3개)
  trend?: 'improving' | 'stable' | 'declining'; // 추세
  triggerWords?: string[];          // 감정 유발 키워드
  timestamp: string;                // 분석 시간
}

export interface DiarySessionResponse {
  _id: string;
  date: string;
  title?: string;
  type?: 'ai' | 'online'; // 세션 타입
  mood?: { emotion: string; score: number; color: string; colorName: string } | null;
  enhancedMood?: EnhancedMood;     // 확장 감정 분석 결과
  originalMessageCount?: number; // 온라인 채팅의 원본 메시지 개수
  summary?: string; // 대화 요약
  memo?: string; // 메모
  partnerNickname?: string; // 온라인 채팅 상대방 닉네임
  lastUpdatedAt: string;
  preview?: string;
}

export interface DiaryMessageResponse {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface DiarySessionsApiResponse {
  items: DiarySessionResponse[];
}

export interface DiarySessionDetailApiResponse {
  session: DiarySessionResponse;
  messages: DiaryMessageResponse[];
}

// Recharts 타입
export interface ChartTooltipPayload {
  name: string;
  value: number;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}

export interface PieLabelProps {
  name?: string;
  percent?: number;
  cx?: string | number;  // Recharts 타입 허용
  cy?: string | number;  // Recharts 타입 허용
  midAngle?: number;
  innerRadius?: string | number;  // Recharts 타입 허용
  outerRadius?: string | number;  // Recharts 타입 허용
  value?: number;
  index?: number;
  [key: string]: unknown;  // Recharts의 추가 속성 허용
}

// Bar Chart Tooltip Formatter 타입
export interface BarTooltipPayload {
  emotion?: string;
  percentage?: number;
  [key: string]: unknown;
}

export interface BarTooltipFormatterProps {
  payload?: BarTooltipPayload;
  [key: string]: unknown;
}

// 프로필 관련 타입
export interface UserProfile {
  id: string;
  nickname: string;
  title?: string;
  profileImage?: string;
  bio?: string;  // 소개글
  topEmotions?: Array<{  // 감정 TOP3
    rank: number;
    emotion: string;
    color: string;
    count: number;
  }>;
  todayEmotion?: {
    emotion: string;
    color: string;
    score: number;
  };
}

export interface ProfileCardProps {
  profile: UserProfile;
  compact?: boolean;
}
