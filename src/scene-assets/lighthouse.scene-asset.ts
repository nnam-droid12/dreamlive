/**
 * A rock lighthouse (procedural, project-owned): a tapering white tower with
 * red bands on a dark rocky islet, a gallery deck with railing, a glazed
 * lantern room with a domed red cap and vent, and the lamp. Origin at sea
 * level at the base, +Y up; about 26 m tall. `Lamp` is where the beam turns.
 */
import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { makeRandom } from './lib/hardsurface.js';

export function buildLighthouse(): Group {
  const root = new Group();
  root.name = 'Lighthouse';
  const rand = makeRandom(17);
  // The islet: a cluster of dark, wet rocks.
  const rockMat = new MeshStandardMaterial({ color: Palette.rock, roughness: 0.6, metalness: 0.05 });
  for (let i = 0; i < 9; i++) {
    const r = 2.5 + rand() * 3;
    const rock = new Mesh(new DodecahedronGeometry(r, 0), rockMat);
    const a = rand() * Math.PI * 2;
    const d = rand() * 4.5;
    rock.position.set(Math.cos(a) * d, -r * 0.45, Math.sin(a) * d);
    rock.scale.set(1, 0.55 + rand() * 0.3, 1);
    rock.rotation.set(rand(), rand() * 3, rand());
    root.add(rock);
  }
  // The tower: white with two red bands (vertex colours by height).
  const H = 20;
  const tower = new CylinderGeometry(1.6, 2.6, H, 28, 10);
  tower.translate(0, H / 2 + 1, 0);
  const pos = tower.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const white = new Color(Palette.lighthouseWhite);
  const red = new Color(Palette.lighthouseRed);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const band = (y > 7 && y < 10) || (y > 15 && y < 18);
    const c = band ? red : white;
    col.set([c.r, c.g, c.b], i * 3);
  }
  tower.setAttribute('color', new BufferAttribute(col, 3));
  root.add(new Mesh(tower, new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })));
  // Gallery deck, railing, lantern room, cap, vent.
  const iron = new MeshStandardMaterial({ color: Palette.lighthouseIron, roughness: 0.5, metalness: 0.5 });
  const deck = new Mesh(new CylinderGeometry(2.4, 2.2, 0.3, 28), iron);
  deck.position.y = H + 1.15;
  const rail = new Mesh(new TorusGeometry(2.35, 0.04, 6, 32), iron);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = H + 2.2;
  const glass = new Mesh(
    new CylinderGeometry(1.3, 1.3, 2.2, 12, 1, true),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, emissive: new Color(Palette.lighthouseLamp), emissiveIntensity: 0.6 }),
  );
  glass.position.y = H + 2.4;
  const cap = new Mesh(new SphereGeometry(1.45, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: Palette.lighthouseRed, roughness: 0.5 }));
  cap.position.y = H + 3.5;
  const vent = new Mesh(new CylinderGeometry(0.15, 0.25, 0.6, 10), iron);
  vent.position.y = H + 5.1;
  const lampGlow = new Mesh(new SphereGeometry(0.55, 14, 10), new MeshBasicMaterial({ color: Palette.lighthouseLamp, toneMapped: false }));
  lampGlow.position.y = H + 2.4;
  const lamp = new Object3D();
  lamp.name = 'Lamp';
  lamp.position.y = H + 2.4;
  root.add(deck, rail, glass, cap, vent, lampGlow, lamp);
  return root;
}

export default buildLighthouse();
