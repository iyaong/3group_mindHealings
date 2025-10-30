import { useEffect, useMemo, useState } from 'react';
import './aurora.css';

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
  const toHex = (v: number) => {
    const h = Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return h;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function paletteFromBase(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  const c1 = hslToHex(h, Math.min(100, s * 1.0), Math.min(90, l * 1.05));
  const c2 = hslToHex((h + 300) % 360, Math.min(100, s * 0.8), Math.max(20, l * 0.9));
  const c3 = hslToHex((h + 60) % 360, Math.min(100, s * 0.9), Math.min(85, l * 1.0));
  return { c1, c2, c3 };
}

export default function AuroraOrb({ color, size = 260, className = '' }: { color: string; size?: number; className?: string }) {
  const [prev, setPrev] = useState(color);
  const [showNew, setShowNew] = useState(false);
  const current = useMemo(() => paletteFromBase(prev), [prev]);
  const next = useMemo(() => paletteFromBase(color), [color]);
  const style: React.CSSProperties = {
    ['--size' as any]: `${size}px`,
    ['--c1' as any]: current.c1,
    ['--c2' as any]: current.c2,
    ['--c3' as any]: current.c3,
  };
  const styleOverlay: React.CSSProperties = {
    ['--c1' as any]: next.c1,
    ['--c2' as any]: next.c2,
    ['--c3' as any]: next.c3,
  };

  useEffect(() => {
    if (color === prev) return;
    setShowNew(true);
    const t = setTimeout(() => { setPrev(color); setShowNew(false); }, 600);
    return () => clearTimeout(t);
  }, [color, prev]);

  return (
    <div className={`aurora-orb-wrap ${className}`} style={style}>
      <div className="aurora-orb">
        <div className={`aurora-orb__overlay ${showNew ? 'show' : ''}`} style={styleOverlay} />
      </div>
    </div>
  );
}
