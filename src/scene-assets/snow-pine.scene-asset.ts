/**
 * A snow-laden spruce (procedural, project-owned): a bark trunk and five tiers
 * of drooping, slightly irregular needle skirts, each carrying a snow cap that
 * covers its upper surface (white on top, dark green in the shade beneath).
 * One merged geometry with vertex colours, so a forest is one InstancedMesh.
 * Origin at the trunk base, +Y up; about 6 m tall.
 */
import { BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Mesh, MeshStandardMaterial } from '@iwsdk/core';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Palette } from '../config/palette.js';
import { makeRandom } from './lib/hardsurface.js';

function paint(g: BufferGeometry, c: Color): BufferGeometry {
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

/** A skirt of needles: a cone with a ragged, drooping rim; `snow` whitens its upper part. */
function tier(radius: number, height: number, y: number, seed: number, color: Color, snow: boolean): BufferGeometry {
  const rand = makeRandom(seed);
  const g = new ConeGeometry(radius, height, 14, 2, true).toNonIndexed();
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    if (py < -height / 2 + 1e-3) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      const r = 1 + Math.sin(a * 7 + seed) * 0.08 + (rand() - 0.5) * 0.06;
      pos.setX(i, pos.getX(i) * r);
      pos.setZ(i, pos.getZ(i) * r);
      pos.setY(i, py - Math.abs(Math.sin(a * 3.5 + seed)) * height * 0.12);
    }
  }
  g.translate(0, y + height / 2, 0);
  if (!snow) return paint(g, color);
  const col = new Float32Array(pos.count * 3);
  const white = new Color(Palette.snowWhite);
  const tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) - y) / height; // 0 at the rim, 1 at the tip
    tmp.copy(color).lerp(white, Math.min(1, Math.max(0, (k - 0.12) * 2.4)));
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

export function snowPineGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const bark = new Color(Palette.pineBark);
  const needles = new Color(Palette.pineNeedles);
  const trunk = new CylinderGeometry(0.12, 0.2, 1.6, 8).toNonIndexed();
  trunk.translate(0, 0.8, 0);
  parts.push(paint(trunk, bark));
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const r = 2.1 * (1 - k * 0.78);
    const h = 1.9 - k * 0.6;
    const y = 0.8 + i * 1.02;
    // A dark skirt, then a snowy skirt slightly smaller and higher on top of it.
    parts.push(tier(r, h, y, i * 11 + 1, needles, false));
    parts.push(tier(r * 0.94, h * 0.9, y + h * 0.14, i * 11 + 5, needles, true));
  }
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

export function snowPineMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
}

export function buildSnowPine(): Mesh {
  const m = new Mesh(snowPineGeometry(), snowPineMaterial());
  m.name = 'SnowPine';
  return m;
}

export default buildSnowPine();
