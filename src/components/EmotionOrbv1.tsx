import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { hexToRgb, paletteFromBase } from '../utils/colorUtils';
import './EmotionOrbv1.css';

type EmotionOrbv1Props = {
  color: string;
  size?: number;
  className?: string;
  intensity?: number;
};

// Custom vertex shader for liquid glass effect
const vertexShader = `
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

// Custom fragment shader for abstract gradient liquid glass with aurora effect
const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  // Simplex 3D noise
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
    
    // Sharp fresnel for glass clarity
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    
    // Fast aurora animation (더욱 빠르고 역동적으로)
    float t = uTime * 0.4;
    
    // Large-scale flowing aurora waves (큰 파동)
    float wave1 = snoise(vPosition * 0.6 + vec3(t * 1.2, t * 0.8, -t * 0.9));
    float wave2 = snoise(vPosition * 0.8 + vec3(-t * 0.9, t * 1.1, t * 1.0));
    
    // Medium-scale turbulent flows (중간 소용돌이)
    float turb1 = snoise(vPosition * 1.5 + vec3(t * 1.5, -t * 1.2, t * 1.3));
    float turb2 = snoise(vPosition * 2.0 + vec3(-t * 1.3, t * 1.6, -t * 1.4));
    
    // Fine detail layers (세밀한 흐름)
    float detail1 = snoise(vPosition * 3.5 + vec3(t * 2.0, t * 1.8, -t * 1.9));
    float detail2 = snoise(vPosition * 4.5 + vec3(-t * 1.9, -t * 2.1, t * 2.2));
    
    // Combine all layers for complex movement
    float mainFlow = wave1 * 0.5 + wave2 * 0.5;
    float turbulence = turb1 * 0.5 + turb2 * 0.5;
    float details = detail1 * 0.5 + detail2 * 0.5;
    
    // Create dynamic aurora pattern with strong contrast
    float aurora = mainFlow * 0.5 + turbulence * 0.3 + details * 0.2;
    aurora = aurora * 0.5 + 0.5; // Normalize to 0-1
    
    // Add pulsing energy waves
    float pulse = sin(aurora * 8.0 + t * 4.0) * 0.5 + 0.5;
    aurora = aurora * 0.7 + pulse * 0.3;
    
    // Strong color bands with dramatic transitions (극적인 색상 변화)
    float band1 = smoothstep(0.15, 0.35, aurora);
    float band2 = smoothstep(0.35, 0.55, aurora);
    float band3 = smoothstep(0.55, 0.75, aurora);
    float band4 = smoothstep(0.75, 0.95, aurora);
    
    // Vibrant color mixing (생동감 넘치는 색상 믹스)
    vec3 gradient = uColor1;
    gradient = mix(gradient, uColor2, band1 * 0.9);
    gradient = mix(gradient, uColor3, band2 * 0.85);
    gradient = mix(gradient, uColor2, band3 * 0.8);
    gradient = mix(gradient, uColor1, band4 * 0.7);
    
    // Intense shimmer effect (강한 반짝임)
    float shimmer1 = sin(aurora * 15.0 + t * 5.0) * 0.5 + 0.5;
    float shimmer2 = cos(aurora * 20.0 - t * 6.0) * 0.5 + 0.5;
    vec3 shimmerColor = mix(uColor2, uColor3, shimmer2);
    gradient += shimmerColor * shimmer1 * 0.15;
    
    // Energy glow effect (에너지 발광)
    float energyGlow = pow(abs(sin(aurora * 6.0 + t * 3.5)), 2.0);
    gradient += uColor3 * energyGlow * 0.12;
    
    // Boost saturation and vibrancy (채도와 생동감 증가)
    gradient = pow(gradient, vec3(0.9));
    gradient = mix(gradient, gradient * 1.1, 0.2); // Moderate intensity
    
    // Subtle rim lighting for glass clarity
    gradient += vec3(1.0) * fresnel * 0.01;
    
    // Dynamic opacity for depth
    float alpha = 0.88 + sin(t * 2.0) * 0.04;
    
    gl_FragColor = vec4(gradient, alpha);
  }
`;

// Main liquid glass sphere component
const LiquidGlassSphere = memo(function LiquidGlassSphere({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate color palette
  const palette = useMemo(() => paletteFromBase(color), [color]);
  const colors = useMemo(() => {
    const { c1, c2, c3 } = {
      c1: hexToRgb(palette.c1),
      c2: hexToRgb(palette.c2),
      c3: hexToRgb(palette.c3),
    };
    console.log('🎨 EmotionOrbv1 Color Change:', {
      inputColor: color,
      palette: { c1: palette.c1, c2: palette.c2, c3: palette.c3 }
    });
    return {
      color1: new THREE.Color(c1.r, c1.g, c1.b),
      color2: new THREE.Color(c2.r, c2.g, c2.b),
      color3: new THREE.Color(c3.r, c3.g, c3.b),
    };
  }, [palette, color]);

  // Update colors when they change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor1.value = colors.color1.clone();
      materialRef.current.uniforms.uColor2.value = colors.color2.clone();
      materialRef.current.uniforms.uColor3.value = colors.color3.clone();
      materialRef.current.needsUpdate = true;
      console.log('🔄 Shader colors updated:', {
        c1: colors.color1.getHexString(),
        c2: colors.color2.getHexString(),
        c3: colors.color3.getHexString()
      });
    }
    
    // shell 색상도 업데이트
    if (shellRef.current && shellRef.current.material instanceof THREE.MeshPhysicalMaterial) {
      shellRef.current.material.color = colors.color1.clone();
      shellRef.current.material.needsUpdate = true;
    }
  }, [colors]);

  // Animation loop
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Floating animation (더 크고 부드럽게)
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.6) * 0.18 + Math.sin(t * 0.35) * 0.1;
      groupRef.current.rotation.y = t * 0.12;
      groupRef.current.rotation.x = Math.sin(t * 0.5) * 0.08;
    }
    
    // Aurora core - 매우 역동적인 회전
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.35;
      coreRef.current.rotation.z = Math.sin(t * 0.5) * 0.25;
      coreRef.current.rotation.x = Math.cos(t * 0.4) * 0.2;
    }
    
    // Glass shell counter-rotation (반대 방향으로 더 빠르게)
    if (shellRef.current) {
      shellRef.current.rotation.y = -t * 0.15;
      shellRef.current.rotation.x = Math.sin(t * 0.45) * 0.08;
      shellRef.current.rotation.z = Math.cos(t * 0.38) * 0.06;
    }
    
    // Update shader time and ensure colors stay set
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      materialRef.current.uniforms.uColor1.value = colors.color1;
      materialRef.current.uniforms.uColor2.value = colors.color2;
      materialRef.current.uniforms.uColor3.value = colors.color3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Inner gradient glow - AI의 생명력을 표현 */}
      <mesh scale={0.88}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color={colors.color2}
          opacity={0.7}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Liquid gradient core - 역동적인 오로라 그라데이션 */}
      <mesh ref={coreRef} scale={0.92}>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uColor1: { value: colors.color1.clone() },
            uColor2: { value: colors.color2.clone() },
            uColor3: { value: colors.color3.clone() },
          }}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Middle layer - 색상 강화 */}
      <mesh scale={0.96}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial
          color={colors.color1}
          transparent
          opacity={0.6}
          roughness={0.15}
          metalness={0.08}
          emissive={colors.color2}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Premium glass shell - minitap.ai 스타일 (더 선명하게) */}
      <mesh ref={shellRef} scale={1.0}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshPhysicalMaterial
          transparent
          transmission={0.75}
          thickness={0.6}
          roughness={0.02}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          reflectivity={0.6}
          ior={1.52}
          color={new THREE.Color(1, 1, 1)}
          opacity={0.7}
        />
      </mesh>

      {/* Soft outer glow - AI의 따뜻한 에너지 */}
      <mesh scale={1.04}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          transparent
          opacity={0.12}
          color={colors.color1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      
      {/* Color aura - 색상 오라 */}
      <mesh scale={1.08}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          transparent
          opacity={0.08}
          color={colors.color3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      
      {/* Outer energy field - 외부 에너지장 */}
      <mesh scale={1.12}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          transparent
          opacity={0.05}
          color={colors.color2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

// Main component
const EmotionOrbv1 = memo(function EmotionOrbv1({ 
  color, 
  size = 260, 
  className = '', 
  intensity = 1 
}: EmotionOrbv1Props) {
  // 컴포넌트 렌더링 시 색상 확인
  console.log('🌈 EmotionOrbv1 Render:', { 
    color, 
    size, 
    intensity,
    timestamp: new Date().toISOString()
  });
  
  return (
    <div
      className={`emotion-orb-v1-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        position: 'relative',
      }}
    >
      <div
        className="emotion-orb-v1-container"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: `
            0 ${size * 0.1}px ${size * 0.25}px rgba(120, 140, 200, ${0.15 * intensity}),
            0 ${size * 0.05}px ${size * 0.18}px rgba(160, 180, 230, ${0.12 * intensity}),
            inset 0 ${size * 0.03}px ${size * 0.1}px rgba(255, 255, 255, ${0.5 * intensity})
          `,
        }}
      >
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 3.5], fov: 40 }}
          gl={{ 
            antialias: true, 
            alpha: true, 
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.75,
          }}
        >
          {/* Soft ambient light - AI의 따뜻한 분위기 */}
          <ambientLight intensity={0.35 * intensity} color="#f8f9ff" />
          
          {/* Main key light - 위에서 비추는 주광 */}
          <directionalLight 
            position={[3, 4, 3]} 
            intensity={0.6 * intensity} 
            color="#ffffff" 
          />
          
          {/* Rim light - 테두리 강조 */}
          <directionalLight 
            position={[-2, -1.5, -2.5]} 
            intensity={0.35 * intensity} 
            color="#c7d2fe" 
          />
          
          {/* Fill light - 부드러운 채우기 조명 */}
          <pointLight 
            position={[0, 2.5, 3.5]} 
            intensity={0.25 * intensity} 
            color="#fff5e6" 
          />
          
          {/* Accent light - 생동감 부여 */}
          <pointLight 
            position={[-3, 0, 2]} 
            intensity={0.2 * intensity} 
            color="#e0e7ff" 
          />

          {/* HDR environment for premium reflections */}
          <Environment preset="sunset" />

          <LiquidGlassSphere color={color} />
        </Canvas>
      </div>
      
      {/* Premium glass reflection - AI의 생명력 표현 */}
      <div
        className="emotion-orb-v1-reflection"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at 30% 25%,
              rgba(255, 255, 255, ${0.2 * intensity}) 0%,
              rgba(255, 255, 255, ${0.1 * intensity}) 12%,
              rgba(255, 255, 255, ${0.04 * intensity}) 25%,
              rgba(255, 255, 255, 0) 45%
            )
          `,
          pointerEvents: 'none',
        }}
      />
      
      {/* Subtle color reflection */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '35%',
          height: '35%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at center,
              rgba(255, 255, 255, ${0.06 * intensity}) 0%,
              rgba(255, 255, 255, 0) 70%
            )
          `,
          filter: 'blur(8px)',
          pointerEvents: 'none',
          animation: 'float 3s ease-in-out infinite',
        }}
      />
      
      {/* Bottom depth shadow */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '20%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              ellipse at center,
              rgba(100, 120, 180, ${0.2 * intensity}) 0%,
              rgba(100, 120, 180, 0) 70%
            )
          `,
          filter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

export default EmotionOrbv1;

