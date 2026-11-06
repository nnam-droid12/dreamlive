/**
 * A white dove (procedural, project-owned). Body: a lathed, smoothly tapering
 * form from chest to a fanned tail, a round head with a small orange beak.
 * Wings: separate thin feathered planes (scalloped trailing edge) so a flock can
 * flap them. Origin at the body's centre, +Z forward (beak), +Y up, +X the left
 * wing; about 0.32 m long with a 0.6 m wingspan. The flock (visuals/city-life)
 * instances `doveBodyGeometry` and `doveWingGeometry`.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';

/** Merge non-indexed parts into one geometry with per-vertex colour. */
function merge(parts: { g: BufferGeometry; color: number }[]): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new Color();
  for (const { g, color } of parts) {
    const n = g.index ? g.toNonIndexed() : g;
    n.computeVertexNormals();
    const p = n.getAttribute('position');
    const q = n.getAttribute('normal');
    c.setHex(color);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(q.getX(i), q.getY(i), q.getZ(i));
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  out.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  out.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  return out;
}

/** Body, head, beak and tail fan in one geometry (vertex colours: white, soft grey, orange). */
export function doveBodyGeometry(): BufferGeometry {
  // Profile from tail (y = -0.15) to neck (y = 0.1); turned to lie along +Z.
  const profile = [
    [0.004, -0.15], [0.02, -0.12], [0.042, -0.07], [0.056, -0.02], [0.058, 0.02], [0.05, 0.06], [0.034, 0.09], [0.02, 0.105],
  ].map(([r, y]) => new Vector2(r, y));
  const body = new LatheGeometry(profile, 14);
  body.rotateX(Math.PI / 2);
  body.scale(1, 0.85, 1);
  const head = new SphereGeometry(0.036, 12, 10);
  head.translate(0, 0.03, 0.125);
  const beak = new ConeGeometry(0.009, 0.026, 8);
  beak.rotateX(Math.PI / 2);
  beak.translate(0, 0.024, 0.168);
  // A fanned tail: a flat, slightly rounded fan behind the body.
  const fan = new Shape();
  fan.moveTo(-0.018, 0);
  fan.lineTo(-0.05, -0.11);
  fan.quadraticCurveTo(0, -0.13, 0.05, -0.11);
  fan.lineTo(0.018, 0);
  fan.lineTo(-0.018, 0);
  const tail = new ShapeGeometry(fan);
  tail.rotateX(Math.PI / 2);
  tail.translate(0, 0.005, -0.13);
  return merge([
    { g: body, color: Palette.doveWhite },
    { g: head, color: Palette.doveWhite },
    { g: beak, color: Palette.doveBeak },
    { g: tail, color: Palette.doveGrey },
  ]);
}

/**
 * One wing (the left, +X), root at the origin: a rounded leading edge out to a
 * pointed tip and a scalloped (feathered) trailing edge. Mirror X for the right.
 */
export function doveWingGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, 0.045);
  s.quadraticCurveTo(0.14, 0.07, 0.3, 0.0);
  // Trailing edge: primary and secondary feathers, tip back to the root.
  const feathers = 7;
  for (let i = 1; i <= feathers; i++) {
    const t = i / feathers;
    const x = 0.3 * (1 - t);
    const y = -0.03 - 0.035 * Math.sin(t * Math.PI) * (1 - 0.4 * t);
    s.quadraticCurveTo(x + 0.02, y - 0.022, x, y);
  }
  s.lineTo(0, 0.045);
  const g = new ShapeGeometry(s, 4);
  // Lay it flat: span along +X, leading edge forward (+Z), feathers trailing back.
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export function doveMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide, emissive: new Color(Palette.doveWhite), emissiveIntensity: 0.12 });
}

/** A single dove with wings half raised (the manifest prototype / preview). */
export function buildDove(): Group {
  const root = new Group();
  root.name = 'Dove';
  const mat = doveMaterial();
  const body = new Mesh(doveBodyGeometry(), mat);
  body.name = 'Body';
  const wingMat = new MeshStandardMaterial({ color: Palette.doveWhite, roughness: 0.85, side: DoubleSide, emissive: new Color(Palette.doveWhite), emissiveIntensity: 0.12 });
  const left = new Mesh(doveWingGeometry(), wingMat);
  left.name = 'WingLeft';
  left.position.set(0.03, 0.03, 0.03);
  left.rotation.z = 0.35;
  const rightGeo = doveWingGeometry();
  rightGeo.scale(-1, 1, 1);
  const right = new Mesh(rightGeo, wingMat);
  right.name = 'WingRight';
  right.position.set(-0.03, 0.03, 0.03);
  right.rotation.z = -0.35;
  root.add(body, left, right);
  return root;
}

export default buildDove();
