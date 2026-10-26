import { Color, Group, Mesh, MeshStandardMaterial } from '@iwsdk/core';
import { bevelBox, LoftSurface, sampleRange } from './lib/hardsurface.js';

/**
 * A pair of skis for the ski dream. Origin on the snow between the boots, tips
 * toward +Z, up +Y. Skis are 1.8 m long with sidecut and upturned tips; the
 * bindings sit at the origin so a rider's feet land on them. Named parts:
 * SkiLeft, SkiRight (each with Base, TopSheet, Binding).
 */
const STATIONS = [
  { x: -0.85, w: 0.05, y: 0.012 },
  { x: -0.6, w: 0.048, y: 0 },
  { x: -0.1, w: 0.042, y: 0 },
  { x: 0.4, w: 0.048, y: 0 },
  { x: 0.75, w: 0.055, y: 0.012 },
  { x: 0.88, w: 0.05, y: 0.045 },
  { x: 0.95, w: 0.035, y: 0.085 },
];

function ski(name: string, base: MeshStandardMaterial, top: MeshStandardMaterial, metal: MeshStandardMaterial): Group {
  const g = new Group();
  g.name = name;
  const alongs = sampleRange(-0.85, 0.95, 24);
  const body = new Mesh(
    LoftSurface.blade(STATIONS.map((s) => ({ x: s.x, leadZ: s.w, trailZ: -s.w, thickUp: 0.009, thickDown: 0.009, y: s.y + 0.009, power: 0.4 }))).build(alongs, 10, true),
    base,
  );
  body.name = 'Base';
  // Colored top sheet: a slightly narrower band rising just through the top.
  const sheet = new Mesh(
    LoftSurface.blade(STATIONS.map((s) => ({ x: s.x, leadZ: s.w * 0.8, trailZ: -s.w * 0.8, thickUp: 0.0105, thickDown: 0, y: s.y + 0.009, power: 0.4 }))).build(alongs, 8, true),
    top,
  );
  sheet.name = 'TopSheet';
  const binding = new Group();
  binding.name = 'Binding';
  const plate = new Mesh(bevelBox(0.34, 0.025, 0.085, 0.006), metal);
  plate.position.set(-0.02, 0.031, 0);
  const toe = new Mesh(bevelBox(0.08, 0.05, 0.08, 0.01), metal);
  toe.position.set(0.15, 0.055, 0);
  const heel = new Mesh(bevelBox(0.09, 0.06, 0.08, 0.01), metal);
  heel.position.set(-0.18, 0.06, 0);
  binding.add(plate, toe, heel);
  g.add(body, sheet, binding);
  // Authored along +X; turn so the tip points +Z.
  g.rotation.y = -Math.PI / 2;
  return g;
}

export function buildSkis(): Group {
  const pair = new Group();
  pair.name = 'Skis';
  const base = new MeshStandardMaterial({ color: new Color(0x1d2230), roughness: 0.4 });
  const top = new MeshStandardMaterial({ color: new Color(0x35e0ff), roughness: 0.25, metalness: 0.1 });
  const metal = new MeshStandardMaterial({ color: new Color(0xc9ced8), roughness: 0.3, metalness: 0.8 });
  const left = ski('SkiLeft', base, top, metal);
  left.position.x = -0.13;
  const right = ski('SkiRight', base, top, metal);
  right.position.x = 0.13;
  pair.add(left, right);
  return pair;
}

export default buildSkis();
