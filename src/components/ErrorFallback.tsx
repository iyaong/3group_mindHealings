// ErrorFallback.tsx - 에러 발생 시 표시되는 사용자 친화적 화면
import { useNavigate } from 'react-router-dom';
import './ErrorFallback.css';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  type?: 'page' | 'component';
  customMessage?: string;
  showDetails?: boolean;
}

export default function ErrorFallback({
  error,
  resetError,
  type = 'page',
  customMessage,
  showDetails = false,
}: ErrorFallbackProps) {
  const navigate = useNavigate();

  // 에러 타입에 따른 사용자 친화적 메시지
  const getUserFriendlyMessage = (error: Error): string => {
    const message = error.message.toLowerCase();

    // 네트워크 에러
    if (message.includes('fetch') || message.includes('network')) {
      return '인터넷 연결을 확인해주세요.';
    }

    // 인증 에러
    if (message.includes('401') || message.includes('unauthorized') || message.includes('인증')) {
      return '로그인이 필요합니다.';
    }

    // 권한 에러
    if (message.includes('403') || message.includes('forbidden') || message.includes('권한')) {
      return '접근 권한이 없습니다.';
    }

    // 404 에러
    if (message.includes('404') || message.includes('not found')) {
      return '요청하신 내용을 찾을 수 없습니다.';
    }

    // 서버 에러
    if (message.includes('500') || message.includes('server') || message.includes('서버')) {
      return '서버에 일시적인 문제가 발생했습니다.';
    }

    // 타임아웃
    if (message.includes('timeout')) {
      return '요청 시간이 초과되었습니다.';
    }

    // 기본 메시지
    return customMessage || '일시적인 오류가 발생했습니다.';
  };

  const friendlyMessage = getUserFriendlyMessage(error);

  const handleGoHome = () => {
    resetError();
    navigate('/');
  };

  const handleReload = () => {
    resetError();
    window.location.reload();
  };

  return (
    <div className={`error-fallback ${type === 'component' ? 'error-fallback-component' : ''}`}>
      <div className="error-content">
        {/* 에러 아이콘 */}
        <div className="error-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="#ef4444" strokeWidth="4" />
            <path d="M40 20V45" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
            <circle cx="40" cy="55" r="3" fill="#ef4444" />
          </svg>
        </div>

        {/* 에러 메시지 */}
        <h2 className="error-title">앗, 문제가 발생했어요! 😢</h2>
        <p className="error-message">{friendlyMessage}</p>

        {/* 에러 상세 정보 (개발 모드 또는 showDetails가 true일 때) */}
        {(import.meta.env.DEV || showDetails) && (
          <details className="error-details">
            <summary>기술적 세부사항</summary>
            <pre className="error-stack">
              <code>
                {error.name}: {error.message}
                {error.stack && `\n\n${error.stack}`}
              </code>
            </pre>
          </details>
        )}

        {/* 액션 버튼들 */}
        <div className="error-actions">
          <button
            className="error-btn error-btn-primary"
            onClick={handleReload}
          >
            🔄 다시 시도
          </button>

          {type === 'page' && (
            <button
              className="error-btn error-btn-secondary"
              onClick={handleGoHome}
            >
              🏠 홈으로 가기
            </button>
          )}

          <button
            className="error-btn error-btn-text"
            onClick={resetError}
          >
            계속하기
          </button>
        </div>

        {/* 도움말 */}
        <p className="error-help">
          문제가 계속되면{' '}
          <a href="/support" className="error-link">
            고객센터
          </a>
          로 문의해주세요.
        </p>
      </div>
    </div>
  );
}

// 컴팩트한 인라인 에러 컴포넌트
export function InlineError({
  message,
  onRetry,
  showIcon = true,
}: {
  message: string;
  onRetry?: () => void;
  showIcon?: boolean;
}) {
  return (
    <div className="inline-error">
      {showIcon && <span className="inline-error-icon">⚠️</span>}
      <span className="inline-error-message">{message}</span>
      {onRetry && (
        <button className="inline-error-retry" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
