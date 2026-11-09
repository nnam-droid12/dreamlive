/**
 * A New York yellow cab (procedural, project-owned): a mid-size sedan body in
 * taxi yellow with a darker lower sill, glass greenhouse, chrome-trimmed
 * windows, the black checker stripe along the doors, the roof sign, four
 * wheels with silver hubs, headlights and tail lights. Origin on the road under
 * the centre of the car; front toward +Z. About 4.9 m long.
 */
import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { bevelBox } from './lib/hardsurface.js';

export function buildTaxi(): Group {
  const root = new Group();
  root.name = 'Taxi';
  const paint = new MeshStandardMaterial({ color: Palette.taxiYellow, roughness: 0.3, metalness: 0.35 });
  const sill = new MeshStandardMaterial({ color: Palette.taxiSill, roughness: 0.6 });
  const glass = new MeshStandardMaterial({ color: Palette.taxiGlass, roughness: 0.08, metalness: 0.6 });
  const black = new MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const L = 4.9;
  const W = 1.85;
  // Lower body, sill, and the cabin.
  const body = new Mesh(bevelBox(W, 0.62, L, 0.12), paint);
  body.position.y = 0.62;
  const under = new Mesh(bevelBox(W - 0.06, 0.16, L - 0.2, 0.04), sill);
  under.position.y = 0.32;
  const cabin = new Mesh(bevelBox(W - 0.2, 0.5, 2.5, 0.16), glass);
  cabin.position.set(0, 1.15, -0.2);
  const roof = new Mesh(bevelBox(W - 0.28, 0.06, 2.1, 0.03), paint);
  roof.position.set(0, 1.42, -0.25);
  root.add(body, under, cabin, roof);
  // Checker stripe along both sides, and the roof sign (glowing).
  for (const s of [-1, 1]) {
    const stripe = new Mesh(bevelBox(0.01, 0.07, 2.6, 0.005), black);
    stripe.position.set((s * W) / 2 + s * 0.005, 0.66, -0.1);
    root.add(stripe);
  }
  const sign = new Mesh(bevelBox(0.7, 0.2, 0.28, 0.04), new MeshStandardMaterial({ color: 0xfff6d8, emissive: Palette.taxiSign, emissiveIntensity: 1.4, roughness: 0.4 }));
  sign.position.set(0, 1.56, -0.3);
  root.add(sign);
  // Wheels with silver hubs.
  const tyre = new CylinderGeometry(0.34, 0.34, 0.24, 18);
  tyre.rotateZ(Math.PI / 2);
  const hub = new CylinderGeometry(0.2, 0.2, 0.25, 14);
  hub.rotateZ(Math.PI / 2);
  const chrome = new MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.25 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const t = new Mesh(tyre, black);
      t.position.set(sx * (W / 2 - 0.08), 0.34, sz * 1.5);
      const h = new Mesh(hub, chrome);
      h.position.copy(t.position);
      root.add(t, h);
    }
  }
  // Head and tail lights.
  const head = new MeshBasicMaterial({ color: 0xfff1d0 });
  const tail = new MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const hl = new Mesh(bevelBox(0.32, 0.12, 0.04, 0.02), head);
    hl.position.set(s * 0.62, 0.72, L / 2 + 0.01);
    const tl = new Mesh(bevelBox(0.3, 0.1, 0.04, 0.02), tail);
    tl.position.set(s * 0.64, 0.74, -L / 2 - 0.01);
    root.add(hl, tl);
  }
  return root;
}

export default buildTaxi();
