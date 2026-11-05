/**
 * Landmark: an art-deco spire tower (generic, not a copy of any real building).
 * A limestone shaft rises in two setbacks with vertical piers, to a stepped
 * crown of three tiers with glowing gilded arches, a needle spire and a red
 * aircraft beacon. Origin at the base centre, +Y up; about 22 m wide, 96 m tall.
 */
import { ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, BoxGeometry } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { archTexture, cellBox, facadeMaterial, windowTexture } from './lib/skyline.js';

const CELL_W = 2.2;
const CELL_H = 3.4;
/** Shaft tiers: [width, height] stacked from the ground. */
const TIERS: readonly [number, number][] = [[22, 54], [16, 14], [11, 9]];
/** Crown tiers with arches: [width, height]. */
const CROWN: readonly [number, number][] = [[8.4, 4.2], [6.4, 3.6], [4.4, 3.2]];

export function buildDecoTower(): Group {
  const root = new Group();
  root.name = 'DecoTower';
  const windows = windowTexture(11, 0.42, Palette.windowWarm);
  const stone = facadeMaterial(Palette.decoStone, windows, 1.1, 0.05, 0.9);
  const pierMat = new MeshStandardMaterial({ color: Palette.decoStone, roughness: 0.9 });
  const arches = archTexture();
  const crownMat = new MeshStandardMaterial({ color: 0x3a3226, roughness: 0.6, metalness: 0.4, emissive: Palette.decoGold, emissiveMap: arches, emissiveIntensity: 1.6 });

  const shaft = new Group();
  shaft.name = 'Shaft';
  root.add(shaft);
  let y = 0;
  const pierGeo = new BoxGeometry(0.7, 1, 0.7);
  pierGeo.translate(0, 0.5, 0);
  let pierCount = 0;
  for (const [w] of TIERS) pierCount += Math.floor(w / CELL_W) * 4;
  const piers = new InstancedMesh(pierGeo, pierMat, pierCount);
  piers.name = 'Piers';
  const m = new Matrix4();
  let p = 0;
  TIERS.forEach(([w, h], i) => {
    const tier = new Mesh(cellBox(w, h, w, CELL_W, CELL_H), stone);
    tier.name = `Tier${i + 1}`;
    tier.position.y = y;
    shaft.add(tier);
    // Vertical piers between the window columns, on all four faces, standing proud of the wall.
    const n = Math.floor(w / CELL_W);
    for (let k = 0; k < n; k++) {
      const a = -w / 2 + (k + 0.5) * (w / n);
      for (const [x, z] of [[a, w / 2], [a, -w / 2], [w / 2, a], [-w / 2, a]]) {
        m.makeScale(1, h + 0.6, 1).setPosition(x, y, z);
        piers.setMatrixAt(p++, m);
      }
    }
    // A parapet ledge marks each setback.
    const ledge = new Mesh(cellBox(w + 0.8, 0.6, w + 0.8, 100, 100), pierMat);
    ledge.name = `Setback${i + 1}`;
    ledge.position.y = y + h;
    shaft.add(ledge);
    y += h + 0.6;
  });
  piers.count = p;
  shaft.add(piers);

  // The crown: three stepped tiers of glowing arches.
  const crown = new Group();
  crown.name = 'Crown';
  root.add(crown);
  CROWN.forEach(([w, h], i) => {
    const tier = new Mesh(cellBox(w, h, w, w / 4, h), crownMat);
    tier.name = `CrownTier${i + 1}`;
    tier.position.y = y;
    crown.add(tier);
    y += h;
  });
  // Needle spire and beacon.
  const spire = new Mesh(new ConeGeometry(1.4, 12, 8), new MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.35, metalness: 0.8, emissive: Palette.decoGold, emissiveIntensity: 0.25 }));
  spire.name = 'Spire';
  spire.position.y = y + 6;
  crown.add(spire);
  const mast = new Mesh(new CylinderGeometry(0.15, 0.15, 3, 6), pierMat);
  mast.name = 'Mast';
  mast.position.y = y + 13;
  crown.add(mast);
  const beacon = new Mesh(new SphereGeometry(0.45, 10, 8), new MeshBasicMaterial({ color: Palette.beacon }));
  beacon.name = 'Beacon';
  beacon.position.y = y + 14.6;
  crown.add(beacon);
  return root;
}

export default buildDecoTower();
