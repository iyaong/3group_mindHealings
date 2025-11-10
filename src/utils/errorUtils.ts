// errorUtils.ts - 에러 처리 유틸리티 함수들

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  data?: any;
}

/**
 * API 에러를 사용자 친화적 메시지로 변환
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 네트워크 에러
    if (message.includes('failed to fetch') || message.includes('network')) {
      return '인터넷 연결을 확인해주세요. 📡';
    }

    // 인증 에러
    if (message.includes('401') || message.includes('unauthorized') || message.includes('인증')) {
      return '로그인이 필요합니다. 🔐';
    }

    // 권한 에러
    if (message.includes('403') || message.includes('forbidden') || message.includes('권한')) {
      return '접근 권한이 없습니다. 🚫';
    }

    // 404 에러
    if (message.includes('404') || message.includes('not found')) {
      return '요청하신 내용을 찾을 수 없습니다. 🔍';
    }

    // 서버 에러
    if (message.includes('500') || message.includes('server') || message.includes('서버')) {
      return '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요. ⚙️';
    }

    // 타임아웃
    if (message.includes('timeout')) {
      return '요청 시간이 초과되었습니다. 다시 시도해주세요. ⏱️';
    }

    // 원본 메시지 반환 (이미 사용자 친화적인 경우)
    return error.message;
  }

  // 알 수 없는 에러
  return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 💫';
}

/**
 * API 응답을 처리하고 에러 시 예외 발생
 */
export async function handleApiResponse<T = any>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    
    try {
      const data = await response.json();
      errorMessage = data.message || data.error || errorMessage;
    } catch {
      // JSON 파싱 실패 시 기본 메시지 사용
      errorMessage = response.statusText || errorMessage;
    }

    const error = new Error(errorMessage) as ApiError;
    error.status = response.status;
    error.statusText = response.statusText;
    throw error;
  }

  return response.json();
}

/**
 * 재시도 로직이 포함된 fetch 함수
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
  delayMs = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // 성공 또는 클라이언트 에러(4xx)는 재시도하지 않음
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // 서버 에러(5xx)는 재시도
      throw new Error(`Server error: ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < maxRetries - 1) {
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * 안전한 JSON 파싱
 */
export function safeJsonParse<T = any>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * 에러 로깅 (개발 환경에서만)
 */
export function logError(context: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.group(`🚨 Error in ${context}`);
    console.error(error);
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    console.groupEnd();
  }
}

/**
 * 에러 타입 체크
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('fetch') || 
           message.includes('network') || 
           message.includes('connection');
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('401') || 
           message.includes('unauthorized') || 
           message.includes('인증') ||
           message.includes('로그인');
  }
  return false;
}

export function isServerError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('500') || 
           message.includes('server') || 
           message.includes('서버');
  }
  return false;
}
