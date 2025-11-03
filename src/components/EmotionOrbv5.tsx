import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { hexToRgb, paletteFromBase } from '../utils/colorUtils';

// EmotionOrbv5 — minitap.ai 스타일: Three.js + R3F + drei + GLSL + HDRI + Postprocessing + GSAP
// - 내부: 커스텀 GLSL 그라데이션(오로라 느낌)
// - 외부: MeshTransmissionMaterial 유리 껍질
// - 환경: drei Environment (PMREM 기반 HDRI)
// - 후처리: Bloom + ChromaticAberration
// - 애니메이션: GSAP 타임라인으로 부드러운 플로팅/회전/쉐이더 파동

type EmotionOrbv5Props = {
	color: string;
	size?: number;
	className?: string;
	intensity?: number; // 조명/효과 강도와 iridescence 정도를 함께 조절
};

const vertexShader = `
	varying vec3 vPos;
	varying vec3 vNormal;
	varying vec2 vUv;
	varying vec3 vWorld;
	void main(){
		vPos = position;
		vNormal = normalize(normalMatrix * normal);
		vUv = uv;
		vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const fragmentShader = `
	uniform float uTime;
	uniform float uPulse;        // gsap로 변조되는 파동 강도
	uniform vec3 uC1;            // 파스텔 팔레트 1
	uniform vec3 uC2;            // 파스텔 팔레트 2
	uniform vec3 uC3;            // 파스텔 팔레트 3
	varying vec3 vPos;
	varying vec3 vNormal;
	varying vec2 vUv;
	varying vec3 vWorld;

	// simplex noise (3D)
	vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
	vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
	vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);} 
	vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
	float snoise(vec3 v){
		const vec2 C=vec2(1.0/6.0,1.0/3.0);
		const vec4 D=vec4(0.0,0.5,1.0,2.0);
		vec3 i=floor(v+dot(v,C.yyy));
		vec3 x0=v-i+dot(i,C.xxx);
		vec3 g=step(x0.yzx,x0.xyz);
		vec3 l=1.0-g;
		vec3 i1=min(g.xyz,l.zxy);
		vec3 i2=max(g.xyz,l.zxy);
		vec3 x1=x0-i1+C.xxx;
		vec3 x2=x0-i2+C.yyy;
		vec3 x3=x0-D.yyy;
		i=mod289(i);
		vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
		float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
		vec4 j=p-49.0*floor(p*ns.z*ns.z);
		vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
		vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;
		vec4 h=1.0-abs(x)-abs(y);
		vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
		vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
		vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
		vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
		vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
		p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
		vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
		m=m*m; return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
	}

	void main(){
		vec3 N = normalize(vNormal);
		vec3 V = normalize(vec3(0.0,0.0,1.0));
		float fresnel = pow(1.0 - max(dot(N,V),0.0), 2.8);

		float t = uTime * 0.22;                     // 기본 속도
		// 세계 좌표를 사용해 UV 경계 이슈 제거
		vec3 P = vWorld;
		float vertical = snoise(vec3(P.x*0.15, P.y*2.4 + t*1.1*uPulse, P.z*0.15));
		float cloudA   = snoise(P*0.55 + vec3(t*0.35, t*0.22, -t*0.18));
		float cloudB   = snoise(P*0.32 + vec3(-t*0.2, t*0.28, t*0.25));
		float pattern  = vertical*0.55 + cloudA*0.3 + cloudB*0.15;
		pattern = clamp(pattern*0.45 + 0.5, 0.0, 1.0);

		// 밴딩 없는 부드러운 색 혼합(바리센트릭 가중치)
		float a = pattern;
		float w1 = (1.0 - a); w1 *= w1;
		float w3 = a * a;
		float w2 = max(0.0, 1.0 - w1 - w3);
		vec3 col = uC1*w1 + uC2*w2 + uC3*w3;
		col     = mix(col, vec3(1.0), 0.12);        // 파스텔 톤

		// 가장자리 리무브 가볍게
		col += vec3(1.0) * fresnel * 0.012;
		float alpha = 0.96 - fresnel*0.04;
		gl_FragColor = vec4(col, alpha);
	}
`;

const LiquidCore = memo(function LiquidCore({ color, intensity }: { color: string; intensity: number }) {
	const groupRef = useRef<THREE.Group>(null);
	const coreRef = useRef<THREE.Mesh>(null);
	const materialRef = useRef<THREE.ShaderMaterial>(null);
	const pulseRef = useRef({ value: 1 });

	const palette = useMemo(() => paletteFromBase(color), [color]);
	const colors = useMemo(() => {
		const { c1, c2, c3 } = {
			c1: hexToRgb(palette.c1),
			c2: hexToRgb(palette.c2),
			c3: hexToRgb(palette.c3),
		};
		return {
			c1: new THREE.Color(c1.r * 0.9 + 0.1, c1.g * 0.9 + 0.1, c1.b * 0.9 + 0.1),
			c2: new THREE.Color(c2.r * 0.88 + 0.12, c2.g * 0.88 + 0.12, c2.b * 0.88 + 0.12),
			c3: new THREE.Color(c3.r * 0.92 + 0.08, c3.g * 0.92 + 0.08, c3.b * 0.92 + 0.08),
		};
	}, [palette]);

	useEffect(() => {
		// GSAP: 파동 강도(uPulse)와 그룹 모션을 부드럽게 루프
		const tl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } });
		tl.to(pulseRef.current, { value: 1.6, duration: 4.2 })
			.to(pulseRef.current, { value: 0.8, duration: 3.8 });
		if (groupRef.current) {
			gsap.to(groupRef.current.rotation, { y: '+=6.283', duration: 80, ease: 'none', repeat: -1 }); // 360° 천천히
			gsap.to(groupRef.current.position, { y: 0.06, duration: 3.5, yoyo: true, repeat: -1 });
		}
		return () => { tl.kill(); };
	}, []);

	useFrame(({ clock }) => {
		const t = clock.getElapsedTime();
		if (materialRef.current) {
			materialRef.current.uniforms.uTime.value = t;
			materialRef.current.uniforms.uPulse.value = pulseRef.current.value;
		}
	});

	return (
		<group ref={groupRef}>
			{/* Inner glow */}
			<mesh scale={0.88}>
				<sphereGeometry args={[1, 64, 64]} />
				<meshBasicMaterial
					color={colors.c2}
					opacity={0.55}
					transparent
					blending={THREE.AdditiveBlending}
					depthWrite={false}
				/>
			</mesh>

			{/* Shader core */}
			<mesh ref={coreRef} scale={0.95}>
				<sphereGeometry args={[1, 128, 128]} />
				<shaderMaterial
					ref={materialRef}
					vertexShader={vertexShader}
					fragmentShader={fragmentShader}
					uniforms={{
						uTime: { value: 0 },
						uPulse: { value: 1 },
						uC1: { value: colors.c1.clone() },
						uC2: { value: colors.c2.clone() },
						uC3: { value: colors.c3.clone() },
					}}
					transparent
					depthWrite={false}
					side={THREE.DoubleSide}
				/>
			</mesh>

			{/* Glass shell */}
			<mesh scale={1.0}>
				<sphereGeometry args={[1, 128, 128]} />
				<MeshTransmissionMaterial
					transmission={0.985}
					thickness={0.42}
					roughness={0.02}
					chromaticAberration={0.012}
					anisotropy={0.12}
					clearcoat={1}
					clearcoatRoughness={0.03}
					ior={1.45}
					color="#ffffff"
					opacity={0.9}
					transparent
				/>
			</mesh>
		</group>
	);
});

const EmotionOrbv5 = memo(function EmotionOrbv5({ color, size = 280, className = '', intensity = 1 }: EmotionOrbv5Props) {
	return (
		<div
			className={`emotion-orb-v5-wrapper ${className}`}
			style={{ width: size, height: size, display: 'inline-block', position: 'relative' }}
		>
			<div
				className="emotion-orb-v5-container"
				style={{
					width: '100%',
					height: '100%',
					borderRadius: '50%',
					overflow: 'hidden',
					position: 'relative',
					boxShadow: `
						0 ${size * 0.09}px ${size * 0.24}px rgba(150,170,220,${0.14 * intensity}),
						0 ${size * 0.045}px ${size * 0.17}px rgba(180,195,240,${0.11 * intensity}),
						inset 0 ${size * 0.028}px ${size * 0.09}px rgba(255,255,255,${0.55 * intensity})
					`,
					background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,${0.12 * intensity}) 0%, rgba(255,255,255,0) 68%)`,
				}}
			>
				<Canvas
					dpr={[1, 2]}
					camera={{ position: [0, 0, 3.5], fov: 36 }}
					gl={{
						antialias: true,
						alpha: true,
						powerPreference: 'high-performance',
						// PMREM 톤매핑 세팅
						// @ts-ignore
						toneMapping: THREE.ACESFilmicToneMapping,
						toneMappingExposure: 0.95,
					}}
				>
					{/* Lighting */}
					<ambientLight intensity={0.48 * intensity} color="#fbfcff" />
					<directionalLight position={[2.6, 3.2, 3.2]} intensity={0.76 * intensity} color="#ffffff" />
					<directionalLight position={[-2.0, -1.2, -2.6]} intensity={0.42 * intensity} color="#d8e2ff" />
					<pointLight position={[0, 2.1, 2.7]} intensity={0.3 * intensity} color="#fffaf2" />

					{/* Environment (PMREM 기반) */}
		<Environment preset="night" />

					<LiquidCore color={color} intensity={intensity} />

					{/* Post-processing */}
					<EffectComposer>
						<Bloom intensity={0.58 * intensity} luminanceThreshold={0.25} luminanceSmoothing={0.84} height={280} />
						<ChromaticAberration offset={[0.0007, 0.0007]} />
					</EffectComposer>
				</Canvas>
			</div>

			{/* Glass reflection overlay */}
			<div
				style={{
					position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%',
					background: `radial-gradient(circle at 26% 24%, rgba(255,255,255,${0.46 * intensity}) 0%, rgba(255,255,255,${0.26 * intensity}) 14%, rgba(255,255,255,${0.1 * intensity}) 28%, rgba(255,255,255,0) 48%)`,
					pointerEvents: 'none'
				}}
			/>

			{/* Bottom shadow */}
			<div
				style={{
					position: 'absolute', bottom: '7%', left: '50%', transform: 'translateX(-50%)', width: '62%', height: '20%', borderRadius: '50%',
					background: `radial-gradient(ellipse at center, rgba(125,145,195,${0.17 * intensity}) 0%, rgba(125,145,195,0) 72%)`,
					filter: 'blur(12px)', pointerEvents: 'none'
				}}
			/>
		</div>
	);
});

export default EmotionOrbv5;
