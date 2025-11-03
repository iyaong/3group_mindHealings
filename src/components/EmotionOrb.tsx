import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { hexToRgb, paletteFromBase } from '../utils/colorUtils';
import './EmotionOrb.css';

// Soft pastel liquid gradient shader
const LiquidGlassMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor1: new THREE.Color(0.5, 0.5, 0.5),
    uColor2: new THREE.Color(0.5, 0.5, 0.5),
    uColor3: new THREE.Color(0.5, 0.5, 0.5),
  },
  // Vertex Shader
  /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    void main() {
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader - Soft pastel liquid effect
  /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    // Smooth 3D noise
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
      
      // Very soft fresnel for subtle edge glow
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.5);
      
      // Very slow liquid flow
      float t = uTime * 0.08;
      
      // Single large soft cloud layer - more stable
      float liquid1 = snoise(vPosition * 0.5 + vec3(t * 0.25, t * 0.18, -t * 0.12));
      float liquid2 = snoise(vPosition * 0.9 + vec3(-t * 0.15, t * 0.2, t * 0.16));
      
      // Very subtle blend with narrow range
      float liquid = liquid1 * 0.7 + liquid2 * 0.3;
      liquid = liquid * 0.2 + 0.5; // Minimal contrast for stability
      
      // Ultra soft pastel color blending with narrow transition
      vec3 colorBlend = mix(uColor1, uColor2, smoothstep(0.45, 0.55, liquid));
      colorBlend = mix(colorBlend, uColor3, smoothstep(0.52, 0.65, liquid));
      
      // Stabilize with base color bias
      vec3 avgColor = (uColor1 + uColor2 + uColor3) / 3.0;
      colorBlend = mix(avgColor, colorBlend, 0.8);
      
      // Minimal color adjustment - keep the original color
      vec3 finalColor = colorBlend * (0.98 + smoothstep(1.2, 0.0, length(vPosition)) * 0.02);
      
      // Very subtle fresnel highlight only
      finalColor += vec3(1.0) * fresnel * 0.01;
      
      // Very high opacity for solid look
      float alpha = 0.98 - fresnel * 0.04;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
);

extend({ LiquidGlassMaterial });

type EmotionOrbProps = {
  color: string;
  size?: number;
  className?: string;
  intensity?: number;
};

const LiquidCore = memo(function LiquidCore({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial & { 
    uTime: number;
    uColor1: THREE.Color;
    uColor2: THREE.Color;
    uColor3: THREE.Color;
  }>(null);

  const palette = useMemo(() => paletteFromBase(color), [color]);
  const { c1, c2, c3 } = useMemo(() => ({
    c1: hexToRgb(palette.c1),
    c2: hexToRgb(palette.c2),
    c3: hexToRgb(palette.c3),
  }), [palette]);

  const color1 = useMemo(() => new THREE.Color(c1.r, c1.g, c1.b), [c1]);
  const color2 = useMemo(() => new THREE.Color(c2.r, c2.g, c2.b), [c2]);
  const color3 = useMemo(() => new THREE.Color(c3.r, c3.g, c3.b), [c3]);

  // 색상이 변경될 때 유니폼 업데이트
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uColor1 = color1;
      materialRef.current.uColor2 = color2;
      materialRef.current.uColor3 = color3;
    }
  }, [color1, color2, color3]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // 전체 그룹 애니메이션 (부드러운 부유 효과)
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.4) * 0.08;
      groupRef.current.rotation.y = t * 0.05;
    }
    
    if (innerRef.current) {
      // 내부 회전
      innerRef.current.rotation.y = t * 0.08;
      innerRef.current.rotation.x = Math.sin(t * 0.06) * 0.08;
      
      // 숨쉬기 효과
      const breathe = 1 + Math.sin(t * 0.5) * 0.012;
      innerRef.current.scale.setScalar(breathe);
    }
    
    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.06;
      shellRef.current.rotation.x = Math.sin(t * 0.05) * 0.05;
    }
    
    if (materialRef.current) {
      materialRef.current.uTime = t;
      // 매 프레임마다 색상 유니폼을 강제 업데이트하여 흰색으로 바뀌는 것 방지
      materialRef.current.uColor1 = color1;
      materialRef.current.uColor2 = color2;
      materialRef.current.uColor3 = color3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Liquid gradient core */}
      <mesh ref={innerRef} scale={0.97}>
        <sphereGeometry args={[1, 128, 128]} />
        {/* @ts-ignore */}
        <liquidGlassMaterial
          ref={materialRef}
          uColor1={color1}
          uColor2={color2}
          uColor3={color3}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Outer glass shell - minimal interference with color */}
      <mesh ref={shellRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshPhysicalMaterial
          transparent
          transmission={0.95}
          thickness={0.15}
          roughness={0.05}
          metalness={0}
          clearcoat={0.2}
          clearcoatRoughness={0.2}
          reflectivity={0.15}
          iridescence={0.05}
          iridescenceIOR={1.02}
          color={new THREE.Color(1.0, 1.0, 1.0)}
          opacity={0.3}
        />
      </mesh>

      {/* Very subtle outer glow - almost invisible */}
      <mesh scale={1.01}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          transparent
          opacity={0.05}
          color={new THREE.Color(1.0, 1.0, 1.0)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

const EmotionOrb = memo(function EmotionOrb({ 
  color, 
  size = 260, 
  className = '', 
  intensity = 1 
}: EmotionOrbProps) {
  const ambient = 0.5 * intensity;
  const dirIntensity = 0.6 * intensity;
  const rimIntensity = 0.35 * intensity;

  return (
    <div
      className={`emotion-orb-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        position: 'relative',
      }}
    >
      <div
        className="emotion-orb-container"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: `
            0 ${size * 0.08}px ${size * 0.2}px rgba(100, 120, 180, ${0.12 * intensity}),
            0 ${size * 0.04}px ${size * 0.15}px rgba(150, 170, 220, ${0.1 * intensity}),
            inset 0 ${size * 0.02}px ${size * 0.08}px rgba(255, 255, 255, ${0.4 * intensity}),
            inset 0 -${size * 0.02}px ${size * 0.08}px rgba(100, 120, 180, ${0.15 * intensity})
          `,
          background: `
            radial-gradient(
              circle at 30% 30%,
              rgba(255, 255, 255, ${0.25 * intensity}) 0%,
              rgba(255, 255, 255, 0) 50%
            )
          `,
        }}
      >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 3.8], fov: 35 }}
        gl={{ 
          antialias: true, 
          alpha: true, 
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        {/* Soft diffuse lighting */}
        <ambientLight intensity={ambient} color="#f8f9ff" />
        
        {/* Main light from top */}
        <directionalLight 
          position={[1, 3, 2.5]} 
          intensity={dirIntensity} 
          color="#ffffff" 
        />
        
        {/* Soft back light (pastel blue) */}
        <directionalLight 
          position={[-2, -1.5, -3]} 
          intensity={rimIntensity} 
          color="#c7d2fe" 
        />
        
        {/* Warm accent light */}
        <pointLight 
          position={[0, 1, 2.5]} 
          intensity={0.3 * intensity} 
          color="#fff5e6" 
        />

        <LiquidCore color={color} />
      </Canvas>
      </div>
      
      {/* Glass reflection overlay */}
      <div
        className="emotion-orb-reflection"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at 25% 25%,
              rgba(255, 255, 255, ${0.5 * intensity}) 0%,
              rgba(255, 255, 255, ${0.2 * intensity}) 20%,
              rgba(255, 255, 255, 0) 45%
            )
          `,
          pointerEvents: 'none',
        }}
      />
      
      {/* Bottom shadow overlay */}
      <div
        className="emotion-orb-shadow"
        style={{
          position: 'absolute',
          bottom: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: '25%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              ellipse at center,
              rgba(100, 120, 180, ${0.15 * intensity}) 0%,
              rgba(100, 120, 180, 0) 70%
            )
          `,
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

export default EmotionOrb;
