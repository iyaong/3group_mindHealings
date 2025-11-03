import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  Environment, 
  MeshTransmissionMaterial, 
  MeshDistortMaterial,
  Sphere,
  useTexture
} from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { hexToRgb, paletteFromBase } from '../utils/colorUtils';
import './EmotionOrbv4.css';

type EmotionOrbv4Props = {
  color: string;
  size?: number;
  className?: string;
  intensity?: number;
};

// Premium liquid glass shader with iridescence
const premiumLiquidVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const premiumLiquidFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uIridescence;
  
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  
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
    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormal);
    
    // Fresnel effect
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
    
    // Ultra slow, large-scale noise for soft clouds
    float t = uTime * 0.04;
    // Use world-space to avoid UV seams and object-space artifacts
    vec3 P = vWorldPosition * 0.6;
    float noise1 = snoise(P * 0.5 + vec3(t * 0.1, t * 0.08, -t * 0.06));
    float noise2 = snoise(P * 0.8 + vec3(-t * 0.06, t * 0.12, t * 0.09));
    float noise3 = snoise(P * 0.3 + vec3(t * 0.05, -t * 0.07, t * 0.08));
    
    // Soft cloud-like pattern
    float pattern = noise1 * 0.4 + noise2 * 0.35 + noise3 * 0.25;
    pattern = pattern * 0.3 + 0.5; // Very narrow range
    
    // Ultra smooth band-free blending using barycentric weights
    float a = clamp(pattern, 0.0, 1.0);
    float w1 = (1.0 - a);
    w1 *= w1;                 // emphasize low values
    float w3 = a * a;         // emphasize high values
    float w2 = max(0.0, 1.0 - w1 - w3);
    vec3 gradient = uColor1 * w1 + uColor2 * w2 + uColor3 * w3;
    
    // Iridescence simulation (rainbow shimmer)
    vec3 iridescenceColor = vec3(
      sin(fresnel * 3.0 + uTime * 0.2) * 0.5 + 0.5,
      sin(fresnel * 3.0 + uTime * 0.2 + 2.0) * 0.5 + 0.5,
      sin(fresnel * 3.0 + uTime * 0.2 + 4.0) * 0.5 + 0.5
    );
    gradient = mix(gradient, iridescenceColor, fresnel * uIridescence * 0.15);
    
    // Brighten for pastel look
    gradient = mix(gradient, vec3(1.0), 0.2);
    
    // Soft center glow
    float centerGlow = 1.0 - length(vPosition) * 0.06;
    gradient *= centerGlow;
    
    // Subtle fresnel rim
    gradient += vec3(1.0) * fresnel * 0.01;
    
    // High opacity
    float alpha = 0.97 - fresnel * 0.04;
    
    gl_FragColor = vec4(gradient, alpha);
  }
`;

// Inner liquid core
const LiquidCore = memo(function LiquidCore({ color, intensity }: { color: string; intensity: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const palette = useMemo(() => paletteFromBase(color), [color]);
  const colors = useMemo(() => {
    const { c1, c2, c3 } = {
      c1: hexToRgb(palette.c1),
      c2: hexToRgb(palette.c2),
      c3: hexToRgb(palette.c3),
    };
    
    // Pastel adjustment
    return {
      color1: new THREE.Color(c1.r * 0.85 + 0.15, c1.g * 0.85 + 0.15, c1.b * 0.85 + 0.15),
      color2: new THREE.Color(c2.r * 0.88 + 0.12, c2.g * 0.88 + 0.12, c2.b * 0.88 + 0.12),
      color3: new THREE.Color(c3.r * 0.9 + 0.1, c3.g * 0.9 + 0.1, c3.b * 0.9 + 0.1),
    };
  }, [palette]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor1.value = colors.color1.clone();
      materialRef.current.uniforms.uColor2.value = colors.color2.clone();
      materialRef.current.uniforms.uColor3.value = colors.color3.clone();
      materialRef.current.needsUpdate = true;
    }
  }, [colors]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Very gentle floating
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.25) * 0.04 + Math.sin(t * 0.15) * 0.02;
      groupRef.current.rotation.y = t * 0.02;
    }
    
    // Slow rotation
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.06;
      coreRef.current.rotation.x = Math.sin(t * 0.12) * 0.03;
      
      // Subtle breathing
      const breathe = 1 + Math.sin(t * 0.35) * 0.008;
      coreRef.current.scale.setScalar(breathe);
    }
    
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      materialRef.current.uniforms.uColor1.value = colors.color1;
      materialRef.current.uniforms.uColor2.value = colors.color2;
      materialRef.current.uniforms.uColor3.value = colors.color3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Soft inner glow */}
      <mesh scale={0.86}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color={colors.color2}
          opacity={0.5}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main gradient core with shader */}
      <mesh ref={coreRef} scale={0.94}>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={premiumLiquidVertexShader}
          fragmentShader={premiumLiquidFragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uColor1: { value: colors.color1.clone() },
            uColor2: { value: colors.color2.clone() },
            uColor3: { value: colors.color3.clone() },
            uIridescence: { value: intensity },
          }}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Premium glass shell - MeshTransmissionMaterial */}
      <mesh scale={1.0}>
        <sphereGeometry args={[1, 128, 128]} />
        <MeshTransmissionMaterial
          transmission={0.98}
          thickness={0.4}
          roughness={0.02}
          chromaticAberration={0.015}
          anisotropy={0.12}
          distortion={0.0}
          distortionScale={0.0}
          temporalDistortion={0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.02}
          ior={1.42}
          color="#ffffff"
          opacity={0.92}
          transparent
        />
      </mesh>

      {/* Outer soft aura */}
      <mesh scale={1.04}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          transparent
          opacity={0.09}
          color={colors.color1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle color halo */}
      <mesh scale={1.07}>
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

const EmotionOrbv4 = memo(function EmotionOrbv4({ 
  color, 
  size = 280, 
  className = '', 
  intensity = 1 
}: EmotionOrbv4Props) {
  console.log('💎 EmotionOrbv4 Render:', { 
    color, 
    size, 
    intensity,
    timestamp: new Date().toISOString()
  });
  
  return (
    <div
      className={`emotion-orb-v4-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        position: 'relative',
      }}
    >
      <div
        className="emotion-orb-v4-container"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: `
            0 ${size * 0.09}px ${size * 0.24}px rgba(145, 165, 215, ${0.14 * intensity}),
            0 ${size * 0.045}px ${size * 0.17}px rgba(175, 195, 235, ${0.11 * intensity}),
            inset 0 ${size * 0.028}px ${size * 0.09}px rgba(255, 255, 255, ${0.55 * intensity})
          `,
          background: `
            radial-gradient(
              circle at 32% 28%,
              rgba(255, 255, 255, ${0.12 * intensity}) 0%,
              rgba(255, 255, 255, 0) 68%
            )
          `,
        }}
      >
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 3.5], fov: 36 }}
          gl={{ 
            antialias: true, 
            alpha: true, 
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.95,
          }}
        >
          {/* Soft ambient lighting */}
          <ambientLight intensity={0.48 * intensity} color="#fbfcff" />
          
          {/* Main key light */}
          <directionalLight 
            position={[2.5, 3.2, 3.5]} 
            intensity={0.75 * intensity} 
            color="#ffffff" 
          />
          
          {/* Subtle back rim light */}
          <directionalLight 
            position={[-2.2, -1.2, -2.8]} 
            intensity={0.42 * intensity} 
            color="#d8e2ff" 
          />
          
          {/* Soft fill light */}
          <pointLight 
            position={[0, 2.2, 2.8]} 
            intensity={0.32 * intensity} 
            color="#fffaf2" 
          />

          {/* HDRI Environment for realistic reflections */}
          <Environment preset="night" />

          <LiquidCore color={color} intensity={intensity} />

          {/* Post-processing: Bloom + ChromaticAberration */}
          <EffectComposer>
            <Bloom
              intensity={0.6 * intensity}
              luminanceThreshold={0.25}
              luminanceSmoothing={0.85}
              height={280}
            />
            <ChromaticAberration
              offset={[0.0008, 0.0008]}
            />
          </EffectComposer>
        </Canvas>
      </div>
      
      {/* Premium glass reflection */}
      <div
        className="emotion-orb-v4-reflection"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at 26% 24%,
              rgba(255, 255, 255, ${0.48 * intensity}) 0%,
              rgba(255, 255, 255, ${0.27 * intensity}) 13%,
              rgba(255, 255, 255, ${0.1 * intensity}) 28%,
              rgba(255, 255, 255, 0) 48%
            )
          `,
          pointerEvents: 'none',
        }}
      />
      
      {/* Sparkle highlight */}
      <div
        style={{
          position: 'absolute',
          top: '14%',
          left: '14%',
          width: '28%',
          height: '28%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at center,
              rgba(255, 255, 255, ${0.22 * intensity}) 0%,
              rgba(255, 255, 255, 0) 72%
            )
          `,
          filter: 'blur(9px)',
          pointerEvents: 'none',
          animation: 'v4-sparkle 3.5s ease-in-out infinite',
        }}
      />
      
      {/* Bottom soft shadow */}
      <div
        style={{
          position: 'absolute',
          bottom: '7%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '62%',
          height: '20%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              ellipse at center,
              rgba(125, 145, 195, ${0.17 * intensity}) 0%,
              rgba(125, 145, 195, 0) 72%
            )
          `,
          filter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

export default EmotionOrbv4;

