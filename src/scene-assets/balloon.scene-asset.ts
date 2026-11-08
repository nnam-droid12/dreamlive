/**
 * A hot-air balloon (procedural, project-owned): a classic teardrop envelope of
 * 24 gores in alternating sunrise colours with a crown ring, a skirt, eight load
 * ropes, a wicker basket with a padded rim, a burner frame and a soft flame.
 * Origin at the basket floor centre, +Y up; about 9 m tall, 6 m across.
 * `Basket` is the attachment point for a passenger standing on the floor.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';

const GORES = 24;

function envelope(): Mesh {
  // Profile (radius, height above the skirt mouth): a teardrop with a rounded crown.
  const pts: Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const y = t * 6.4;
    const r = t < 0.62 ? 0.75 + 2.25 * Math.sin((t / 0.62) * (Math.PI / 2)) : 3.0 * Math.cos(((t - 0.62) / 0.38) * (Math.PI / 2)) ** 0.8;
    pts.push(new Vector2(Math.max(0.02, r), y));
  }
  const geo = new LatheGeometry(pts, GORES * 2).toNonIndexed();
  // Colour by gore (two segments per gore), three alternating colours.
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const colors = [new Color(Palette.balloonA), new Color(Palette.balloonB), new Color(Palette.balloonC)];
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const gore = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * GORES) % 3;
    for (let k = 0; k < 3; k++) col.set([colors[gore].r, colors[gore].g, colors[gore].b], (i + k) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: DoubleSide }));
  mesh.name = 'Envelope';
  return mesh;
}

export function buildBalloon(): Group {
  const root = new Group();
  root.name = 'Balloon';
  const env = envelope();
  env.position.y = 2.6;
  root.add(env);
  // Crown ring and the skirt (scoop) at the mouth.
  const crown = new Mesh(new TorusGeometry(0.35, 0.05, 6, 20), new MeshStandardMaterial({ color: Palette.balloonTrim, roughness: 0.5 }));
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 2.6 + 6.38;
  const skirt = new Mesh(new CylinderGeometry(0.75, 0.62, 0.7, 24, 1, true), new MeshStandardMaterial({ color: Palette.balloonTrim, roughness: 0.6, side: DoubleSide }));
  skirt.name = 'Skirt';
  skirt.position.y = 2.6 - 0.3;
  root.add(crown, skirt);
  // Basket: woven sides, a padded leather rim, a floor.
  const basket = new Group();
  basket.name = 'Basket';
  const wicker = new MeshStandardMaterial({ color: Palette.balloonWicker, roughness: 0.9 });
  const sides = new Mesh(new CylinderGeometry(0.62, 0.55, 1.05, 4, 3, true), wicker);
  sides.rotation.y = Math.PI / 4;
  sides.position.y = 0.52;
  sides.material.side = DoubleSide;
  const rim = new Mesh(new TorusGeometry(0.62, 0.06, 6, 4), new MeshStandardMaterial({ color: Palette.balloonLeather, roughness: 0.5 }));
  rim.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  rim.position.y = 1.05;
  const floor = new Mesh(new CylinderGeometry(0.55, 0.55, 0.05, 4), wicker);
  floor.rotation.y = Math.PI / 4;
  floor.position.y = 0.02;
  basket.add(sides, rim, floor);
  root.add(basket);
  // Burner frame and its flame (glowing, additive).
  const frame = new Mesh(new CylinderGeometry(0.18, 0.18, 0.2, 10), new MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.8, roughness: 0.3 }));
  frame.position.y = 2.15;
  const flame = new Mesh(new ConeGeometry(0.16, 0.6, 12, 1, true), new MeshBasicMaterial({ color: Palette.balloonFlame, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  flame.name = 'Flame';
  flame.position.y = 2.55;
  root.add(frame, flame);
  // Eight load ropes from the basket rim corners to the skirt.
  const rope = new MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const from = new Vector3(Math.cos(a) * 0.6, 1.05, Math.sin(a) * 0.6);
    const to = new Vector3(Math.cos(a) * 0.68, 2.3, Math.sin(a) * 0.68);
    const len = from.distanceTo(to);
    const r = new Mesh(new CylinderGeometry(0.012, 0.012, len, 4), rope);
    r.position.copy(from).add(to).multiplyScalar(0.5);
    r.lookAt(to);
    r.rotateX(Math.PI / 2);
    root.add(r);
  }
  return root;
}

export default buildBalloon();
