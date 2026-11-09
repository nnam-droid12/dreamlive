/**
 * A humpback whale (procedural, project-owned): a long streamlined body (a
 * lathe profile, flattened a little top to bottom) with a dark slate back and
 * a pale, ridged throat; the bumpy rostrum, a small dorsal fin, the long
 * white-edged pectoral flippers that humpbacks are known for, and broad tail
 * flukes with a notched trailing edge. Origin at the body centre, nose toward
 * +Z, +Y up; about 13 m long. `Flukes` and the flippers are separate for animation.
 */
import {
  BufferAttribute,
  Color,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  Vector2,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';

const LENGTH = 13;

export function buildWhale(): Group {
  const root = new Group();
  root.name = 'Whale';
  // Body profile along the length (t: 0 tail .. 1 nose), radius in metres.
  const pts: Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const r = t < 0.05 ? 0.12 + t * 4 : 0.32 + 1.25 * Math.sin(Math.min(1, (t - 0.05) / 0.85) * Math.PI * 0.62) * (t > 0.85 ? 1 - ((t - 0.85) / 0.15) ** 2 * 0.75 : 1);
    pts.push(new Vector2(Math.max(0.03, r), (t - 0.5) * LENGTH));
  }
  const g = new LatheGeometry(pts, 28);
  g.rotateX(Math.PI / 2); // length along Z, nose at +Z
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const back = new Color(Palette.whaleBack);
  const belly = new Color(Palette.whaleBelly);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    // A little flatter top to bottom; throat grooves on the pale underside of the front half.
    const y = pos.getY(i) * 0.82;
    const z = pos.getZ(i);
    const x = pos.getX(i);
    const front = Math.max(0, z / (LENGTH / 2));
    const grooves = y < 0 && front > 0.2 ? Math.sin(Math.atan2(y, x) * 26) * 0.02 : 0;
    pos.setY(i, y + grooves);
    const under = Math.min(1, Math.max(0, (-y / 1.1 + 0.15) * (0.4 + front)));
    c.copy(back).lerp(belly, under);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.computeVertexNormals();
  const skin = new MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05 });
  const body = new Mesh(g, skin);
  body.name = 'Body';
  root.add(body);

  // Tubercles (the knobs on a humpback's head).
  const knobMat = new MeshStandardMaterial({ color: Palette.whaleBack, roughness: 0.5 });
  const knob = new SphereGeometry(0.07, 6, 4);
  for (let i = 0; i < 14; i++) {
    const k = new Mesh(knob, knobMat);
    k.position.set((i % 2 ? 1 : -1) * (0.15 + (i % 3) * 0.12), 0.62 - (i % 4) * 0.05, LENGTH / 2 - 0.5 - i * 0.14);
    root.add(k);
  }

  // Dorsal fin.
  const dorsal = new Shape();
  dorsal.moveTo(0, 0);
  dorsal.quadraticCurveTo(0.35, 0.15, 0.5, 0.45);
  dorsal.quadraticCurveTo(0.6, 0.1, 1.1, 0);
  const dGeo = new ExtrudeGeometry(dorsal, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
  dGeo.rotateY(Math.PI / 2);
  const fin = new Mesh(dGeo, knobMat);
  fin.position.set(-0.04, 0.85, -LENGTH * 0.22);
  root.add(fin);

  // Long pectoral flippers (dark above, white beneath and on the leading edge).
  const flipShape = new Shape();
  flipShape.moveTo(0, -0.35);
  flipShape.quadraticCurveTo(2.2, -0.45, 4.2, -0.05);
  flipShape.quadraticCurveTo(2.2, 0.25, 0, 0.35);
  for (const side of [-1, 1]) {
    const fg = new ExtrudeGeometry(flipShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    fg.rotateX(Math.PI / 2);
    const flip = new Mesh(fg, new MeshStandardMaterial({ color: Palette.whaleBelly, roughness: 0.4 }));
    flip.name = side < 0 ? 'FlipperL' : 'FlipperR';
    flip.position.set(side * 0.9, -0.45, LENGTH * 0.18);
    flip.rotation.set(0, side < 0 ? Math.PI + 0.5 : -0.5, side * 0.35);
    root.add(flip);
  }

  // Tail flukes: broad, swept back, notched in the middle.
  const fl = new Shape();
  fl.moveTo(0, 0);
  fl.quadraticCurveTo(1.0, -0.2, 2.2, -1.3);
  fl.quadraticCurveTo(1.4, -0.9, 0.9, -1.0);
  fl.quadraticCurveTo(0.4, -0.95, 0, -0.75);
  fl.quadraticCurveTo(-0.4, -0.95, -0.9, -1.0);
  fl.quadraticCurveTo(-1.4, -0.9, -2.2, -1.3);
  fl.quadraticCurveTo(-1.0, -0.2, 0, 0);
  const flGeo = new ExtrudeGeometry(fl, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
  flGeo.rotateX(Math.PI / 2);
  const flukes = new Mesh(flGeo, new MeshStandardMaterial({ color: Palette.whaleBack, roughness: 0.4 }));
  flukes.name = 'Flukes';
  flukes.position.set(0, 0, -LENGTH / 2 + 0.1);
  root.add(flukes);
  return root;
}

export default buildWhale();
