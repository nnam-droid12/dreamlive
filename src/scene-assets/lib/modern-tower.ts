/**
 * Modern skyscrapers built like real ones (procedural, project-owned):
 * - a glass curtain wall per tier (reflective glass; lit offices behind it at night),
 * - concrete floor slabs every storey, corner columns and parapets,
 * - aluminium (or bronze) mullion fins every 1.6 m on every face,
 * - a two-storey glass lobby with a canopy, setbacks, and a mechanical crown
 *   with louvres, a mast and an aircraft beacon.
 * Stone towers swap the curtain wall for a punched-window limestone facade.
 * Each tower is about four draw calls: glass, concrete (instanced), fins
 * (instanced), crown. Origin at the base centre, +Y up; sizes in metres.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { cellBox } from './skyline.js';

export type TowerStyle = 'blue' | 'dark' | 'stone';

export interface TowerSpec {
  w: number;
  d: number;
  h: number;
  style: TowerStyle;
  /** Step back near the top (two setbacks). */
  setbacks: boolean;
  seed: number;
  /** Mechanical crown, mast and beacon on top (off for a roof that hosts a party). */
  crown?: boolean;
}

export interface TowerMaterials {
  /** Curtain-wall glass per style (reflective; lit windows in the emissive map). */
  glass: Record<'blue' | 'dark', MeshStandardMaterial>;
  /** Punched-window stone facade (photo PBR). */
  stone: MeshStandardMaterial;
  lobby: MeshStandardMaterial;
  concrete: MeshStandardMaterial;
  fin: Record<TowerStyle, MeshStandardMaterial>;
  crown: MeshStandardMaterial;
  beacon: MeshBasicMaterial;
}

const STOREY = 3.6;
const FIN_EVERY = 1.6;
const TILE = 14;

/** Merge boxes (already translated/scaled) into one non-indexed geometry. */
function mergeBoxes(geos: BufferGeometry[]): BufferGeometry {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const count = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of parts) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const u = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++, o++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], o * 3);
      nor.set([n.getX(i), n.getY(i), n.getZ(i)], o * 3);
      uv.set([u.getX(i), u.getY(i)], o * 2);
    }
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nor, 3));
  out.setAttribute('uv', new BufferAttribute(uv, 2));
  return out;
}

export function buildModernTower(spec: TowerSpec, m: TowerMaterials): Group {
  const root = new Group();
  root.name = `ModernTower_${spec.style}`;
  const { w, d, h } = spec;
  const lobbyH = STOREY * 2;
  // Tiers: [y0, y1, width, depth].
  const tiers: [number, number, number, number][] = spec.setbacks
    ? [
        [lobbyH, h * 0.62, w, d],
        [h * 0.62, h * 0.86, w * 0.8, d * 0.8],
        [h * 0.86, h, w * 0.62, d * 0.62],
      ]
    : [[lobbyH, h, w, d]];

  // 1. The skin: curtain-wall glass (or stone) per tier, UVs in facade tiles.
  const skin = mergeBoxes(
    tiers.map(([y0, y1, tw, td]) => {
      const g = cellBox(tw, y1 - y0, td, TILE, TILE);
      g.translate(0, y0, 0);
      return g;
    }),
  );
  const skinMat = spec.style === 'stone' ? m.stone : m.glass[spec.style];
  const skinMesh = new Mesh(skin, skinMat);
  skinMesh.name = 'CurtainWall';
  // Stone towers take a real limestone facade once the photo textures load (facades.ts).
  if (spec.style === 'stone') skinMesh.userData.facade = 'f20a';
  root.add(skinMesh);

  // 2. Lobby: recessed double-height glass with a canopy over the entrance.
  const lobby = new Mesh(new BoxGeometry(w - 1.6, lobbyH, d - 1.6), m.lobby);
  lobby.name = 'Lobby';
  lobby.position.y = lobbyH / 2;
  root.add(lobby);

  // 3. Concrete: floor-slab edges every storey, corner columns, parapets, canopy (one instanced mesh).
  const unit = new BoxGeometry(1, 1, 1);
  const boxes: Matrix4[] = [];
  const mat4 = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) =>
    boxes.push(new Matrix4().compose(new Vector3(cx, cy, cz), new Quaternion(), new Vector3(sx, sy, sz)));
  for (const [y0, y1, tw, td] of tiers) {
    for (let y = y0; y < y1 - 0.5; y += STOREY) mat4(0, y + 0.15, 0, tw + 0.14, 0.3, td + 0.14);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mat4((sx * tw) / 2, (y0 + y1) / 2, (sz * td) / 2, 0.7, y1 - y0, 0.7);
    // Parapet: a low wall around the roof's rim (the roof itself stays open: on the party tower people stand on it).
    const ph = spec.crown === false ? 0.9 : 1.2;
    mat4(0, y1 + ph / 2, td / 2, tw + 0.3, ph, 0.3);
    mat4(0, y1 + ph / 2, -td / 2, tw + 0.3, ph, 0.3);
    mat4(tw / 2, y1 + ph / 2, 0, 0.3, ph, td);
    mat4(-tw / 2, y1 + ph / 2, 0, 0.3, ph, td);
    // The roof deck itself, flush with the top of the tier.
    mat4(0, y1 - 0.05, 0, tw, 0.1, td);
  }
  mat4(0, lobbyH + 0.1, d / 2 - 0.2, w * 0.45, 0.25, 3.2);
  mat4(0, lobbyH / 2, 0, w + 0.1, 0.4, d + 0.1);
  const concrete = new InstancedMesh(unit, m.concrete, boxes.length);
  boxes.forEach((b, i) => concrete.setMatrixAt(i, b));
  concrete.name = 'Structure';
  root.add(concrete);

  // 4. Mullion fins on every face of every tier (one instanced mesh).
  const fins: Matrix4[] = [];
  for (const [y0, y1, tw, td] of tiers) {
    const fh = y1 - y0;
    const nx = Math.max(2, Math.round(tw / FIN_EVERY));
    const nz = Math.max(2, Math.round(td / FIN_EVERY));
    for (let i = 1; i < nx; i++) {
      const x = -tw / 2 + (i * tw) / nx;
      for (const s of [-1, 1]) fins.push(new Matrix4().compose(new Vector3(x, (y0 + y1) / 2, (s * td) / 2 + s * 0.09), new Quaternion(), new Vector3(0.07, fh, 0.18)));
    }
    for (let i = 1; i < nz; i++) {
      const z = -td / 2 + (i * td) / nz;
      for (const s of [-1, 1]) fins.push(new Matrix4().compose(new Vector3((s * tw) / 2 + s * 0.09, (y0 + y1) / 2, z), new Quaternion(), new Vector3(0.18, fh, 0.07)));
    }
  }
  const finMesh = new InstancedMesh(unit, m.fin[spec.style], fins.length);
  fins.forEach((f, i) => finMesh.setMatrixAt(i, f));
  finMesh.name = 'Mullions';
  root.add(finMesh);

  // 5. Crown: louvred mechanical penthouse, a mast and a red beacon.
  if (spec.crown === false) return root;
  const [, top, cw, cd] = tiers[tiers.length - 1];
  const crown = new Group();
  crown.name = 'Crown';
  crown.position.y = top + 1.2;
  const plant = new Mesh(new BoxGeometry(cw * 0.55, 5, cd * 0.55), m.crown);
  plant.position.y = 2.5;
  const mast = new Mesh(new CylinderGeometry(0.18, 0.3, 9 + (spec.seed % 3) * 3, 6), m.crown);
  mast.position.y = 5 + mast.geometry.parameters.height / 2;
  const beacon = new Mesh(new SphereGeometry(0.35, 8, 6), m.beacon);
  beacon.position.y = 5 + mast.geometry.parameters.height + 0.3;
  crown.add(plant, mast, beacon);
  root.add(crown);
  return root;
}

