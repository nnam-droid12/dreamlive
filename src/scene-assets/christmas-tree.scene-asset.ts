/**
 * A town Christmas tree (procedural, project-owned): a 5 m fir of seven full
 * tiers, red and gold baubles, a spiral of warm fairy lights (instanced; their
 * colours are driven at runtime to twinkle) and a glowing five-point star on top.
 * Origin at the base, +Y up. `Lights` is the InstancedMesh of bulbs, `Star` the topper.
 */
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
} from '@iwsdk/core';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Palette } from '../config/palette.js';
import { makeRandom } from './lib/hardsurface.js';

const HEIGHT = 5;
export const TREE_LIGHTS = 90;

/** Radius of the tree's outline at height y (for hanging things on its surface). */
function outline(y: number): number {
  const k = Math.min(1, Math.max(0, (y - 0.5) / (HEIGHT - 0.6)));
  return 1.75 * (1 - k);
}

export function buildChristmasTree(): Group {
  const root = new Group();
  root.name = 'ChristmasTree';
  const rand = makeRandom(31);
  // Body: trunk and seven overlapping needle tiers.
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const k = i / 6;
    const r = 1.85 * (1 - k * 0.85);
    const h = 1.35 - k * 0.5;
    const c = new ConeGeometry(r, h, 18, 1);
    c.translate(0, 0.5 + i * 0.62 + h / 2, 0);
    parts.push(c);
  }
  const needles = new Mesh(mergeGeometries(parts)!, new MeshStandardMaterial({ color: Palette.xmasNeedles, roughness: 0.85 }));
  needles.name = 'Needles';
  const trunk = new CylinderGeometry(0.14, 0.2, 0.7, 10);
  trunk.translate(0, 0.35, 0);
  const bark = new Mesh(trunk, new MeshStandardMaterial({ color: Palette.pineBark, roughness: 0.9 }));
  root.add(needles, bark);

  // Baubles: glossy red and gold.
  const m = new Matrix4();
  const tint = new Color();
  const baubles = new InstancedMesh(new SphereGeometry(0.075, 12, 8), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.6 }), 46);
  baubles.name = 'Baubles';
  for (let i = 0; i < baubles.count; i++) {
    const y = 0.75 + rand() * (HEIGHT - 1.5);
    const a = rand() * Math.PI * 2;
    const r = outline(y) * 0.9;
    m.makeTranslation(Math.cos(a) * r, y - 0.08, Math.sin(a) * r);
    baubles.setMatrixAt(i, m);
    baubles.setColorAt(i, tint.setHex(i % 3 === 0 ? Palette.xmasGold : Palette.xmasRed));
  }
  root.add(baubles);

  // Fairy lights spiralling up the tree.
  const lights = new InstancedMesh(new IcosahedronGeometry(0.035, 0), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), TREE_LIGHTS);
  lights.name = 'Lights';
  for (let i = 0; i < TREE_LIGHTS; i++) {
    const k = i / TREE_LIGHTS;
    const y = 0.7 + k * (HEIGHT - 1.1);
    const a = k * Math.PI * 2 * 6.5;
    const r = outline(y) * 0.97 + 0.03;
    m.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r);
    lights.setMatrixAt(i, m);
    lights.setColorAt(i, tint.setHex(Palette.xmasBulb));
  }
  root.add(lights);

  // The star on top.
  const star = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.12 : 0.3;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new ExtrudeGeometry(star, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  starGeo.center();
  const topper = new Mesh(starGeo, new MeshStandardMaterial({ color: Palette.xmasGold, emissive: new Color(Palette.xmasStar), emissiveIntensity: 2.2, metalness: 0.4, roughness: 0.3 }));
  topper.name = 'Star';
  topper.position.y = HEIGHT + 0.12;
  root.add(topper);
  return root;
}

export default buildChristmasTree();
