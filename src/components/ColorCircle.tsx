// ColorCircle.tsx - 간단한 CSS 원형 컴포넌트 (3D 오브 대신 사용)
import React, { useMemo } from 'react';
import './ColorCircle.css';

type ColorCircleProps = {
  color: string;
  size?: number;
  className?: string;
};

export default React.memo(function ColorCircle({ color, size = 12, className = '' }: ColorCircleProps) {
  const style = useMemo(() => ({
    width: size,
    height: size,
    backgroundColor: color,
    borderRadius: '50%',
    boxShadow: `
      0 ${size * 0.08}px ${size * 0.25}px ${color}40,
      inset 0 ${size * 0.08}px ${size * 0.15}px rgba(255, 255, 255, 0.5)
    `,
    border: '1px solid rgba(255, 255, 255, 0.3)',
  }), [color, size]);

  return (
    <div
      className={`color-circle ${className}`}
      style={style}
    />
  );
});
