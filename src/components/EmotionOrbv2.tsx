import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { hexToRgb, paletteFromBase } from '../utils/colorUtils';
import './EmotionOrbv2.css';

type EmotionOrbv2Props = {
  color: string;
  size?: number;
  className?: string;
  intensity?: number;
};

// Soft pastel gradient shader - minitap.ai screenshot style
const softGradientVertexShader = `
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

const softGradientFragmentShader = `
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
    
    // Very soft fresnel
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.5);
    
    // Ultra slow movement for calm effect
    float t = uTime * 0.05;
    
    // Large scale, smooth noise - no stripes, just soft clouds
    float noise1 = snoise(vPosition * 0.6 + vec3(t * 0.15, t * 0.12, -t * 0.1));
    float noise2 = snoise(vPosition * 0.9 + vec3(-t * 0.1, t * 0.18, t * 0.14));
    float noise3 = snoise(vPosition * 0.4 + vec3(t * 0.08, -t * 0.1, t * 0.12));
    
    // Very soft noise combination
    float pattern = noise1 * 0.4 + noise2 * 0.35 + noise3 * 0.25;
    pattern = pattern * 0.25 + 0.5; // Very narrow range for smooth gradient
    
    // Ultra smooth color blending - no bands
    vec3 gradient = mix(uColor1, uColor2, smoothstep(0.3, 0.7, pattern));
    gradient = mix(gradient, uColor3, smoothstep(0.5, 0.8, pattern) * 0.5);
    
    // Brighten overall for pastel look
    gradient = mix(gradient, vec3(1.0), 0.15);
    
    // Very subtle center glow
    float centerGlow = 1.0 - length(vPosition) * 0.05;
    gradient *= centerGlow;
    
    // Minimal fresnel
    gradient += vec3(1.0) * fresnel * 0.008;
    
    // High opacity, almost solid
    float alpha = 0.98 - fresnel * 0.03;
    
    gl_FragColor = vec4(gradient, alpha);
  }
`;

// Smooth gradient sphere
const SoftGradientSphere = memo(function SoftGradientSphere({ color }: { color: string }) {
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
    
    // Make colors more pastel
    return {
      color1: new THREE.Color(c1.r * 0.9 + 0.1, c1.g * 0.9 + 0.1, c1.b * 0.9 + 0.1),
      color2: new THREE.Color(c2.r * 0.85 + 0.15, c2.g * 0.85 + 0.15, c2.b * 0.85 + 0.15),
      color3: new THREE.Color(c3.r * 0.88 + 0.12, c3.g * 0.88 + 0.12, c3.b * 0.88 + 0.12),
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
      groupRef.current.position.y = Math.sin(t * 0.3) * 0.05;
      groupRef.current.rotation.y = t * 0.03;
    }
    
    // Slow rotation
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.08;
      coreRef.current.rotation.x = Math.sin(t * 0.15) * 0.05;
      
      // Very subtle breathing
      const breathe = 1 + Math.sin(t * 0.4) * 0.01;
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
      <mesh scale={0.88}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color={colors.color2}
          opacity={0.6}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main gradient core */}
      <mesh ref={coreRef} scale={0.95}>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={softGradientVertexShader}
          fragmentShader={softGradientFragmentShader}
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

      {/* Premium glass shell */}
      <mesh scale={1.0}>
        <sphereGeometry args={[1, 128, 128]} />
        <MeshTransmissionMaterial
          transmission={0.99}
          thickness={0.3}
          roughness={0.0}
          chromaticAberration={0.01}
          anisotropy={0.1}
          distortion={0.0}
          distortionScale={0.0}
          temporalDistortion={0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.0}
          ior={1.4}
          color="#ffffff"
          opacity={0.95}
          transparent
        />
      </mesh>

      {/* Very subtle outer glow */}
      <mesh scale={1.03}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          transparent
          opacity={0.08}
          color={colors.color1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

const EmotionOrbv2 = memo(function EmotionOrbv2({ 
  color, 
  size = 280, 
  className = '', 
  intensity = 1 
}: EmotionOrbv2Props) {
  console.log('🌸 EmotionOrbv2 Render:', { 
    color, 
    size, 
    intensity,
    timestamp: new Date().toISOString()
  });
  
  return (
    <div
      className={`emotion-orb-v2-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        position: 'relative',
      }}
    >
      <div
        className="emotion-orb-v2-container"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: `
            0 ${size * 0.08}px ${size * 0.22}px rgba(150, 160, 200, ${0.12 * intensity}),
            0 ${size * 0.04}px ${size * 0.15}px rgba(180, 190, 230, ${0.1 * intensity}),
            inset 0 ${size * 0.025}px ${size * 0.08}px rgba(255, 255, 255, ${0.5 * intensity})
          `,
          background: `
            radial-gradient(
              circle at 30% 30%,
              rgba(255, 255, 255, ${0.1 * intensity}) 0%,
              rgba(255, 255, 255, 0) 65%
            )
          `,
        }}
      >
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 3.6], fov: 35 }}
          gl={{ 
            antialias: true, 
            alpha: true, 
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.9,
          }}
        >
          {/* Soft ambient light */}
          <ambientLight intensity={0.5 * intensity} color="#fafbff" />
          
          {/* Gentle key light */}
          <directionalLight 
            position={[2, 3, 3]} 
            intensity={0.7 * intensity} 
            color="#ffffff" 
          />
          
          {/* Subtle back light */}
          <directionalLight 
            position={[-2, -1, -2.5]} 
            intensity={0.4 * intensity} 
            color="#d5ddff" 
          />
          
          {/* Soft fill light */}
          <pointLight 
            position={[0, 2, 2.5]} 
            intensity={0.3 * intensity} 
            color="#fff9f0" 
          />

          {/* Soft environment */}
          <Environment preset="sunset" />

          <SoftGradientSphere color={color} />
        </Canvas>
      </div>
      
      {/* Soft glass reflection */}
      <div
        className="emotion-orb-v2-reflection"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at 25% 22%,
              rgba(255, 255, 255, ${0.45 * intensity}) 0%,
              rgba(255, 255, 255, ${0.25 * intensity}) 15%,
              rgba(255, 255, 255, ${0.08 * intensity}) 30%,
              rgba(255, 255, 255, 0) 50%
            )
          `,
          pointerEvents: 'none',
        }}
      />
      
      {/* Subtle sparkle */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '15%',
          width: '25%',
          height: '25%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              circle at center,
              rgba(255, 255, 255, ${0.2 * intensity}) 0%,
              rgba(255, 255, 255, 0) 70%
            )
          `,
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />
      
      {/* Bottom soft shadow */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '18%',
          borderRadius: '50%',
          background: `
            radial-gradient(
              ellipse at center,
              rgba(120, 140, 190, ${0.15 * intensity}) 0%,
              rgba(120, 140, 190, 0) 70%
            )
          `,
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

export default EmotionOrbv2;

