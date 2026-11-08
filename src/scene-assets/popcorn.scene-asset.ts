/**
 * A cinema popcorn bucket (procedural, project-owned): a tapered paper cup with
 * red-and-white stripes, a rolled rim, and a heaped crown of puffy kernels.
 * Origin at the bottom centre, +Y up; about 0.2 m tall, 0.16 m across the top.
 */
import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { makeRandom } from './lib/hardsurface.js';

export function buildPopcorn(): Group {
  const root = new Group();
  root.name = 'Popcorn';
  // The cup: 16 vertical stripes, alternating red and white (vertex colours).
  const cup = new CylinderGeometry(0.08, 0.058, 0.17, 32, 1, true).toNonIndexed();
  cup.translate(0, 0.085, 0);
  const pos = cup.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const red = new Color(Palette.popcornRed);
  const white = new Color(Palette.popcornWhite);
  for (let i = 0; i < pos.count; i += 3) {
    // Colour each triangle by the angle of its centre.
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const stripe = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 16) % 2;
    const c = stripe ? red : white;
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  cup.setAttribute('color', new BufferAttribute(col, 3));
  cup.computeVertexNormals();
  const paper = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: DoubleSide });
  const body = new Mesh(cup, paper);
  body.name = 'Cup';
  const base = new Mesh(new CylinderGeometry(0.058, 0.058, 0.004, 24), new MeshStandardMaterial({ color: Palette.popcornWhite, roughness: 0.7 }));
  base.position.y = 0.002;
  const rim = new Mesh(new TorusGeometry(0.08, 0.0045, 6, 32), new MeshStandardMaterial({ color: Palette.popcornWhite, roughness: 0.6 }));
  rim.name = 'Rim';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.17;
  root.add(body, base, rim);

  // The crown of popcorn: puffy kernels heaped into a dome above the rim.
  const rand = makeRandom(7);
  const count = 70;
  const kernels = new InstancedMesh(new IcosahedronGeometry(0.016, 1), new MeshStandardMaterial({ vertexColors: false, color: 0xffffff, roughness: 0.85 }), count);
  kernels.name = 'Kernels';
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const tint = new Color();
  const e = new Euler();
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.072;
    const dome = Math.cos((r / 0.08) * (Math.PI / 2)) * 0.045;
    p.set(Math.cos(a) * r, 0.168 + dome * rand(), Math.sin(a) * r);
    q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
    const k = 0.8 + rand() * 0.5;
    s.set(k * (0.9 + rand() * 0.3), k * (0.75 + rand() * 0.3), k);
    m.compose(p, q, s);
    kernels.setMatrixAt(i, m);
    kernels.setColorAt(i, tint.setHex(rand() < 0.75 ? Palette.popcornWhite : Palette.popcornButter));
  }
  root.add(kernels);
  return root;
}

export default buildPopcorn();
