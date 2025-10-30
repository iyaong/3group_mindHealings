import React, { Suspense, useEffect, useMemo, useState } from 'react';
import AuroraOrb from './AuroraOrb';
const AuroraThreeLazy = React.lazy(() => import('./AuroraThree'));

function isWebGLAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function AuroraAuto({ color, size = 132, className = '' }: { color: string; size?: number; className?: string }) {
  const webgl = useMemo(() => isWebGLAvailable(), []);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!webgl) return;
    // when color/size changes, re-evaluate readiness and fallback
    setFallback(false);
    if (ready) return;
    const t = setTimeout(() => {
      setFallback(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [webgl, color, size, ready]);

  if (!webgl) return <AuroraOrb color={color} size={size} className={className} />;
  return (
    <Suspense fallback={<AuroraOrb color={color} size={size} className={className} />}>
      {fallback ? (
        <AuroraOrb color={color} size={size} className={className} />
      ) : (
        <AuroraThreeLazy color={color} size={size} className={className} onReady={() => setReady(true)} />
      )}
    </Suspense>
  );
}
