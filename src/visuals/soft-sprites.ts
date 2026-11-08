import { CanvasTexture, SRGBColorSpace } from '@iwsdk/core';

/** A small seeded random (so every cloud is the same on every run). */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * A cumulus puff painted on a canvas: dozens of soft overlapping blobs, lit
 * from the top (white crown, grey-violet belly), feathered edges. White on
 * transparent; the material colour tints it to the sky.
 */
export function cloudTexture(seed: number, size = 256): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const r = rng(seed * 7919 + 13);
  const h = size;
  for (let pass = 0; pass < 2; pass++) {
    const n = pass === 0 ? 26 : 34;
    for (let i = 0; i < n; i++) {
      // A dome of blobs: wider at the base, heaped in the middle.
      const t = r();
      const x = h * (0.5 + (r() - 0.5) * 0.72 * (1 - t * 0.5));
      const y = h * (0.62 - t * 0.3 + (r() - 0.5) * 0.1);
      const rad = h * (0.08 + r() * 0.12) * (1 - t * 0.35);
      const grad = g.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
      const lit = pass === 0 ? 205 + Math.round(t * 30) : 240 + Math.round(t * 15);
      const belly = pass === 0 ? 196 : 222;
      const shade = Math.round(belly + (lit - belly) * (1 - y / h));
      grad.addColorStop(0, `rgba(${lit},${lit},${Math.min(255, lit + 6)},${pass === 0 ? 0.55 : 0.5})`);
      grad.addColorStop(0.6, `rgba(${shade},${shade},${Math.min(255, shade + 14)},0.28)`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** A star glint: a hot core, a soft halo and four thin rays. */
export function starTexture(size = 128): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const m = size / 2;
  const halo = g.createRadialGradient(m, m, 0, m, m, m);
  halo.addColorStop(0, 'rgba(255,255,255,1)');
  halo.addColorStop(0.08, 'rgba(255,246,214,0.95)');
  halo.addColorStop(0.3, 'rgba(255,220,150,0.25)');
  halo.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  for (const [w, hgt] of [
    [size, size * 0.03],
    [size * 0.03, size],
  ]) {
    const ray = g.createRadialGradient(m, m, 0, m, m, m);
    ray.addColorStop(0, 'rgba(255,250,230,0.9)');
    ray.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = ray;
    g.fillRect(m - w / 2, m - hgt / 2, w, hgt);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** A soft round flake/drop: white disc with a feathered edge. */
export function softDotTexture(size = 64): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const m = size / 2;
  const grad = g.createRadialGradient(m, m, 0, m, m, m);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
