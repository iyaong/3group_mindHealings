import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

function hexToRgb(hex: string) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return { r, g, b };
}
function hexToHsl(hex: string) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h/60) % 2) - 1));
  const m = l - c/2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function paletteFromBase(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  const c1 = hslToHex(h, Math.min(100, s * 1.0), Math.min(90, l * 1.05));
  const c2 = hslToHex((h + 300) % 360, Math.min(100, s * 0.8), Math.max(20, l * 0.9));
  const c3 = hslToHex((h + 60) % 360, Math.min(100, s * 0.9), Math.min(85, l * 1.0));
  return { c1, c2, c3 };
}

const VERTEX = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Photographic soft gradient without conic seams: multi-blob blend + subtle spherical light
const FRAGMENT = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_waveAmp;
  uniform float u_waveFreq;
  uniform float u_waveSpeed;
  uniform vec2 u_resolution;
  uniform vec3 u_c1;
  uniform vec3 u_c2;
  uniform vec3 u_c3;
  uniform float u_pulseMin;
  uniform float u_pulseMax;

  float hash(vec2 p){
    vec2 q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    float h = dot(q, vec2(1.0, 1.0));
    return -1.0 + 2.0 * fract(sin(h) * 43758.5453123);
  }
  float noise(in vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    float x1 = mix(a, b, u.x);
    float x2 = mix(c, d, u.x);
    float n = mix(x1, x2, u.y);
    return 0.5 + 0.5 * n;
  }

  float gauss(float d, float k){
    // Approximate Gaussian lobe; k controls sharpness
    return exp(-k * d * d);
  }

  void main(){
    // Map uv to [-1,1] and maintain aspect
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    float t = u_time;
    // Pulse scale
    float s = mix(u_pulseMin, u_pulseMax, 0.5 + 0.5 * sin(t * 0.6));
    uv /= s;
    uv *= 0.96; // small inset to avoid edge clipping

    float r = length(uv);
  float backScale = 1.36;

  // Wavy / ragged rim: perturb outer radius by angle-based waves + small noise
  float angle = atan(uv.y, uv.x);
  float wave = sin(angle * u_waveFreq + t * u_waveSpeed) * u_waveAmp;
  float nWave = (noise(uv * 6.0 + vec2(t * 0.12)) - 0.5) * u_waveAmp * 0.8;
  float r2 = r + wave + nWave * smoothstep(0.6, 1.2, r);
  // use r2 for rim/halo computations; clip by r (conservative) so interior rendering unaffected
  if (r > backScale) discard; // allow rendering out to backScale for halo

    // Base vertical gradient blend (no angle-based seams)
    float v = smoothstep(-0.9, 0.9, uv.y);
    vec3 base = mix(u_c1, u_c2, v);
    // Reduce center bias to avoid strong bloom
    float center = smoothstep(0.95, 0.0, r);
    base = mix(base, u_c3, 0.18 * center);

    // Add soft Gaussian lobes for photographic depth
    vec2 p1 = uv;
    vec2 p2 = uv - vec2(-0.28, 0.12);
    vec2 p3 = uv - vec2(0.34, 0.30);
    float g1 = gauss(length(p1), 3.2);
    float g2 = gauss(length(p2), 6.0);
    float g3 = gauss(length(p3), 8.0);

    vec3 col = base;
  col += vec3(1.0) * g1 * 0.05;        // soften white core (slightly reduced)
    col += u_c2 * g2 * 0.38;             // reduce tinted lobe
    col += u_c3 * g3 * 0.32;             // reduce secondary tint

  // Subtle spherical lighting (no specular to avoid gloss)
  float z = sqrt(max(1.0 - r*r, 0.0));
  vec3 N = normalize(vec3(uv, z));
  vec3 L = normalize(vec3(-0.22, 0.58, 0.78));
  // Flatten lighting to avoid glossy highlight; gently dim toward rim
  col *= (0.98 - 0.08 * r);

  // Soft edge glow near the circular boundary
  float rim = smoothstep(0.88, 1.0, r);
  vec3 rimCol = mix((u_c1 + u_c2 + u_c3) / 3.0, vec3(1.0), 0.2);
  col += rimCol * pow(rim, 1.4) * 0.10;

  // Fine grain to reduce banding (additive, very subtle)
  float gn = noise(uv * 2.6 + vec2(sin(t*0.045), cos(t*0.037)) * 0.22);
  col += (gn - 0.5) * 0.02;

  // Gentle saturation and gamma
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 1.22);
  col = pow(max(col, 0.0), vec3(0.96));

  // --- noisy halo (soft border) ---
  // inner rim presence (narrower to emphasize ring) - use perturbed radius for organic edge
  float innerEdge = smoothstep(0.92, 0.995, r2);
  // outer falloff from rim to backScale
  float outerEdge = 1.0 - smoothstep(1.0, backScale, r2);
  // layered noise for organic edge
  float hn1 = noise(uv * 4.2 + vec2(t * 0.06));
  float hn2 = noise(uv * 11.0 + vec2(t * 0.03));
  float hNoise = mix(hn1, hn2, 0.45);
  // emphasize inner rim with power and stronger noise influence
  float haloMask = pow(innerEdge, 2.5) * outerEdge * (0.6 + 0.6 * hNoise);
  vec3 haloColor = (u_c1 + u_c2 + u_c3) / 3.0;
  haloColor *= mix(0.92, 1.08, hNoise);

  // combine main orb and halo
  float mainAlpha = 1.0 - innerEdge * 0.18; // slightly stronger rim fade
  float haloAlpha = clamp(haloMask * 1.6, 0.0, 1.0);
  vec3 finalCol = col * mainAlpha + haloColor * haloAlpha;
  float finalA = clamp(mainAlpha + haloAlpha * 0.6, 0.0, 1.0);
  gl_FragColor = vec4(finalCol, finalA);
  }
`;

export default function AuroraThree({
  color,
  size = 260,
  className = '',
  animate = true,
  onReady,
}: {
  color: string;
  size?: number;
  className?: string;
  animate?: boolean;
  onReady?: () => void;
}){
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const uniformsRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const colors = useMemo(() => {
    const { c1, c2, c3 } = paletteFromBase(color);
    return { c1: hexToRgb(c1), c2: hexToRgb(c2), c3: hexToRgb(c3) };
  }, [color]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect reduced motion or explicit no-anim class
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = animate && !reduceMotion && !className.includes('no-anim');

    // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(size, size) },
      u_c1: { value: new THREE.Color(colors.c1.r, colors.c1.g, colors.c1.b) },
      u_c2: { value: new THREE.Color(colors.c2.r, colors.c2.g, colors.c2.b) },
      u_c3: { value: new THREE.Color(colors.c3.r, colors.c3.g, colors.c3.b) },
      u_pulseMin: { value: 1.00 },
      u_pulseMax: { value: 1.08 },
    };
  // uniforms를 ref에 저장해 prop 변경(useEffect) 시 색상/해상도 갱신이 가능하도록 함
  uniformsRef.current = uniforms;
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: THREE.NormalBlending,
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);

  // --- Post-processing setup: render target, blur passes, composite ---
  const rtScene = new THREE.WebGLRenderTarget(size, size, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
  const rtPing = rtScene.clone();
  const rtPong = rtScene.clone();

  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new THREE.PlaneGeometry(2, 2);

    const POST_VERTEX = /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
    `;

    const BLUR_FRAGMENT = /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform vec2 u_resolution;
      uniform vec2 u_dir;

      void main(){
        vec2 texel = 1.0 / u_resolution;
        vec3 result = vec3(0.0);
        float w0 = 0.2270270270;
        float w1 = 0.3162162162;
        float w2 = 0.0702702703;
        result += texture2D(tDiffuse, vUv).rgb * w0;
        result += texture2D(tDiffuse, vUv + texel * u_dir * 1.3846153846).rgb * w1;
        result += texture2D(tDiffuse, vUv - texel * u_dir * 1.3846153846).rgb * w1;
        result += texture2D(tDiffuse, vUv + texel * u_dir * 3.2307692308).rgb * w2;
        result += texture2D(tDiffuse, vUv - texel * u_dir * 3.2307692308).rgb * w2;
        gl_FragColor = vec4(result, 1.0);
      }
    `;

    const COMPOSITE_FRAGMENT = /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tBase;
      uniform sampler2D tBlur;
      uniform float u_bloomIntensity;
      void main(){
        vec3 base = texture2D(tBase, vUv).rgb;
        vec3 blur = texture2D(tBlur, vUv).rgb;
        vec3 col = base + blur * u_bloomIntensity; // additive bloom
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const blurMaterialH = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        u_resolution: { value: new THREE.Vector2(size, size) },
        u_dir: { value: new THREE.Vector2(1.0, 0.0) },
      },
      vertexShader: POST_VERTEX,
      fragmentShader: BLUR_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
  const blurMaterialV = blurMaterialH.clone();
  blurMaterialV.uniforms = THREE.UniformsUtils.clone(blurMaterialH.uniforms);
  blurMaterialV.uniforms.u_dir.value = new THREE.Vector2(0.0, 1.0);

    const compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tBlur: { value: null },
        u_bloomIntensity: { value: 0.4 },
      },
      vertexShader: POST_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });

  const quad = new THREE.Mesh(fsGeo, blurMaterialH);
  postScene.add(quad);
  const compositeScene = new THREE.Scene();
  const compositeQuad = new THREE.Mesh(fsGeo, compositeMaterial);
  compositeScene.add(compositeQuad);

    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    (renderer.domElement.style as any).display = 'block';

  const setSize = (w: number, h: number) => {
      renderer.setSize(w, h, false);
      uniforms.u_resolution.value.set(w, h);
    };

    // Initial size
    setSize(size, size);

    // Safety: if something detaches the canvas, re-attach once
    if (!container.contains(renderer.domElement)) {
      container.appendChild(renderer.domElement);
    }

    let start = performance.now();
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const now = performance.now();
      const t = (now - start) / 1000;
      if (shouldAnimate) {
        uniforms.u_time.value = t;
      }

      // 1) render scene to rtScene
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, camera);

  // 2) horizontal blur -> rtPing
  blurMaterialH.uniforms.tDiffuse.value = rtScene.texture;
  renderer.setRenderTarget(rtPing);
  renderer.render(postScene, postCamera);

  // 3) vertical blur -> rtPong
  blurMaterialV.uniforms.tDiffuse.value = rtPing.texture;
  renderer.setRenderTarget(rtPong);
  renderer.render(postScene, postCamera);

  // 4) composite base + blur to screen
  compositeMaterial.uniforms.tBase.value = rtScene.texture;
  compositeMaterial.uniforms.tBlur.value = rtPong.texture;
      renderer.setRenderTarget(null);
      renderer.render(compositeScene, postCamera);
    };

    const renderOnce = () => {
      renderer.render(scene, camera);
      if (onReady) onReady();
    };

    if (shouldAnimate) {
      // Ensure first frame signals readiness
      renderOnce();
      loop();
    } else {
      renderOnce();
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      renderer.render(scene, camera);
      if (onReady) onReady();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      geometry.dispose();
      (material as THREE.ShaderMaterial).dispose();
      blurMaterialH.dispose();
      blurMaterialV.dispose();
      compositeMaterial.dispose();
      fsGeo.dispose();
      rtScene.dispose();
      rtPing.dispose();
      rtPong.dispose();
      if (mesh.parent) mesh.parent.remove(mesh);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update colors when prop changes
  useEffect(() => {
    const uniforms = uniformsRef.current;
    if (!uniforms) return;
    const { c1, c2, c3 } = colors;
    uniforms.u_c1.value.set(c1.r, c1.g, c1.b);
    uniforms.u_c2.value.set(c2.r, c2.g, c2.b);
    uniforms.u_c3.value.set(c3.r, c3.g, c3.b);
  }, [colors]);

  // Update size when prop changes
  useEffect(() => {
    const renderer = rendererRef.current;
    const uniforms = uniformsRef.current;
    if (!renderer || !uniforms) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(size, size, false);
    uniforms.u_resolution.value.set(size, size);
  }, [size]);

  return (
    <div
      ref={mountRef}
  className={className}
  style={{ width: size, height: size, display: 'inline-block', position: 'relative', borderRadius: '50%', overflow: 'hidden' }}
      aria-label="Three.js Aurora Orb"
    />
  );
}
