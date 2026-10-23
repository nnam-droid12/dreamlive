/**
 * A big gentle dream fish, ~17 cm long, softly bioluminescent. Origin = body
 * center, nose toward +Z, Y up. "Tail" pivots at the body for a slow wiggle;
 * "Back" marks where the paper boat rides.
 */
import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';

const skin = new MeshStandardMaterial({
  color: Palette.moonBlueSoft,
  emissive: new Color(Palette.moonBlue),
  emissiveIntensity: 0.45,
  roughness: 0.6,
});
const fin = new MeshStandardMaterial({
  color: Palette.moonBlue,
  emissive: new Color(Palette.moonBlue),
  emissiveIntensity: 0.5,
  roughness: 0.7,
  side: DoubleSide,
  transparent: true,
  opacity: 0.85,
});
const spot = new MeshBasicMaterial({ color: Palette.starWhite });
const eye = new MeshBasicMaterial({ color: Palette.indigoDeep });

const bodyGeo = new SphereGeometry(1, 20, 14);
const dotGeo = new SphereGeometry(1, 8, 6);

function finGeo(points: ReadonlyArray<readonly [number, number]>): ShapeGeometry {
  const s = new Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 2) {
    s.quadraticCurveTo(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  }
  return new ShapeGeometry(s, 8);
}
// Fins are drawn in the YZ plane (x = 0), then placed.
const tailGeo = finGeo([[0, 0], [0.03, -0.045], [0.05, -0.02], [0.035, 0], [0.05, 0.02], [0.03, 0.045], [0, 0]]);
const dorsalGeo = finGeo([[0, 0], [0.01, 0.035], [0.045, 0.01], [0.03, 0.004], [0, 0]]);

export function createDreamFish(): Object3D {
  const root = new Group();
  root.name = 'DreamFish';
  const body = new Mesh(bodyGeo, skin);
  body.name = 'Body';
  body.scale.set(0.038, 0.042, 0.075);
  body.castShadow = true;
  root.add(body);
  const tail = new Group();
  tail.name = 'Tail';
  tail.position.z = -0.068;
  const tailFin = new Mesh(tailGeo, fin);
  tailFin.rotation.y = Math.PI / 2;
  tail.add(tailFin);
  const dorsal = new Mesh(dorsalGeo, fin);
  dorsal.name = 'Dorsal';
  dorsal.rotation.y = Math.PI / 2;
  dorsal.position.set(0, 0.036, 0.012);
  root.add(tail, dorsal);
  for (const side of [-1, 1]) {
    const e = new Mesh(dotGeo, eye);
    e.name = side < 0 ? 'EyeL' : 'EyeR';
    e.scale.setScalar(0.0055);
    e.position.set(0.026 * side, 0.01, 0.052);
    root.add(e);
    for (let i = 0; i < 3; i++) {
      const s = new Mesh(dotGeo, spot);
      s.name = 'Spot';
      s.scale.setScalar(0.003);
      s.position.set(0.034 * side, 0.012 - i * 0.008, 0.01 - i * 0.022);
      root.add(s);
    }
  }
  const back = new Group();
  back.name = 'Back';
  back.position.y = 0.04;
  root.add(back);
  return root;
}

export default createDreamFish();
