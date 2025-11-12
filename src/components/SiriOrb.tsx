// src/components/SiriOrb.tsx
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import './EmotionOrbPremium.css'; // CSS 공유

/* ───────────── Siri 실크 리본 쉐이더 ───────────── */
const createSiriRibbonShader = (phase: number, color1: THREE.Color, color2: THREE.Color) => ({
  uniforms: {
    uTime: { value: 0 },
    uPhase: { value: phase },
    uColor1: { value: color1 },
    uColor2: { value: color2 },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uPhase;
    varying vec3 vPos;
    varying vec3 vNormal;

    void main() {
      vec3 pos = position;
      float t = uTime + uPhase;
      float wave = 0.0;

      // 💫 유체 파동 - 다중 위상 조합
      wave += sin(pos.x * 8.0 + t * 3.5) * 0.012;
      wave += sin(pos.y * 12.0 + t * 3.0 + uPhase * 0.7) * 0.011;
      wave += sin(pos.z * 7.0 + t * 3.8 + uPhase * 0.6) * 0.010;
      wave += sin((pos.x + pos.y) * 7.5 + t * 2.8 + uPhase * 1.0) * 0.009;
      wave += sin((pos.y + pos.z) * 9.0 + t * 3.2 + uPhase * 0.8) * 0.010;

      pos += normal * wave * 0.8;

      // 🔹 빠른 3D 움직임
      pos.z += sin(pos.x * 5.0 + uTime * 2.2 + uPhase) * 0.06;
      pos.x += cos(pos.y * 4.0 + uTime * 1.8 + uPhase * 0.7) * 0.04;
      pos.y += sin(pos.z * 3.0 + uTime * 2.0 + uPhase * 0.8) * 0.035;

      vPos = pos;
      vNormal = normalize(normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    varying vec3 vPos;
    varying vec3 vNormal;

    void main() {
      vec3 viewDir = normalize(vPos);
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.5);

      // 🎨 색상 위주, 실크 효과 최소화
      vec3 color = mix(uColor1, uColor2, smoothstep(-0.3, 0.7, vPos.y));
      color *= 2.9; // 색상 강도
      
      // 미세한 Fresnel 엣지 광택만
      color += fresnel * 0.2;

      // 중앙과 엣지 밝기로 입체감 표현
      float dist = length(vPos);
      float centerShade = pow(1.0 - smoothstep(0.0, 0.6, dist), 1.5);
      float edgeHighlight = pow(1.0 - smoothstep(0.4, 1.0, dist), 2.5);
      
      vec3 finalColor = color * (0.62 + centerShade * 0.12 + edgeHighlight * 0.75);

      // 아주 미세한 Rim 광택
      float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
      finalColor += color * rim * 0.12;

      gl_FragColor = vec4(finalColor, 0.90); // 약간 더 불투명
    }
  `,
});

/* ───────────── 내부 리본 ───────────── */
interface InnerSilkRibbonProps {
  phase: number;
  color1: string;
  color2: string;
  scale: number;
  speed: number;
  axis: [number, number, number];
}

const InnerSilkRibbon: React.FC<InnerSilkRibbonProps> = React.memo(({
  phase,
  color1,
  color2,
  scale,
  speed,
  axis,
}) => {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const shaderRef = useMemo(
    () => createSiriRibbonShader(phase, new THREE.Color(color1), new THREE.Color(color2)),
    [phase, color1, color2]
  );

  const rotationAxis = useMemo(() => new THREE.Vector3(...axis).normalize(), [axis]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (mat.current) mat.current.uniforms.uTime.value = t;
    if (mesh.current) {
      const rotSpeed = speed * 0.004; // 속도 증가
      mesh.current.rotateOnAxis(rotationAxis, rotSpeed);
      mesh.current.rotation.x += Math.sin(t * 0.8 + phase) * 0.003;
      mesh.current.rotation.y += Math.cos(t * 1.0 + phase * 0.5) * 0.003;
    }
  });

  return (
    <mesh ref={mesh} renderOrder={2}>
      <circleGeometry args={[0.95 * scale, 64]} />
      <shaderMaterial
        ref={mat}
        args={[shaderRef]}
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}  // 다시 AdditiveBlending으로 실크 광택 효과
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
});

/* ───────────── Glass Orb (미사용) ───────────── */
/*
interface GlassOrbProps {
  emotionColor: string;
}

const GlassOrb: React.FC<GlassOrbProps> = ({ emotionColor }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current && meshRef.current.material instanceof THREE.MeshPhysicalMaterial) {
      // 감정 색상을 기반으로 한 오로라 효과
      const baseColor = new THREE.Color(emotionColor);
      const hsl = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(hsl);
      
      // 시간에 따라 색조를 약간 변화시켜 오로라 효과
      const hue = (hsl.h + Math.sin(t * 0.3) * 0.08) % 1.0;
      const saturation = Math.min(hsl.s * 1.4, 1.0) + Math.sin(t * 0.4) * 0.08;
      const lightness = 0.25 + Math.sin(t * 0.25) * 0.08; // 더 어둡게 조정
      
      // HSL to RGB 변환으로 오로라 효과
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      meshRef.current.material.attenuationColor = color;
      
      // 투명도를 더 높여서 내부 리본 색상이 잘 보이도록
      meshRef.current.material.opacity = 0.18 + Math.sin(t * 0.3) * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} scale={0.58} renderOrder={3}>
      <sphereGeometry args={[1, 256, 256]} />
      <meshPhysicalMaterial
        transmission={0.85}  // 투과율 증가
        thickness={0.10}     // 두께 감소
        roughness={0.03}     
        clearcoat={0.55}     // 코팅 감소
        clearcoatRoughness={0.20}
        reflectivity={0.45}  
        ior={1.32}
        color={emotionColor}
        attenuationColor={emotionColor}
        attenuationDistance={1.4}
        transparent
        opacity={0.18}       // 불투명도 감소
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
};
*/

/* ───────────── Starburst Ray Shader (미사용) ───────────── */
/*
const starburstRayShader = {
  uniforms: {},
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    void main() {
      float dist = abs(vUv.x - 0.5) * 2.0;
      float alpha = 1.0 - smoothstep(0.0, 0.8, dist);
      float fadeOut = 1.0 - smoothstep(0.2, 1.0, vUv.y);
      vec3 color = vec3(1.0, 1.0, 1.0);
      gl_FragColor = vec4(color * alpha * fadeOut, alpha * fadeOut * 0.9);
    }
  `,
};
*/

/* ───────────── Starburst Ray (미사용) ───────────── */
/*
const StarburstRay: React.FC<{ angle: number; length: number; thickness?: number }> = ({ 
  angle, 
  length,
  thickness = 0.008 
}) => {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.z = angle;
    }
  });

  return (
    <mesh ref={mesh} renderOrder={0}>
      <planeGeometry args={[thickness, length, 1, 32]} />
      <shaderMaterial
        args={[starburstRayShader]}
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};
*/

/* ───────────── Starburst Light ───────────── */
interface StarburstLightProps {
  emotionColor: string;
}

const StarburstLight: React.FC<StarburstLightProps> = React.memo(({ emotionColor }) => {
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current && coreRef.current.material instanceof THREE.MeshStandardMaterial) {
      // 발광 효과 제거, 스케일 애니메이션만 유지
      coreRef.current.scale.setScalar(1 + Math.sin(t * 2.5) * 0.03);
    }
  });

  return (
    <group renderOrder={0}>
      {/* 중앙 코어 - 발광 효과 없이 순수 색상만 */}
      <mesh ref={coreRef} renderOrder={0}>
        <sphereGeometry args={[0.08, 64, 64]} />
        <meshStandardMaterial
          color={emotionColor}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
});

/* ───────────── Scene ───────────── */
interface SiriOrbProps {
  color?: string;  // 감정 색상
  intensity?: number;
  size?: number;  // 오브 크기
  className?: string;  // CSS 클래스
  analyzing?: boolean;  // 감정 분석 중 상태
  showCompleted?: boolean;  // 진단 완료 표시
  messageCount?: number;  // 메시지 개수 (진단중 텍스트 표시 여부)
}

export default React.memo(function SiriOrb({ 
  color = '#9d00ff', 
  intensity = 1,
  size = 400,
  className = '',
  analyzing = false,
  showCompleted = false,
  messageCount = 0
}: SiriOrbProps) {
  // 색상을 HSL로 변환하여 보색과 유사색 생성
  const colors = useMemo(() => {
    const baseColor = new THREE.Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    
    // 채도를 높이고 밝기를 낮춰서 색상이 더 선명하게 보이도록 조정
    const enhancedSaturation = Math.min(hsl.s * 1.4, 1.0); // 채도 40% 증가
    const reducedLightness = Math.max(hsl.l * 0.45, 0.25); // 밝기 55% 감소 (최소 0.25)
    
    // 8가지 색상 변형 생성 (더 진하고 선명하게)
    return [
      new THREE.Color().setHSL(hsl.h, enhancedSaturation * 0.9, reducedLightness * 0.85).getStyle(),
      new THREE.Color().setHSL((hsl.h + 0.08) % 1, enhancedSaturation * 0.95, reducedLightness * 0.9).getStyle(),
      new THREE.Color().setHSL((hsl.h + 0.12) % 1, enhancedSaturation, reducedLightness).getStyle(),
      new THREE.Color().setHSL((hsl.h - 0.08 + 1) % 1, enhancedSaturation * 0.85, reducedLightness * 0.95).getStyle(),
      new THREE.Color().setHSL(hsl.h, enhancedSaturation * 1.05, reducedLightness * 1.05).getStyle(),
      new THREE.Color().setHSL((hsl.h + 0.15) % 1, enhancedSaturation * 0.95, reducedLightness * 0.92).getStyle(),
      new THREE.Color().setHSL((hsl.h - 0.12 + 1) % 1, enhancedSaturation * 0.88, reducedLightness * 0.88).getStyle(),
      new THREE.Color().setHSL((hsl.h + 0.05) % 1, enhancedSaturation, reducedLightness * 0.93).getStyle(),
    ];
  }, [color]);

  // 보색 계산 (180도 반대) - 마찬가지로 선명하게
  const complementaryColors = useMemo(() => {
    const baseColor = new THREE.Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    const enhancedSaturation = Math.min(hsl.s * 1.4, 1.0);
    const reducedLightness = Math.max(hsl.l * 0.45, 0.25);
    const complementaryHue = (hsl.h + 0.5) % 1;
    
    return colors.map((_, i) => 
      new THREE.Color().setHSL(
        (complementaryHue + (i * 0.05)) % 1, 
        enhancedSaturation * 0.9, 
        reducedLightness * 0.9
      ).getStyle()
    );
  }, [color, colors]);

  return (
    <div
      className={`siri-orb-container ${className}`}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        minHeight: `${size}px`,
      }}
    >
      <div
        className="stage"
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
          overflow: "hidden",
          borderRadius: '50%',
        }}
      >
        <Canvas 
          camera={{ position: [0, 0, 2.8], fov: 35 }}
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.04 * intensity} />
          <directionalLight position={[5, 5, 5]} intensity={0.10 * intensity} color="#ffffff" />

          <StarburstLight emotionColor={color} />

          {/* 🎨 감정 색상 기반 리본 */}
          <InnerSilkRibbon phase={0.0} color1={colors[0]} color2={complementaryColors[0]} scale={0.56} speed={analyzing ? 3.6 : 2.4} axis={[1, 0.5, 0.2]} />
          <InnerSilkRibbon phase={0.9} color1={colors[1]} color2={complementaryColors[1]} scale={0.54} speed={analyzing ? 4.8 : 3.2} axis={[0.3, 1, 0.4]} />
          <InnerSilkRibbon phase={1.8} color1={colors[2]} color2={complementaryColors[2]} scale={0.52} speed={analyzing ? 4.2 : 2.8} axis={[0.4, 0.2, 1]} />
          <InnerSilkRibbon phase={2.7} color1={colors[3]} color2={complementaryColors[3]} scale={0.50} speed={analyzing ? 5.4 : 3.6} axis={[1, 0.3, 0.7]} />
          <InnerSilkRibbon phase={3.6} color1={colors[4]} color2={complementaryColors[4]} scale={0.48} speed={analyzing ? 4.5 : 3.0} axis={[0.5, 0.8, 0.3]} />
          <InnerSilkRibbon phase={4.5} color1={colors[5]} color2={complementaryColors[5]} scale={0.46} speed={analyzing ? 5.1 : 3.4} axis={[0.7, 0.4, 0.9]} />
          <InnerSilkRibbon phase={5.4} color1={colors[6]} color2={complementaryColors[6]} scale={0.44} speed={analyzing ? 3.9 : 2.6} axis={[0.6, 0.7, 0.5]} />
          <InnerSilkRibbon phase={6.3} color1={colors[7]} color2={complementaryColors[7]} scale={0.42} speed={analyzing ? 5.7 : 3.8} axis={[0.8, 0.3, 0.6]} />

          {/* GlassOrb 제거 - 실크 리본만 표시 */}
        </Canvas>
      </div>

      {/* 진단중 텍스트 */}
      {analyzing && messageCount >= 1 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: size * 0.08,
            fontWeight: 700,
            color: '#fff',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            animation: 'analyzing-pulse 1.5s ease-in-out infinite',
          }}
        >
          진단중
          <span style={{ animation: 'dots 1.5s steps(4, end) infinite' }}>...</span>
        </div>
      )}

      {/* 진단 완료 텍스트 */}
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
