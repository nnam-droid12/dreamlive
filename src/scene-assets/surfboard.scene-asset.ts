import { Color, Group, Mesh, MeshStandardMaterial } from '@iwsdk/core';
import { LoftSurface, sampleRange, taperPlate } from './lib/hardsurface.js';

/**
 * A shortboard for the surf dream. Origin at the deck center, long axis +X
 * (nose at +X), deck up (+Y). 2.0 m long, 0.56 m wide. The rider stands across
 * it facing +Z. Named parts: Deck, Stringer, NosePatch, Fins.
 */
const STATIONS = [
  { x: -1.0, w: 0.15, y: 0.03 },
  { x: -0.8, w: 0.22, y: 0.01 },
  { x: -0.4, w: 0.27, y: 0 },
  { x: 0.0, w: 0.28, y: 0 },
  { x: 0.4, w: 0.25, y: 0.012 },
  { x: 0.7, w: 0.18, y: 0.04 },
  { x: 0.9, w: 0.09, y: 0.09 },
  { x: 1.0, w: 0.015, y: 0.14 },
];

function blade(widthScale: number, up: number, down: number, lift = 0) {
  return LoftSurface.blade(
    STATIONS.map((s) => ({
      x: s.x,
      leadZ: s.w * widthScale,
      trailZ: -s.w * widthScale,
      thickUp: up * (s.x > 0.85 ? 0.6 : 1),
      thickDown: down * (s.x > 0.85 ? 0.6 : 1),
      y: s.y + lift,
      power: 0.6,
    })),
  );
}

export function buildSurfboard(): Group {
  const board = new Group();
  board.name = 'Surfboard';
  const alongs = sampleRange(-1, 1, 28);
  const deckMat = new MeshStandardMaterial({ color: new Color(0xfff4e2), roughness: 0.35 });
  const stripeMat = new MeshStandardMaterial({ color: new Color(0xff6a3d), roughness: 0.4 });
  const finMat = new MeshStandardMaterial({ color: new Color(0x1f3b63), roughness: 0.3 });

  const deck = new Mesh(blade(1, 0.032, 0.026).build(alongs, 18, true), deckMat);
  deck.name = 'Deck';
  // The stringer and nose patch are thin bands that rise just through the deck.
  const stringer = new Mesh(blade(0.06, 0.035, 0.0).build(alongs, 8, true), stripeMat);
  stringer.name = 'Stringer';
  const nose = new Mesh(
    LoftSurface.blade(
      STATIONS.filter((s) => s.x >= 0.7).map((s) => ({
        x: s.x, leadZ: s.w * 0.9, trailZ: -s.w * 0.9, thickUp: 0.022, thickDown: 0, y: s.y + 0.001, power: 0.6,
      })),
    ).build(sampleRange(0.7, 1, 8), 12, true),
    stripeMat,
  );
  nose.name = 'NosePatch';

  // Thruster fins under the tail: vertical plates in the board's own frame.
  const fins = new Group();
  fins.name = 'Fins';
  for (const [x, z, h] of [[-0.86, 0, 0.13], [-0.74, 0.15, 0.11], [-0.74, -0.15, 0.11]] as const) {
    const fin = new Mesh(taperPlate(0.13, h, 0.03, 0.008, 0.002), finMat);
    fin.position.set(x, 0.03 - h / 2 - 0.02, z);
    fins.add(fin);
  }
  board.add(deck, stringer, nose, fins);
  board.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = true;
  });
  return board;
}

export default buildSurfboard();
