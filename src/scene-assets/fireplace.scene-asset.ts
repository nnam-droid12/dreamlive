/**
 * A stone fireplace (procedural, project-owned): a fieldstone surround of
 * irregular bevelled stones laid in courses around a sooty firebox, an oak
 * mantel shelf, a stone hearth slab, a plaster chimney breast up to the
 * ceiling, and three logs (the top one glowing with embers). Origin at the
 * floor, centre of the front face; the fire faces +Z. `FireAnchor` marks
 * where the flames sit. About 1.7 m wide, 3 m tall, 0.6 m deep.
 */
import { BackSide, BoxGeometry, BufferGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D } from '@iwsdk/core';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Palette } from '../config/palette.js';
import { bevelBox, makeRandom } from './lib/hardsurface.js';

export function buildFireplace(): Group {
  const root = new Group();
  root.name = 'Fireplace';
  const rand = makeRandom(5);
  const W = 1.7;
  const D = 0.6;
  const openW = 0.9;
  const openH = 0.75;
  // Stones in courses (alternate rows offset), leaving the firebox opening.
  const stones: BufferGeometry[] = [];
  let y = 0.12;
  let row = 0;
  while (y < 1.25) {
    const h = 0.13 + rand() * 0.07;
    let x = -W / 2 + (row % 2 ? 0.08 : 0);
    while (x < W / 2 - 0.05) {
      const w = Math.min(W / 2 - x, 0.2 + rand() * 0.18);
      const cx = x + w / 2;
      const inOpening = Math.abs(cx) < openW / 2 + w / 2 - 0.02 && y < openH + 0.1;
      if (!inOpening) {
        const b = bevelBox(w - 0.015, h - 0.015, 0.1 + rand() * 0.03, 0.018);
        const g = b.index ? b.toNonIndexed() : b;
        g.translate(cx, y + h / 2, (rand() - 0.5) * 0.02);
        if (g.getAttribute('uv')) g.deleteAttribute('uv');
        stones.push(g);
      }
      x += w;
    }
    y += h;
    row++;
  }
  const stoneMat = new MeshStandardMaterial({ color: Palette.fireStone, roughness: 0.95 });
  const surround = new Mesh(mergeGeometries(stones)!, stoneMat);
  surround.name = 'Surround';
  root.add(surround);
  // The body behind the stones, the chimney breast, the firebox, the hearth and the mantel.
  const mortar = new MeshStandardMaterial({ color: new Color(Palette.fireStone).multiplyScalar(0.6), roughness: 1 });
  const body = new Mesh(new BoxGeometry(W, 1.25, 0.12), mortar);
  body.position.set(0, 0.625, -D * 0.8 - 0.06);
  const breast = new Mesh(new BoxGeometry(W * 0.8, 1.7, D * 0.8), new MeshStandardMaterial({ color: Palette.fireChimney, roughness: 0.9 }));
  breast.position.set(0, 1.3 + 0.85, -D * 0.4 - 0.04);
  // The firebox is open at the front: only its inside faces render (back, sides, top, floor).
  const box = new Mesh(new BoxGeometry(openW, openH, D * 0.8), new MeshStandardMaterial({ color: Palette.fireSoot, roughness: 1, side: BackSide }));
  box.position.set(0, 0.12 + openH / 2, -D * 0.4 + 0.005);
  const hearth = new Mesh(bevelBox(W + 0.3, 0.12, 0.55, 0.02), stoneMat);
  hearth.position.set(0, 0.06, 0.12);
  const mantel = new Mesh(bevelBox(W + 0.2, 0.09, 0.3, 0.015), new MeshStandardMaterial({ color: Palette.fireMantel, roughness: 0.6 }));
  mantel.name = 'Mantel';
  mantel.position.set(0, 1.3, 0.0);
  root.add(body, breast, box, hearth, mantel);
  // Logs: two on the bottom, one across the top glowing with embers.
  const bark = new MeshStandardMaterial({ color: Palette.pineBark, roughness: 0.95 });
  const ember = new MeshStandardMaterial({ color: 0x2a1408, emissive: new Color(Palette.fireEmber), emissiveIntensity: 1.4, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const log = new Mesh(new CylinderGeometry(0.06, 0.07, 0.7, 10), i === 2 ? ember : bark);
    log.name = i === 2 ? 'EmberLog' : 'Log';
    log.rotation.set(0, (i - 1) * 0.3, Math.PI / 2);
    log.position.set(0, i === 2 ? 0.3 : 0.2, -0.22 + (i === 1 ? 0.1 : 0));
    root.add(log);
  }
  const anchor = new Object3D();
  anchor.name = 'FireAnchor';
  anchor.position.set(0, 0.24, -0.2);
  root.add(anchor);
  return root;
}

export default buildFireplace();
