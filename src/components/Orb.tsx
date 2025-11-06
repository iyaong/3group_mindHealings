// src/components/SiriOrb.tsx
import { useRef, useMemo } from "react";
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
    uColor3: { value: new THREE.Color("#00ffff") },
    uColor4: { value: new THREE.Color("#ff9d4d") },
    uColor5: { value: new THREE.Color("#b47dff") },
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

      // 💫 유체 파동 - 로딩 중 더 빠르게
      wave += sin(pos.x * 10.0 + t * 3.5) * 0.018;
      wave += sin(pos.y * 14.0 + t * 3.0 + uPhase * 0.8) * 0.017;
      wave += sin(pos.z * 8.0 + t * 3.8 + uPhase * 0.5) * 0.016;
      wave += sin((pos.x + pos.y) * 9.0 + t * 2.8 + uPhase * 1.1) * 0.014;
      wave += sin((pos.y + pos.z) * 11.0 + t * 3.2 + uPhase * 0.9) * 0.015;

      pos += normal * wave * 1.1;

      // 🔹 깊이감 및 3D 요동 - 더 역동적으로
      pos.z += sin(pos.x * 6.0 + uTime * 2.2 + uPhase) * 0.09;
      pos.x += cos(pos.y * 4.5 + uTime * 1.8 + uPhase * 0.6) * 0.07;
      pos.y += sin(pos.z * 3.5 + uTime * 2.0 + uPhase * 0.9) * 0.06;

      vPos = pos;
      vNormal = normalize(normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uPhase;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform vec3 uColor5;
    varying vec3 vPos;
    varying vec3 vNormal;

    void main() {
      vec3 viewDir = normalize(vPos);
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);

      // 🌈 다이나믹 색상 순환 (5색)
      float colorTime = uTime * 0.5 + uPhase;
      float colorCycle = mod(colorTime, 5.0);
      
      vec3 color;
      if (colorCycle < 1.0) {
        color = mix(uColor1, uColor2, fract(colorCycle));
      } else if (colorCycle < 2.0) {
        color = mix(uColor2, uColor3, fract(colorCycle));
      } else if (colorCycle < 3.0) {
        color = mix(uColor3, uColor4, fract(colorCycle));
      } else if (colorCycle < 4.0) {
        color = mix(uColor4, uColor5, fract(colorCycle));
      } else {
        color = mix(uColor5, uColor1, fract(colorCycle));
      }
      
      // Y축 그라데이션 추가
      vec3 gradColor = mix(color, uColor3, smoothstep(-0.4, 0.6, vPos.y) * 0.3);
      
      gradColor += fresnel * 0.7;

      float glow = pow(1.0 - smoothstep(0.2, 1.1, length(vPos)), 3.0);
      vec3 finalColor = gradColor * (1.0 + glow * 2.2);

      // 시간에 따라 변하는 림 라이트 (더 밝게)
      vec3 rimColor = mix(vec3(1.0, 0.9, 1.0), vec3(0.9, 1.0, 1.0), sin(uTime * 0.8 + uPhase) * 0.5 + 0.5);
      float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
      finalColor += rimColor * rim * 0.6;

      gl_FragColor = vec4(finalColor, 0.93);
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
      const rotSpeed = speed * 0.0030;  // 회전 속도 67% 증가
      mesh.current.rotateOnAxis(rotationAxis, rotSpeed);
      mesh.current.rotation.x += Math.sin(t * 0.5 + phase) * 0.002;
      mesh.current.rotation.y += Math.cos(t * 0.6 + phase * 0.5) * 0.002;
    }
  });

  return (
    <mesh ref={mesh} scale={scale} renderOrder={1}>
      <sphereGeometry args={[1, 256, 256]} />
      <shaderMaterial
        ref={mat}
        args={[shaderRef]}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
};

/* ───────────── Glass Orb ───────────── */
const GlassOrb: React.FC = () => (
  <mesh scale={0.56} renderOrder={3}>
    <sphereGeometry args={[1, 290, 290]} />
    <meshPhysicalMaterial
      transmission={0.5}
      thickness={0.08}
      roughness={0.02}
      clearcoat={0.5}
      clearcoatRoughness={0.1}
      reflectivity={0.5}
      ior={1.0}
      color="#44444441"
      attenuationColor="#3535357b"
      attenuationDistance={1.0}
      transparent
      opacity={0.005}
      side={THREE.FrontSide}
      depthWrite={false}
    />
  </mesh>
);

/* ───────────── Scene ───────────── */
export default function SiriOrb() {
  return (
    <div
      className="stage"
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        overflow: "hidden",
      }}
    >
      <Canvas 
        camera={{ position: [0, 0, 3.5], fov: 21 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 5, 5]} intensity={0.7} color="#ffffff" />
        <pointLight position={[0, 0, 0]} intensity={3.0} color="#ffffff" distance={4} />

        {/* 🎨 선명한 색상 리본 조합 */}
        <InnerSilkRibbon
          phase={0.0}
          color1="#ffeb3b"
          color2="#ff4db8"
          scale={0.4}
          speed={2.5}
          axis={[1, 0.5, 0.2]}
        />
        <InnerSilkRibbon
          phase={1.2}
          color1="#4cff88"
          color2="#4d9eff"
          scale={0.38}
          speed={3.2}
          axis={[0.3, 1, 0.4]}
        />
        <InnerSilkRibbon
          phase={2.5}
          color1="#ff9d4d"
          color2="#00ffff"
          scale={0.36}
          speed={2.8}
          axis={[0.4, 0.2, 1]}
        />
        <InnerSilkRibbon
          phase={3.8}
          color1="#ff6b9d"
          color2="#b47dff"
          scale={0.34}
          speed={3.5}
          axis={[1, 0.3, 0.7]}
        />

        <GlassOrb />

        <EffectComposer>
          <Bloom
            intensity={0}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.8}
            radius={0.2}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
