/**
 * A mid-century velvet loveseat (procedural, project-owned): a solid frame with
 * two plump seat cushions, two back cushions, rolled arms, a thin walnut plinth
 * and four tapered walnut legs. Velvet is a physical material with sheen, so it
 * catches the film's light the way real velvet does. Origin at the floor under
 * the centre of the seat front edge; seat faces +Z. 1.9 m wide, seat top 0.45 m.
 */
import { Color, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { bevelBox } from './lib/hardsurface.js';

export const LOVESEAT = { width: 2.6, depth: 0.95, seatTop: 0.45 };

export function buildLoveseat(): Group {
  const root = new Group();
  root.name = 'Loveseat';
  const W = LOVESEAT.width;
  const D = LOVESEAT.depth;
  const velvet = new MeshPhysicalMaterial({
    color: new Color(Palette.sofaVelvet),
    roughness: 0.82,
    sheen: 1,
    sheenRoughness: 0.45,
    sheenColor: new Color(Palette.sofaSheen),
  });
  const walnut = new MeshStandardMaterial({ color: Palette.sofaWood, roughness: 0.45 });
  const z0 = -D; // back edge
  // Frame (base box under the cushions) and the walnut plinth.
  const base = new Mesh(bevelBox(W - 0.1, 0.2, D - 0.05, 0.03), velvet);
  base.position.set(0, 0.2, z0 + D / 2);
  const plinth = new Mesh(bevelBox(W - 0.14, 0.04, D - 0.1, 0.01), walnut);
  plinth.position.set(0, 0.1, z0 + D / 2);
  root.add(base, plinth);
  // Seat cushions (plump, slightly crowned).
  const seatW = (W - 0.34) / 2;
  for (const s of [-1, 1]) {
    const c = new Mesh(bevelBox(seatW - 0.02, 0.15, D - 0.24, 0.06), velvet);
    c.name = s < 0 ? 'SeatLeft' : 'SeatRight';
    c.position.set((s * seatW) / 2, LOVESEAT.seatTop - 0.075, z0 + 0.2 + (D - 0.24) / 2);
    root.add(c);
    // Back cushion, leaning back a little.
    const b = new Mesh(bevelBox(seatW - 0.02, 0.48, 0.18, 0.07), velvet);
    b.position.set((s * seatW) / 2, LOVESEAT.seatTop + 0.22, z0 + 0.16);
    b.rotation.x = -0.12;
    root.add(b);
    // Rolled arm.
    const arm = new Mesh(bevelBox(0.17, 0.3, D - 0.02, 0.07), velvet);
    arm.position.set(s * (W / 2 - 0.085), 0.43, z0 + D / 2);
    const roll = new Mesh(new CylinderGeometry(0.1, 0.1, D - 0.04, 20), velvet);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(s * (W / 2 - 0.085), 0.6, z0 + D / 2);
    root.add(arm, roll);
  }
  // Back panel behind the back cushions.
  const back = new Mesh(bevelBox(W - 0.1, 0.5, 0.12, 0.04), velvet);
  back.position.set(0, 0.55, z0 + 0.06);
  root.add(back);
  // Tapered legs, splayed a touch.
  const leg = new CylinderGeometry(0.025, 0.015, 0.1, 10);
  for (const sx of [-1, 1]) {
    for (const sz of [0, 1]) {
      const l = new Mesh(leg, walnut);
      l.position.set(sx * (W / 2 - 0.12), 0.05, z0 + 0.08 + sz * (D - 0.16));
      l.rotation.z = sx * 0.08;
      root.add(l);
    }
  }
  return root;
}

export default buildLoveseat();
