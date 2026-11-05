/**
 * Skyline construction helpers shared by the landmark towers: boxes whose UVs
 * are in window cells (so every face has the same window size), deterministic
 * lit-window and deco-arch textures (DataTexture, no DOM), and materials.
 */
import { BoxGeometry, BufferGeometry, Color, DataTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from '@iwsdk/core';
import { makeRandom } from './hardsurface.js';

/** A box w×h×d whose faces' UVs count window cells (cellW wide, cellH tall); base at y = 0. */
export function cellBox(w: number, h: number, d: number, cellW: number, cellH: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const uv = g.getAttribute('uv');
  // BoxGeometry faces in order: +x, -x, +y, -y, +z, -z (4 vertices each).
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / cellW, (uv.getY(i) * dims[f][1]) / cellH);
    }
  }
  uv.needsUpdate = true;
  return g;
}

/**
 * Night windows: an n×n grid of panes in one tile, each lit (warm or cool) or
 * dark at random, with the frame between them black. `lit` is the share lit.
 */
export function windowTexture(seed: number, lit: number, warm: number, cells = 8, px = 8): DataTexture {
  const rand = makeRandom(seed);
  const size = cells * px;
  const data = new Uint8Array(size * size * 4);
  const c = new Color(warm);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const on = rand() < lit;
      const k = on ? 0.55 + rand() * 0.45 : 0.02 + rand() * 0.04;
      for (let y = 0; y < px; y++) {
        for (let x = 0; x < px; x++) {
          const pane = x >= 1 && x < px - 1 && y >= 2 && y < px - 1;
          const v = pane ? k : 0;
          const i = ((cy * px + y) * size + cx * px + x) * 4;
          data[i] = Math.round(255 * c.r * v);
          data[i + 1] = Math.round(255 * c.g * v);
          data[i + 2] = Math.round(255 * c.b * v);
          data[i + 3] = 255;
        }
      }
    }
  }
  return finish(new DataTexture(data, size, size));
}

/** Gilded deco arches: tall round-topped openings glowing gold, one per tile. */
export function archTexture(): DataTexture {
  const w = 32;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w * 0.36);
      const top = h * 0.72;
      const inside = Math.abs(dx) < 1 && y > h * 0.08 && (y < top || Math.hypot(dx, (y - top) / (w * 0.36)) < 1);
      // Bright rim, softer fill: reads as lit stone arches from far away.
      const rim = inside && (Math.abs(dx) > 0.72 || y < h * 0.14) ? 1 : 0;
      const v = inside ? 0.45 + 0.55 * rim : 0.03;
      const i = (y * w + x) * 4;
      data[i] = Math.round(255 * v);
      data[i + 1] = Math.round(220 * v);
      data[i + 2] = Math.round(150 * v);
      data[i + 3] = 255;
    }
  }
  return finish(new DataTexture(data, w, h));
}

function finish(t: DataTexture): DataTexture {
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** A facade material: dark body colour, windows glowing through the emissive map. */
export function facadeMaterial(color: number, windows: DataTexture, glow: number, metal = 0.1, rough = 0.85): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: 0xffffff, emissiveMap: windows, emissiveIntensity: glow });
}
