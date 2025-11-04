// API 응답 타입 정의

export interface DiarySessionResponse {
  _id: string;
  date: string;
  title?: string;
  type?: 'ai' | 'online'; // 세션 타입
  mood?: { emotion: string; score: number; color: string } | null;
  originalMessageCount?: number; // 온라인 채팅의 원본 메시지 개수
  summary?: string; // 대화 요약
  memo?: string; // 메모
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

