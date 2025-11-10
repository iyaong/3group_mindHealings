// ErrorBoundary.tsx - React 에러 경계 컴포넌트
import { Component } from 'react';
import type { ReactNode } from 'react';
import ErrorFallback from './ErrorFallback.tsx';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 에러 발생 시 상태 업데이트
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 에러 로깅 (프로덕션에서는 에러 추적 서비스로 전송)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 개발 환경에서 추가 정보 출력
    if (import.meta.env.DEV) {
      console.group('🚨 Error Details');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // 커스텀 fallback이 제공된 경우
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // 기본 ErrorFallback 사용
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
