// src/components/SiriOrb.tsx
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

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

      // 🎨 색감 강화 - 하얗지 않게
      vec3 color = mix(uColor1, uColor2, smoothstep(-0.3, 0.7, vPos.y));
      color *= 2.0; // 색상 강도 대폭 증가
      
      // Fresnel로 엣지 강조
      color += fresnel * 0.3;

      // 중앙은 덜 밝게, 엣지는 더 밝게
      float dist = length(vPos);
      float centerGlow = pow(1.0 - smoothstep(0.0, 0.6, dist), 1.5);
      float edgeGlow = pow(1.0 - smoothstep(0.4, 1.0, dist), 2.5);
      
      vec3 finalColor = color * (0.8 + centerGlow * 0.2 + edgeGlow * 1.0);

      // Rim으로 입체감
      float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
      finalColor += color * rim * 0.2;

      gl_FragColor = vec4(finalColor, 0.9);
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

const InnerSilkRibbon: React.FC<InnerSilkRibbonProps> = ({
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

  const rotationAxis = new THREE.Vector3(...axis).normalize();

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
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
};

/* ───────────── Glass Orb ───────────── */
const GlassOrb: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current && meshRef.current.material instanceof THREE.MeshPhysicalMaterial) {
      // 오로라 색상 변화 (부드럽게 순환)
      const hue = (t * 0.08) % 1.0; // 천천히 색상 순환
      const saturation = 0.7 + Math.sin(t * 0.4) * 0.2;
      const lightness = 0.65 + Math.sin(t * 0.25) * 0.15;
      
      // HSL to RGB 변환으로 오로라 효과
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      meshRef.current.material.attenuationColor = color;
      
      // 살짝 투명도도 변화
      meshRef.current.material.opacity = 0.12 + Math.sin(t * 0.3) * 0.03;
    }
  });

  return (
    <mesh ref={meshRef} scale={0.58} renderOrder={3}>
      <sphereGeometry args={[1, 256, 256]} />
      <meshPhysicalMaterial
        transmission={0.85}
        thickness={0.1}
        roughness={0.03}
        clearcoat={1}
        clearcoatRoughness={0.08}
        reflectivity={0.9}
        ior={1.4}
        color="#ffffff"
        attenuationColor="#c8b8ff"
        attenuationDistance={2.5}
        transparent
        opacity={0.12}
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
};

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
const StarburstLight: React.FC = () => {
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current && coreRef.current.material instanceof THREE.MeshStandardMaterial) {
      coreRef.current.material.emissiveIntensity = 0.1 + Math.sin(t * 4.0) * 0.05;
      coreRef.current.scale.setScalar(1 + Math.sin(t * 2.5) * 0.03);
    }
  });

  return (
    <group renderOrder={0}>
      {/* 중앙 코어 - 더 어둡게 */}
      <mesh ref={coreRef} renderOrder={0}>
        <sphereGeometry args={[0.08, 64, 64]} />
        <meshStandardMaterial
          emissive="#c8b0ff"
          color="#f0e0ff"
          emissiveIntensity={0.1}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
};

/* ───────────── Scene ───────────── */
export default function SiriOrb() {
  return (
    <div
      className="stage"
      style={{
        width: "100%",
        height: "100%",
        minHeight: "600px",
        background: "radial-gradient(circle at center, #0a0814 0%, #050509 50%, #000 100%)",
        overflow: "hidden",
      }}
    >
      <Canvas camera={{ position: [0, 0, 2.8], fov: 40 }}>
        <ambientLight intensity={0.08} />
        <directionalLight position={[5, 5, 5]} intensity={0.2} color="#ffffff" />

        <StarburstLight />

        {/* 🎨 색감 강화 - 진한 색상 */}
        <InnerSilkRibbon phase={0.0} color1="#ff0077" color2="#9d00ff" scale={0.56} speed={2.4} axis={[1, 0.5, 0.2]} />
        <InnerSilkRibbon phase={0.9} color1="#00ff99" color2="#00e5ff" scale={0.54} speed={3.2} axis={[0.3, 1, 0.4]} />
        <InnerSilkRibbon phase={1.8} color1="#ff6600" color2="#ff0055" scale={0.52} speed={2.8} axis={[0.4, 0.2, 1]} />
        <InnerSilkRibbon phase={2.7} color1="#4488ff" color2="#9d00ff" scale={0.50} speed={3.6} axis={[1, 0.3, 0.7]} />
        <InnerSilkRibbon phase={3.6} color1="#dd55ff" color2="#00ff77" scale={0.48} speed={3.0} axis={[0.5, 0.8, 0.3]} />
        <InnerSilkRibbon phase={4.5} color1="#00ddff" color2="#ff0088" scale={0.46} speed={3.4} axis={[0.7, 0.4, 0.9]} />
        <InnerSilkRibbon phase={5.4} color1="#ff00ff" color2="#00ffaa" scale={0.44} speed={2.6} axis={[0.6, 0.7, 0.5]} />
        <InnerSilkRibbon phase={6.3} color1="#ffbb00" color2="#5588ff" scale={0.42} speed={3.8} axis={[0.8, 0.3, 0.6]} />

        <GlassOrb />

        <EffectComposer>
          <Bloom
            intensity={0.2}
            luminanceThreshold={0.75}
            luminanceSmoothing={0.95}
            radius={0.45}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
