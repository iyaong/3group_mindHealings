// colorUtils.ts — 색상 변환 및 팔레트 생성 유틸리티 함수

export function hexToRgb(hex: string) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return { r, g, b };
}

export function hexToHsl(hex: string) {
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

export function hslToHex(h: number, s: number, l: number) {
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

export function paletteFromBase(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  // 채도와 명도 변화를 더 크게 해서 색상 차이를 명확하게
  const c1 = hslToHex(h, Math.min(100, s * 1.15), Math.min(95, l * 1.15)); // 더 밝고 선명
  const c2 = hslToHex((h + 300) % 360, Math.min(100, s * 0.9), Math.max(15, l * 0.75)); // 더 어둡게
  const c3 = hslToHex((h + 60) % 360, Math.min(100, s * 1.1), Math.min(90, l * 1.05)); // 약간 변화
  return { c1, c2, c3 };
}

// 생동감 있는 그라데이션을 위한 유사색 생성
export function generateGradientColors(baseColor: string) {
  const { h, s, l } = hexToHsl(baseColor);
  
  // 기본색
  const color1 = baseColor;
  
  // 밝고 선명한 유사색 (색상 크게 회전)
  const color2 = hslToHex(
    (h + 45) % 360,  // 색상을 크게 회전
    Math.min(100, s * 1.25),  // 채도 크게 증가
    Math.min(85, l * 1.3)    // 밝기 크게 증가
  );
  
  // 반대편 색상 (보색에 가깝게)
  const color3 = hslToHex(
    (h + 315) % 360,  // -45도 회전 (반대 방향)
    Math.min(100, s * 1.15),
    Math.max(25, l * 0.75)   // 더 어둡게
  );
  
  // 중간 톤 (색상 차이 크게)
  const color4 = hslToHex(
    (h + 25) % 360,  // 중간 각도
    Math.min(100, s * 1.2),
    Math.min(80, l * 1.1)
  );
  
  return { color1, color2, color3, color4 };
}

// 랜덤 그라데이션 각도 생성
export function getRandomGradientAngle() {
  const angles = [45, 90, 135, 180, 225, 270, 315];
  return angles[Math.floor(Math.random() * angles.length)];
}

// 그라데이션 CSS 생성
export function createGradientStyle(baseColor: string) {
  const { color1, color2, color3, color4 } = generateGradientColors(baseColor);
  const angle = getRandomGradientAngle();
  
  // 여러 색상을 사용한 복잡한 그라데이션
  return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 30%, ${color4} 60%, ${color3} 100%)`;
}
