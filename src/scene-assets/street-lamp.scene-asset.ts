/**
 * A New York "cobra head" street light (procedural, project-owned): a tapered
 * grey steel pole on a fluted base, a long curved arm, and the cobra-head
 * luminaire with a glowing lens underneath. Origin at the foot of the pole;
 * the arm reaches toward +X over the road. About 8 m tall.
 */
import { CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3 } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { bevelBox } from './lib/hardsurface.js';

export function buildStreetLamp(): Group {
  const root = new Group();
  root.name = 'StreetLamp';
  const steel = new MeshStandardMaterial({ color: Palette.lampSteel, metalness: 0.6, roughness: 0.45 });
  const base = new Mesh(new CylinderGeometry(0.2, 0.26, 0.9, 12), steel);
  base.position.y = 0.45;
  const pole = new Mesh(new CylinderGeometry(0.07, 0.12, 7.2, 12), steel);
  pole.position.y = 0.9 + 3.6;
  const arm = new Mesh(
    new TubeGeometry(new CatmullRomCurve3([new Vector3(0, 7.6, 0), new Vector3(0.5, 8.1, 0), new Vector3(1.6, 8.25, 0), new Vector3(2.6, 8.1, 0)]), 16, 0.05, 8),
    steel,
  );
  const head = new Mesh(bevelBox(0.9, 0.2, 0.42, 0.08), steel);
  head.position.set(2.85, 8.02, 0);
  head.rotation.z = -0.08;
  const lens = new Mesh(bevelBox(0.7, 0.04, 0.32, 0.02), new MeshStandardMaterial({ color: 0xfff3dc, emissive: Palette.lampGlow, emissiveIntensity: 2.4 }));
  lens.name = 'Lens';
  lens.position.set(2.85, 7.9, 0);
  root.add(base, pole, arm, head, lens);
  return root;
}

export default buildStreetLamp();
