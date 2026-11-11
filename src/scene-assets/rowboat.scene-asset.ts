/**
 * A clinker-built wooden rowboat (procedural, project-owned): a lofted open hull
 * whose overlapping planks (laps) step out in the silhouette, a square transom,
 * a raked stem, a keel, ribs, floorboards, three thwarts, bronze oarlocks and two
 * oars shipped inside. Painted outside, bare weathered wood inside; the photo
 * textures (Poly Haven, CC0) are applied at runtime by `dressRowboat`.
 * Origin on the waterline at mid-length; bow toward +Z; up +Y. 3.6 m x 1.35 m.
 * Anchors: `ROWBOAT.sternSeat` (Bigfoot's seat, local) and `ROWBOAT.seatTop`.
 */
import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, Vector3 } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { bevelBox, taperPlate } from './lib/hardsurface.js';

const L = 3.6;
const HALF = L / 2;
const PLANKS = 6;
const SKIN = 0.022;

export const ROWBOAT = {
  length: L,
  beam: 1.35,
  /** Bigfoot's seat (the stern thwart), local, and the seat's top height. */
  sternSeat: new Vector3(0, 0.2, -1.12),
  seatTop: 0.2,
  /** The middle thwart (the rower's seat), local z. */
  midSeatZ: 0.1,
};

/** Along-ship parameter t (0 stern .. 1 bow) for local z. */
const tOf = (z: number) => (z + HALF) / L;
/** Half-width at the gunwale: a square transom aft, the widest point a third along, closing to the stem. */
const halfW = (z: number) => 0.675 * Math.pow(Math.max(0, Math.sin(Math.PI * (0.25 + 0.75 * tOf(z)))), 0.8);
/** Sheer (gunwale height), rising toward both ends; and the keel line, rising forward. */
const topY = (z: number) => 0.4 + 0.1 * Math.pow(z / HALF, 2) + (z > 0 ? 0.06 * Math.pow(z / HALF, 3) : 0);
const botY = (z: number) => -0.27 + 0.08 * Math.pow(Math.max(0, z / HALF), 2) + 0.03 * Math.pow(Math.min(0, z / HALF), 2);

/** A point on the hull section at station z, across s (-1 port gunwale .. 0 keel .. 1 starboard gunwale), inset inward. */
function section(z: number, s: number, inset: number, laps: boolean, out: Vector3): Vector3 {
  const a = Math.abs(s);
  const hw = Math.max(0.0005, halfW(z) - inset);
  const yb = botY(z) + inset;
  let x = hw * Math.pow(a, 0.85);
  const y = yb + (topY(z) - yb) * Math.pow(a, 1.8);
  if (laps) {
    // Clinker: each plank's lower edge laps over the one below, stepping out a little.
    const u = a * PLANKS;
    x += 0.011 * (1 - (u - Math.floor(u))) * Math.min(1, a * 3) * Math.min(1, hw * 8);
  }
  return out.set(Math.sign(s) * x, y, z);
}

/** The hull skin as a grid of (stations x across), outer (laps, outward) or inner (smooth, inward). */
function skin(stations: number, across: number, inset: number, laps: boolean, inward: boolean): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const p = new Vector3();
  for (let i = 0; i <= stations; i++) {
    const z = -HALF + (L * i) / stations;
    for (let j = 0; j <= across; j++) {
      const s = -1 + (2 * j) / across;
      section(z, s, inset, laps, p);
      pos.push(p.x, p.y, p.z);
      // Planks run fore and aft: u along the boat (1 m tiles), v around the section.
      uv.push(z / 1.2, (s + 1) * 1.1);
    }
  }
  const idx: number[] = [];
  const row = across + 1;
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * row + j;
      const b = a + row;
      if (inward) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The gunwale: a rounded cap joining the outer and inner skins along both sheer lines, with a rubbing strake outside. */
function gunwale(stations: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const o = new Vector3();
  const n = new Vector3();
  // Cross-section of the cap (outward offset, height offset), from the outer skin over the top to the inner skin.
  const prof: [number, number][] = [[0.018, -0.05], [0.026, -0.02], [0.022, 0.012], [0.008, 0.022], [-0.012, 0.02], [-SKIN - 0.008, 0.004], [-SKIN, -0.03]];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= stations; i++) {
      const z = -HALF + (L * i) / stations;
      section(z, side, 0, false, o);
      for (let k = 0; k < prof.length; k++) {
        const [dx, dy] = prof[k];
        n.set(o.x + side * dx, o.y + dy, z);
        pos.push(n.x, n.y, n.z);
        uv.push(z / 1.2, k / (prof.length - 1));
      }
    }
    const row = prof.length;
    for (let i = 0; i < stations; i++) {
      for (let k = 0; k < row - 1; k++) {
        const a = base + i * row + k;
        const b = a + row;
        if (side > 0) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The transom: the stern board, cut to the hull's outer section at the stern. */
function transom(): BufferGeometry {
  const shape = new Shape();
  const p = new Vector3();
  const N = 24;
  for (let j = 0; j <= N; j++) {
    section(-HALF, -1 + (2 * j) / N, 0, false, p);
    if (j === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  }
  shape.closePath();
  const g = new ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -HALF - 0.02);
  return g;
}

/** The stem: a tapered post rising from the keel's forefoot to just above the sheer at the bow. */
function stem(): BufferGeometry {
  const pts: Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    const z = HALF - 0.32 * Math.pow(1 - k, 2) + 0.03 * k;
    pts.push(new Vector3(0, botY(HALF - 0.25) + (topY(HALF) + 0.06 - botY(HALF - 0.25)) * k, z));
  }
  const pos: number[] = [];
  const idx: number[] = [];
  const w = 0.03;
  for (const q of pts) pos.push(-w, q.y, q.z - 0.04, w, q.y, q.z - 0.04, w, q.y, q.z + 0.02, -w, q.y, q.z + 0.02);
  for (let i = 0; i < pts.length - 1; i++) {
    for (let f = 0; f < 4; f++) {
      const a = i * 4 + f;
      const b = i * 4 + ((f + 1) % 4);
      idx.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A square-section strip swept along points (keel), w wide and h deep below the line. */
function strip(pts: Vector3[], w: number, h: number): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const q of pts) pos.push(-w, q.y, q.z, w, q.y, q.z, w, q.y - h, q.z, -w, q.y - h, q.z);
  for (let i = 0; i < pts.length - 1; i++) {
    for (let f = 0; f < 4; f++) {
      const a = i * 4 + f;
      const b = i * 4 + ((f + 1) % 4);
      idx.push(a, a + 4, b, b, a + 4, b + 4);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A rib (frame): a thin ribbon following the inside of the hull at station z, standing in from the skin. */
function rib(z: number): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const p = new Vector3();
  const N = 18;
  for (let j = 0; j <= N; j++) {
    const s = -0.96 + (1.92 * j) / N;
    section(z, s, SKIN, false, p);
    const a = Math.abs(s);
    const ix = -Math.sign(s) * 0.02 * Math.pow(a, 0.6);
    const iy = 0.02 * (1 - a * 0.7);
    for (const dz of [-0.02, 0.02]) pos.push(p.x, p.y, z + dz, p.x + ix, p.y + iy, z + dz);
  }
  for (let j = 0; j < N; j++) {
    const a = j * 4;
    const b = a + 4;
    // Inner face, and the two edges.
    idx.push(a + 1, b + 1, a + 3, b + 1, b + 3, a + 3);
    idx.push(a, b, a + 1, b, b + 1, a + 1);
    idx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Inner half-breadth at height y on station z (where a thwart meets the hull). */
function innerAt(z: number, y: number): number {
  const yb = botY(z) + SKIN;
  const a = Math.pow(Math.min(1, Math.max(0, (y - yb) / (topY(z) - yb))), 1 / 1.8);
  return (halfW(z) - SKIN) * Math.pow(a, 0.85);
}

export function buildRowboat(): Group {
  const root = new Group();
  root.name = 'Rowboat';
  const paint = new MeshStandardMaterial({ name: 'BoatPaint', color: new Color(Palette.boatPaint), roughness: 0.78 });
  const wood = new MeshStandardMaterial({ name: 'BoatWood', color: new Color(Palette.boatWood), roughness: 0.86 });
  const trim = new MeshStandardMaterial({ name: 'BoatTrim', color: new Color(Palette.boatTrim), roughness: 0.48 });
  const bronze = new MeshStandardMaterial({ name: 'BoatBronze', color: new Color(Palette.boatBronze), roughness: 0.38, metalness: 0.85 });
  const hull = new Group();
  hull.name = 'Hull';
  const add = (parent: Group, name: string, geo: BufferGeometry, mat: MeshStandardMaterial) => {
    const m = new Mesh(geo, mat);
    m.name = name;
    parent.add(m);
    return m;
  };
  add(hull, 'HullOuter', skin(48, 28, 0, true, false), paint);
  add(hull, 'HullInner', skin(48, 20, SKIN, false, true), wood);
  add(hull, 'Gunwale', gunwale(48), trim);
  add(hull, 'Transom', transom(), paint);
  add(hull, 'Stem', stem(), trim);
  const keel: Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const z = -HALF + 0.03 + ((L - 0.3) * i) / 16;
    keel.push(new Vector3(0, botY(z) + 0.004, z));
  }
  add(hull, 'Keel', strip(keel, 0.028, 0.05), trim);
  root.add(hull);

  // Inside: ribs, floorboards, three thwarts (Bigfoot's is the stern one).
  const inside = new Group();
  inside.name = 'Interior';
  for (let i = 0; i < 8; i++) add(inside, `Rib${i}`, rib(-1.5 + i * 0.4), wood);
  const floor = add(inside, 'Floorboards', bevelBox(0.5, 0.022, 2.5, 0.006), wood);
  floor.position.set(0, botY(0) + SKIN + 0.055, -0.1);
  for (const [name, z, depth] of [['ThwartStern', ROWBOAT.sternSeat.z, 0.26], ['ThwartMid', 0.1, 0.22], ['ThwartBow', 1.0, 0.2]] as const) {
    const w = 2 * innerAt(z, ROWBOAT.seatTop) + 0.02;
    const t = add(inside, name, bevelBox(w, 0.035, depth, 0.008), trim);
    t.position.set(0, ROWBOAT.seatTop - 0.0175, z);
  }
  root.add(inside);

  // Bronze oarlocks on the gunwales by the middle thwart, and two oars shipped along the thwarts.
  const gear = new Group();
  gear.name = 'Gear';
  const post = new CylinderGeometry(0.011, 0.011, 0.07, 10);
  const horn = new CylinderGeometry(0.008, 0.008, 0.07, 8);
  horn.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const z = 0.45;
    const x = side * (halfW(z) - 0.004);
    const y = topY(z) + 0.035;
    const p = add(gear, side < 0 ? 'OarlockPort' : 'OarlockStarboard', post, bronze);
    p.position.set(x, y, z);
    const h = add(gear, side < 0 ? 'OarlockPortHorn' : 'OarlockStarboardHorn', horn, bronze);
    h.position.set(x, y + 0.04, z);
  }
  const shaft = new CylinderGeometry(0.02, 0.025, 1.9, 12);
  shaft.rotateX(Math.PI / 2);
  const blade = taperPlate(0.6, 0.15, 0.09, 0.014, 0.004);
  blade.rotateY(Math.PI / 2);
  for (const side of [-1, 1]) {
    const oar = new Group();
    oar.name = side < 0 ? 'OarPort' : 'OarStarboard';
    add(oar, 'Shaft', shaft, trim);
    const b = add(oar, 'Blade', blade, trim);
    b.position.set(0, 0, 1.18);
    // Lying on the thwarts, inside the gunwales, blades forward.
    oar.position.set(side * 0.2, ROWBOAT.seatTop + 0.04, -0.35);
    oar.rotation.set(0, -side * 0.03, 0);
    gear.add(oar);
  }
  root.add(gear);
  return root;
}

/**
 * The photo textures (Poly Haven, CC0): blue painted planks outside, weathered
 * planks inside and on the trim. Runtime only (it loads images).
 */
export function dressRowboat(boat: Group, loader: { load(url: string): import('@iwsdk/core').Texture }): void {
  const base = `${import.meta.env.BASE_URL}textures/boat/`;
  const set = (id: string, srgb: boolean) => {
    const t = loader.load(`${base}${id}_1k.jpg`);
    t.wrapS = t.wrapT = 1000; // RepeatWrapping
    if (srgb) (t as unknown as { colorSpace: string }).colorSpace = 'srgb';
    return t;
  };
  const maps = {
    BoatPaint: { map: set('blue_painted_planks_diff', true), normalMap: set('blue_painted_planks_nor_gl', false), roughnessMap: set('blue_painted_planks_arm', false) },
    BoatWood: { map: set('weathered_planks_diff', true), normalMap: set('weathered_planks_nor_gl', false), roughnessMap: set('weathered_planks_arm', false) },
  } as const;
  boat.traverse((o) => {
    const m = (o as Mesh).material as MeshStandardMaterial | undefined;
    const d = m && maps[m.name as keyof typeof maps];
    if (!m || !d || m.map) return;
    m.map = d.map;
    m.normalMap = d.normalMap;
    m.roughnessMap = d.roughnessMap;
    m.color.setRGB(1, 1, 1);
    m.needsUpdate = true;
  });
}

export default buildRowboat();
