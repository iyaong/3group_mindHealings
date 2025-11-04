import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { hexToRgb } from '../utils/colorUtils';
import './EmotionOrbPremium.css';

type EmotionOrbPremiumProps = {
  color: string;
  size?: number;
  className?: string;
  intensity?: number;
  analyzing?: boolean; // 감정 분석 중 상태
  showCompleted?: boolean; // 진단 완료 표시
  messageCount?: number; // 메시지 개수 (진단중 텍스트 표시 여부)
};

// Custom shader for minitap.ai-style liquid gradient with smooth color morphing
const liquidGradientVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const liquidGradientFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uOpacity;
  
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  // Improved 3D Simplex Noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vec3 viewDir = normalize(cameraPosition - vPosition);
    vec3 normal = normalize(vNormal);
    
    // Ultra-soft fresnel for subtle edge definition
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.8);
    
    // Much faster and irregular organic movement
    float t = uTime * 0.30;
    
    // 오로라 커튼 효과 - 불규칙적이고 빠른 움직임
    // Y축은 크게, X/Z축은 작게 + 각기 다른 속도
    float verticalFlow1 = snoise(vec3(vPosition.x * 0.15, vPosition.y * 2.5 + t * 1.4, vPosition.z * 0.15));
    float verticalFlow2 = snoise(vec3(vPosition.x * 0.25, vPosition.y * 3.5 - t * 1.8, vPosition.z * 0.25));
    float verticalFlow3 = snoise(vec3(vPosition.x * 0.1, vPosition.y * 2.8 + t * 1.1, vPosition.z * 0.1));
    
    // 세로 커튼의 밀도 - 더 빠르고 다양한 속도
    float curtainDensity1 = snoise(vec3(vPosition.x * 0.08, vPosition.y * 4.0 + t * 2.2, vPosition.z * 0.08));
    float curtainDensity2 = snoise(vec3(vPosition.x * 0.12, vPosition.y * 3.2 - t * 1.7, vPosition.z * 0.12));
    
    // 오로라 띠 패턴 - 불규칙한 속도
    float auroraBand1 = snoise(vec3(vPosition.x * 0.2, vPosition.y * 3.8 + t * 2.0, vPosition.z * 0.2));
    float auroraBand2 = snoise(vec3(vPosition.x * 0.18, vPosition.y * 4.5 - t * 1.5, vPosition.z * 0.18));
    
    // 오로라 커튼 패턴 합성 - 세로 띠에 집중
    float liquidPattern = 
      verticalFlow1 * 0.28 +
      verticalFlow2 * 0.24 +
      verticalFlow3 * 0.20 +
      curtainDensity1 * 0.14 +
      curtainDensity2 * 0.10 +
      auroraBand1 * 0.03 +
      auroraBand2 * 0.01;
    
    // 세로 방향 약한 그라데이션 (띠를 더 명확하게 보이도록)
    float verticalGradient = (vPosition.y + 1.0) * 0.5;
    liquidPattern += verticalGradient * 0.08;
    
    // Turbulence with strong vertical bias - 더 불규칙하고 빠름
    float turbulence = snoise(vec3(
      vPosition.x * 0.3 + t * 0.9,   // X축 작게, 빠르게
      vPosition.y * 5.0 + t * 2.3,   // Y축 매우 크게, 매우 빠르게
      vPosition.z * 0.3 - t * 0.7    // Z축 작게, 빠르게
    )) * 0.18;
    liquidPattern += turbulence;
    
    // Normalize to 0-1 with wider range for smoother distribution
    liquidPattern = liquidPattern * 0.45 + 0.5;
    liquidPattern = clamp(liquidPattern, 0.0, 1.0);
    
    // 오로라 커튼 색상 밴드 - 더 좁고 명확한 띠
    float colorBand1 = smoothstep(0.25, 0.45, liquidPattern);
    float colorBand2 = smoothstep(0.45, 0.60, liquidPattern);
    float colorBand3 = smoothstep(0.60, 0.80, liquidPattern);
    
    // 3색 그라데이션 - 오로라 커튼처럼 띠 형태로 혼합
    vec3 gradient = uColor1;
    gradient = mix(gradient, uColor2, colorBand1 * 0.9);
    gradient = mix(gradient, uColor3, colorBand2 * 0.8);
    gradient = mix(gradient, uColor1 * 0.7, colorBand3 * 0.4); // 순환
    
    // 세로 방향 색상 웨이브 - 더 빠르고 불규칙
    float verticalWave = sin(vPosition.y * 4.0 + t * 4.5) * 0.5 + 0.5;
    gradient = mix(gradient, uColor2, verticalWave * 0.14);
    
    // 오로라 커튼 shimmer - 매우 빠르고 다양한 주파수
    float shimmer1 = sin(vPosition.y * 10.0 + t * 7.0) * 0.5 + 0.5;
    float shimmer2 = sin(vPosition.y * 15.0 - t * 9.5) * 0.5 + 0.5;
    float shimmer3 = sin(vPosition.y * 6.0 + t * 5.5) * 0.5 + 0.5;
    float shimmer4 = sin(vPosition.y * 8.0 - t * 6.2) * 0.5 + 0.5;
    float shimmer = (shimmer1 * 0.35 + shimmer2 * 0.3 + shimmer3 * 0.2 + shimmer4 * 0.15) * 0.06;
    gradient += shimmer;
    
    // Brighten center, darken edges slightly for depth
    float centerGlow = 1.0 - length(vPosition) * 0.08;
    gradient *= centerGlow;
    
    // Very subtle fresnel highlight
    gradient += vec3(1.0) * fresnel * 0.015;
    
    // High opacity with slight edge transparency
    float alpha = uOpacity * (0.96 - fresnel * 0.05);
    
    gl_FragColor = vec4(gradient, alpha);
  }
`;

// Liquid core sphere with custom shader
const LiquidCore = memo(function LiquidCore({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const outerGlowRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  
  // 색상 전환을 위한 target colors
  const targetColorsRef = useRef<{
    color1: THREE.Color;
    color2: THREE.Color;
    color3: THREE.Color;
  } | null>(null);

  // 순수한 기본 색상만 사용 (색상 혼합 제거)
  const colors = useMemo(() => {
    const base = hexToRgb(color);
    const baseColor = new THREE.Color(base.r, base.g, base.b);
    
    if (import.meta.env.DEV) {
      console.log('🎨 EmotionOrbPremium color changed:', color);
    }
    
    return {
      color1: baseColor,
      color2: baseColor.clone().multiplyScalar(1.2), // 약간 밝게
      color3: baseColor.clone().multiplyScalar(0.8), // 약간 어둡게
    };
  }, [color]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Much faster organic rotation for dynamic aurora flow
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.25;
      coreRef.current.rotation.z = Math.sin(t * 0.4) * 0.12;
      
      // More dynamic breathing effect
      const breathe = 1 + Math.sin(t * 0.6) * 0.022;
      coreRef.current.scale.setScalar(breathe);
    }
    
    // Update time uniform - 항상 업데이트
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      
      // 부드러운 색상 전환 (lerp) - 약 0.4초에 걸쳐 전환
      if (targetColorsRef.current) {
        const lerpSpeed = 0.08; // 프레임당 8% 씩 전환 (60fps 기준 약 0.4초)
        
        materialRef.current.uniforms.uColor1.value.lerp(targetColorsRef.current.color1, lerpSpeed);
        materialRef.current.uniforms.uColor2.value.lerp(targetColorsRef.current.color2, lerpSpeed);
        materialRef.current.uniforms.uColor3.value.lerp(targetColorsRef.current.color3, lerpSpeed);
        
        // Inner glow layer도 부드럽게 전환
        if (glowRef.current) {
          const glowMaterial = glowRef.current.material as THREE.MeshBasicMaterial;
          glowMaterial.color.lerp(targetColorsRef.current.color2, lerpSpeed);
        }
        
        // Outer glow aura도 부드럽게 전환
        if (outerGlowRef.current) {
          const outerMaterial = outerGlowRef.current.material as THREE.MeshBasicMaterial;
          outerMaterial.color.lerp(targetColorsRef.current.color1, lerpSpeed);
        }
        
        // Subtle color halo도 부드럽게 전환
        if (haloRef.current) {
          const haloMaterial = haloRef.current.material as THREE.MeshBasicMaterial;
          haloMaterial.color.lerp(targetColorsRef.current.color2, lerpSpeed);
        }
      }
    }
  });
  
  // 색상 변경 시 target 업데이트 (즉시 적용하지 않고 useFrame에서 lerp)
  useEffect(() => {
    targetColorsRef.current = {
      color1: colors.color1.clone(),
      color2: colors.color2.clone(),
      color3: colors.color3.clone(),
    };
    
    // 첫 렌더링 시에만 즉시 적용
    if (materialRef.current && !materialRef.current.uniforms.uColor1.value.equals(new THREE.Color(0, 0, 0))) {
      if (import.meta.env.DEV) {
        console.log('🎨 Target colors updated for smooth transition');
      }
    } else if (materialRef.current) {
      // 첫 렌더링: 즉시 적용
      materialRef.current.uniforms.uColor1.value.copy(colors.color1);
      materialRef.current.uniforms.uColor2.value.copy(colors.color2);
      materialRef.current.uniforms.uColor3.value.copy(colors.color3);
    }
  }, [colors]);

  // Orb 마운트 확인 로그
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔮 Orb component mounted with colors:', colors);
    }
  }, []);

  return (
    <group ref={groupRef}>
      {/* Inner glow layer */}
      <mesh ref={glowRef} scale={0.86}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={colors.color2}
          opacity={0.75}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main liquid gradient core */}
      <mesh ref={coreRef} scale={0.94}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={liquidGradientVertexShader}
          fragmentShader={liquidGradientFragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uColor1: { value: colors.color1.clone() },
            uColor2: { value: colors.color2.clone() },
            uColor3: { value: colors.color3.clone() },
            uOpacity: { value: 0.95 },
          }}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Premium glass shell with transmission (minitap.ai style) */}
      <mesh scale={1.0}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshTransmissionMaterial
          transmission={0.75}
          thickness={0.55}
          roughness={0.08}
          chromaticAberration={0.02}
          anisotropy={0.15}
          distortion={0.0}
          distortionScale={0.0}
          temporalDistortion={0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.03}
          ior={1.45}
          color="#ffffff"
          opacity={0.7}
          transparent
        />
      </mesh>

      {/* Outer soft glow aura */}
      <mesh ref={outerGlowRef} scale={1.05}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          transparent
          opacity={0.12}
          color={colors.color1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle color halo */}
      <mesh ref={haloRef} scale={1.09}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          transparent
          opacity={0.05}
          color={colors.color3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

// 감정 색상 배열 (emotion_colors.json의 18가지 색상)
const EMOTION_COLORS = [
  '#FFD54F', '#FF6B6B', '#A8E6CF', '#4DA6FF', '#8BC34A',
  '#FFC107', '#4A90E2', '#D32F2F', '#9B59B6', '#B0BEC5',
  '#FF6D00', '#FFB3C1', '#8D6E63', '#2E7D32', '#6D6D6D',
  '#BDBDBD', '#C5E1A5', '#F48FB1'
];

const EmotionOrbPremium = memo(function EmotionOrbPremium({ 
  color, 
  size = 280, 
  className = '', 
  intensity = 1,
  analyzing = false,
  showCompleted = false,
  messageCount = 0
}: EmotionOrbPremiumProps) {
  const [cyclingColorIndex, setCyclingColorIndex] = useState(0);
  
  // 진단 중일 때 색상 순환
  useEffect(() => {
    if (!analyzing) return;
    
    const interval = setInterval(() => {
      setCyclingColorIndex((prev) => (prev + 1) % EMOTION_COLORS.length);
    }, 1000); // 1초마다 색상 변경
    
    return () => clearInterval(interval);
  }, [analyzing]);
  
  // 진단 중일 때는 순환 색상, 아니면 지정된 색상
  const displayColor = analyzing ? EMOTION_COLORS[cyclingColorIndex] : color;
  
  // 컴포넌트 마운트 시 한 번만 로그
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🌟 EmotionOrbPremium 마운트:', { 
        color,
        displayColor,
        analyzing,
        size,
        intensity
      });
    }
  }, []); // 빈 의존성 배열 = 마운트 시 한 번만
  
  return (
    <div
      className={`emotion-orb-premium-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        display: 'block',
        position: 'relative',
      }}
    >
      <div
        className="emotion-orb-premium-container"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: `
            0 ${size * 0.12}px ${size * 0.28}px rgba(140, 160, 210, ${0.18 * intensity}),
            0 ${size * 0.06}px ${size * 0.2}px rgba(170, 190, 240, ${0.14 * intensity}),
            inset 0 ${size * 0.035}px ${size * 0.12}px rgba(255, 255, 255, ${0.6 * intensity})
          `,
          background: `
            radial-gradient(
              circle at 35% 30%,
              rgba(255, 255, 255, ${0.08 * intensity}) 0%,
              rgba(255, 255, 255, 0) 60%
            )
          `,
        }}
      >
        <Canvas
          dpr={[1, 1.5]} // dpr을 낮춰서 리소스 절약
          frameloop="always" // 항상 렌더링
          camera={{ position: [0, 0, 3.8], fov: 38 }}
          gl={{ 
            antialias: true, 
            alpha: true, 
            powerPreference: 'default',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: true, // WebGL 컨텍스트 유지
            stencil: false,
            depth: true,
          }}
          style={{ 
            display: 'block',
            touchAction: 'none',
          }}
          onCreated={({ gl, scene }) => {
            // WebGL 설정 최적화
            gl.setClearColor(0x000000, 0);
            scene.background = null;
            
            if (import.meta.env.DEV) {
              console.log('✅ Canvas created successfully');
            }
          }}
        >
          {/* Soft ambient fill light */}
          <ambientLight intensity={0.45 * intensity} color="#f9faff" />
          
          {/* Main key light (top-front) */}
          <directionalLight 
            position={[2.5, 3.5, 3.5]} 
            intensity={0.85 * intensity} 
            color="#ffffff" 
          />
          
          {/* Back rim light */}
          <directionalLight 
            position={[-2.5, -1, -3]} 
            intensity={0.45 * intensity} 
            color="#d0d8ff" 
          />
          
          {/* Accent fill light */}
          <pointLight 
            position={[0, 2, 3]} 
            intensity={0.35 * intensity} 
            color="#fff8f0" 
          />

          {/* HDR environment for realistic reflections - Suspense로 감싸기 */}
          <Suspense fallback={null}>
            <Environment preset="sunset" />
          </Suspense>

          <LiquidCore color={displayColor} />
        </Canvas>
      </div>
      
      {/* Premium glass reflection overlay (minitap.ai signature) */}
      <div
        className="emotion-orb-premium-reflection"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at 28% 23%,
              rgba(255, 255, 255, ${0.4 * intensity}) 0%,
              rgba(255, 255, 255, ${0.22 * intensity}) 10%,
              rgba(255, 255, 255, ${0.1 * intensity}) 22%,
              rgba(255, 255, 255, 0) 40%
            )
          `,
          pointerEvents: 'none',
        }}
      />
      
      {/* Subtle sparkle highlight */}
      <div
        className="emotion-orb-premium-sparkle"
        style={{
          position: 'absolute',
          top: '12%',
          left: '12%',
          width: '30%',
          height: '30%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at center,
              rgba(255, 255, 255, ${0.15 * intensity}) 0%,
              rgba(255, 255, 255, 0) 65%
            )
          `,
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />
      
      {/* Bottom depth shadow */}
      <div
        className="emotion-orb-premium-shadow"
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
              rgba(110, 130, 190, ${0.2 * intensity}) 0%,
              rgba(110, 130, 190, 0) 70%
            )
          `,
          filter: 'blur(14px)',
          pointerEvents: 'none',
        }}
      />
      
      {/* 진단 전 텍스트 오버레이 (메시지 0개일 때) */}
      {analyzing && messageCount === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: size * 0.1,
            fontWeight: 700,
            color: '#6b7280',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
            textShadow: '0 2px 8px rgba(255,255,255,0.8)',
            animation: 'pulse-text 1.5s ease-in-out infinite',
          }}
        >
          진단전
        </div>
      )}
      
      {/* 감정 분석 중 텍스트 오버레이 (메시지 1개 이상일 때) */}
      {analyzing && messageCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: size * 0.1,
            fontWeight: 700,
            color: '#374151',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
            textShadow: '0 2px 8px rgba(255,255,255,0.8)',
            animation: 'pulse-text 1.5s ease-in-out infinite',
          }}
        >
          진단중...
        </div>
      )}
      
      {/* 진단 완료 텍스트 오버레이 */}
      {showCompleted && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: size * 0.12,
            fontWeight: 800,
            color: '#10b981',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
            textShadow: '0 2px 12px rgba(16,185,129,0.4), 0 0 20px rgba(255,255,255,0.9)',
            animation: 'completed-text 2s ease-out forwards',
          }}
        >
          진단 완료!
        </div>
      )}
    </div>
  );
});

export default EmotionOrbPremium;

