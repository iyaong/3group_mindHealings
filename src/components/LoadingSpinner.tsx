// LoadingSpinner.tsx - 범용 로딩 스피너 컴포넌트

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullscreen?: boolean;
  type?: 'spinner' | 'dots' | 'pulse';
}

export default function LoadingSpinner({ 
  size = 'md', 
  message, 
  fullscreen = false,
  type = 'spinner'
}: LoadingSpinnerProps) {
  
  const sizeClass = size === 'sm' ? 'loading-spinner-sm' : size === 'lg' ? 'loading-spinner-lg' : '';

  const spinnerContent = (
    <div style={{ textAlign: 'center' }}>
      {type === 'spinner' && (
        <div className={`loading-spinner ${sizeClass}`} />
      )}
      
      {type === 'dots' && (
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
      
      {type === 'pulse' && (
        <div style={{
          width: size === 'sm' ? '30px' : size === 'lg' ? '80px' : '50px',
          height: size === 'sm' ? '30px' : size === 'lg' ? '80px' : '50px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          animation: 'pulse 1.5s ease-in-out infinite',
          margin: '0 auto'
        }} />
      )}
      
      {message && (
        <div className="loading-text" style={{
          fontSize: size === 'sm' ? '12px' : size === 'lg' ? '16px' : '14px',
          marginTop: size === 'sm' ? '8px' : '16px'
        }}>
          {message}
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          {spinnerContent}
        </div>
      </div>
    );
  }

  return spinnerContent;
}

// 인라인 스피너 (버튼 내부 등)
export function InlineSpinner({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <div 
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${Math.max(2, size / 10)}px solid ${color}33`,
        borderLeftColor: color,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        verticalAlign: 'middle'
      }}
    />
  );
}

// 로딩 오버레이 (특정 영역에만 적용)
export function LoadingOverlay({ 
  message = '로딩 중...',
  blur = true 
}: { 
  message?: string;
  blur?: boolean;
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: blur ? 'blur(4px)' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <LoadingSpinner message={message} type="pulse" />
    </div>
  );
}
