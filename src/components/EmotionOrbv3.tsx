import { memo, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { hexToRgb } from '../utils/colorUtils';
import './EmotionOrbv3.css';

type EmotionOrbv3Props = {
  color: string;
  size?: number;
  className?: string;
  intensity?: number;
};

const AuroraSphere = memo(function AuroraSphere({ color }: { color: string }) {
  const sphereColor = useMemo(() => {
    const rgb = hexToRgb(color);
    return new THREE.Color(rgb.r, rgb.g, rgb.b);
  }, [color]);

  return (
    <mesh>
      {/* 고해상도 구체 */}
      <sphereGeometry args={[1.2, 128, 128]} />

      {/* 오로라 유리 재질 */}
      <meshPhysicalMaterial
        transmission={1} // 투명도 (유리처럼)
        roughness={0.1}
        thickness={1}
        envMapIntensity={1.2}
        clearcoat={1}
        clearcoatRoughness={0.1}
        iridescence={1}
        iridescenceIOR={1.3}
        iridescenceThicknessRange={[100, 400]}
        color={sphereColor}
        attenuationDistance={0.5}
      />
    </mesh>
  );
});

const EmotionOrbv3 = memo(function EmotionOrbv3({ 
  color, 
  size = 280, 
  className = '', 
  intensity = 1 
}: EmotionOrbv3Props) {
  console.log('✨ EmotionOrbv3 Render:', { 
    color, 
    size, 
    intensity,
    timestamp: new Date().toISOString()
  });

  return (
    <div
      className={`emotion-orb-v3-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        position: 'relative',
      }}
    >
      <div
        className="emotion-orb-v3-container"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: `
            0 ${size * 0.1}px ${size * 0.25}px rgba(160, 180, 230, ${0.15 * intensity}),
            0 ${size * 0.05}px ${size * 0.18}px rgba(190, 210, 250, ${0.12 * intensity}),
            inset 0 ${size * 0.03}px ${size * 0.1}px rgba(255, 255, 255, ${0.5 * intensity})
          `,
          background: 'linear-gradient(135deg, #f0f4ff 0%, #fef5ff 100%)',
        }}
      >
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <Suspense fallback={null}>
            {/* 조명 */}
            <ambientLight intensity={0.5 * intensity} />
            <directionalLight 
              position={[3, 3, 5]} 
              intensity={1.5 * intensity} 
            />
            <pointLight 
              position={[-5, -2, -5]} 
              intensity={0.8 * intensity} 
              color="#a0c8ff" 
            />

            {/* 구체 */}
            <AuroraSphere color={color} />

            {/* 환경 HDRI (빛 반사용) */}
            <Environment preset="sunset" />

            {/* 후처리: 부드러운 빛 번짐 */}
            <EffectComposer>
              <Bloom
                intensity={0.7 * intensity}
                luminanceThreshold={0.2}
                luminanceSmoothing={0.9}
                height={300}
              />
            </EffectComposer>

            {/* 마우스로 회전 */}
            <OrbitControls enableZoom={false} />
          </Suspense>
        </Canvas>
      </div>
      
      {/* Premium glass reflection overlay */}
      <div
        className="emotion-orb-v3-reflection"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at 28% 25%,
              rgba(255, 255, 255, ${0.4 * intensity}) 0%,
              rgba(255, 255, 255, ${0.2 * intensity}) 12%,
              rgba(255, 255, 255, ${0.08 * intensity}) 25%,
              rgba(255, 255, 255, 0) 45%
            )
          `,
          pointerEvents: 'none',
        }}
      />
      
      {/* Bottom shadow */}
      <div
        className="emotion-orb-v3-shadow"
        style={{
          position: 'absolute',
          bottom: '6%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '65%',
          height: '22%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              ellipse at center,
              rgba(130, 150, 200, ${0.2 * intensity}) 0%,
              rgba(130, 150, 200, 0) 70%
            )
          `,
          filter: 'blur(14px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

export default EmotionOrbv3;

