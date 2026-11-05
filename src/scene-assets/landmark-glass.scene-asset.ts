/**
 * Landmark: a slim glass supertall (generic). A square shaft of blue-black
 * glass tapers as it rises, scattered floors lit cool white, up to an open
 * crown frame with a glowing ring, a mast and a red aircraft beacon.
 * Origin at the base centre, +Y up; 13 m wide at the base, about 150 m tall.
 */
import { CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { facadeMaterial, windowTexture } from './lib/skyline.js';

const BASE = 13;
const TOP = 9;
const HEIGHT = 132;
const CROWN = 9;
const CELL_W = 1.6;
const CELL_H = 3.6;

/** A square prism tapering from `w0` to `w1` (CylinderGeometry with four sides, turned square to the axes). */
function taperedSquare(w0: number, w1: number, h: number, cells: boolean, open = false): CylinderGeometry {
  const g = new CylinderGeometry((w1 / 2) * Math.SQRT2, (w0 / 2) * Math.SQRT2, h, 4, 1, open);
  g.rotateY(Math.PI / 4);
  g.translate(0, h / 2, 0);
  if (cells) {
    // Count window cells around and up, so the panes keep their size on a tapering face.
    const uv = g.getAttribute('uv');
    const around = (2 * (w0 + w1)) / CELL_W;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around, uv.getY(i) * (h / CELL_H));
    uv.needsUpdate = true;
  }
  return g;
}

export function buildGlassSupertall(): Group {
  const root = new Group();
  root.name = 'GlassSupertall';
  const windows = windowTexture(29, 0.2, Palette.windowCool);
  const glass = facadeMaterial(Palette.supertallGlass, windows, 0.9, 0.85, 0.18);
  const frameMat = new MeshStandardMaterial({ color: 0x2a3140, roughness: 0.4, metalness: 0.8 });

  const shaft = new Mesh(taperedSquare(BASE, TOP, HEIGHT, true), glass);
  shaft.name = 'Shaft';
  root.add(shaft);

  // Open crown: the glass walls continue as a hollow frame, with a glowing ring inside.
  const crown = new Group();
  crown.name = 'Crown';
  crown.position.y = HEIGHT;
  root.add(crown);
  const skirt = new Mesh(taperedSquare(TOP, TOP - 0.8, CROWN, false, true), new MeshStandardMaterial({ color: Palette.supertallGlass, roughness: 0.2, metalness: 0.9, transparent: true, opacity: 0.55, side: DoubleSide }));
  skirt.name = 'CrownSkirt';
  crown.add(skirt);
  const ring = new Mesh(taperedSquare(TOP - 0.6, TOP - 0.7, 0.8, false, true), new MeshBasicMaterial({ color: Palette.windowCool, side: DoubleSide }));
  ring.name = 'GlowRing';
  ring.position.y = CROWN * 0.55;
  crown.add(ring);
  const cap = new Mesh(taperedSquare(TOP - 0.8, TOP - 0.9, 0.5, false), frameMat);
  cap.name = 'CrownCap';
  cap.position.y = CROWN;
  crown.add(cap);
  const mast = new Mesh(new CylinderGeometry(0.25, 0.35, 10, 6), frameMat);
  mast.name = 'Mast';
  mast.position.y = CROWN + 5;
  crown.add(mast);
  const beacon = new Mesh(new SphereGeometry(0.5, 10, 8), new MeshBasicMaterial({ color: Palette.beacon }));
  beacon.name = 'Beacon';
  beacon.position.y = CROWN + 10.4;
  crown.add(beacon);
  return root;
}

export default buildGlassSupertall();
