/**
 * A ceiling fan (procedural, project-owned): a ceiling canopy, a downrod, a
 * turned motor housing, five walnut blades on brushed-nickel irons, and a
 * frosted glass light bowl. The blades (and irons) sit in the `Blades` group,
 * which spins about local Y. Origin at the ceiling (top of the canopy); hangs
 * down -Y; about 1.3 m across the blades and 0.55 m tall.
 */
import { Color, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector2 } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { bevelBox, taperPlate } from './lib/hardsurface.js';

export const CEILING_FAN = { drop: 0.42, span: 1.3 };

export function buildCeilingFan(): Group {
  const root = new Group();
  root.name = 'CeilingFan';
  const nickel = new MeshStandardMaterial({ name: 'FanNickel', color: new Color(Palette.fanNickel), roughness: 0.32, metalness: 0.9 });
  const walnut = new MeshStandardMaterial({ name: 'FanWalnut', color: new Color(Palette.fanWalnut), roughness: 0.5 });
  const glass = new MeshStandardMaterial({ name: 'FanGlass', color: new Color(Palette.fanGlass), roughness: 0.6, emissive: new Color(Palette.fanGlass), emissiveIntensity: 0.15 });
  // Canopy against the ceiling, and the downrod.
  const canopy = new Mesh(new LatheGeometry([new Vector2(0.02, 0), new Vector2(0.075, 0), new Vector2(0.08, -0.01), new Vector2(0.06, -0.07), new Vector2(0.02, -0.08)], 32), nickel);
  canopy.name = 'Canopy';
  const rod = new Mesh(new CylinderGeometry(0.012, 0.012, 0.24, 12), nickel);
  rod.name = 'Downrod';
  rod.position.y = -0.08 - 0.12;
  // The motor housing: a turned, slightly bellied drum.
  const housing = new Mesh(new LatheGeometry([new Vector2(0.03, 0), new Vector2(0.1, -0.015), new Vector2(0.125, -0.05), new Vector2(0.125, -0.09), new Vector2(0.105, -0.12), new Vector2(0.06, -0.135), new Vector2(0.03, -0.14)], 40), nickel);
  housing.name = 'MotorHousing';
  housing.position.y = -0.3;
  // The light bowl under it.
  const bowl = new Mesh(new SphereGeometry(0.085, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glass);
  bowl.name = 'LightBowl';
  bowl.position.y = -0.44;
  root.add(canopy, rod, housing, bowl);
  // Five blades on irons, pitched a little, all spinning together.
  const blades = new Group();
  blades.name = 'Blades';
  blades.position.y = -0.37;
  const bladeGeo = taperPlate(0.5, 0.12, 0.15, 0.008, 0.003);
  const ironGeo = bevelBox(0.16, 0.012, 0.03, 0.004);
  for (let i = 0; i < 5; i++) {
    const arm = new Group();
    arm.name = `Blade${i}`;
    arm.rotation.y = (i * Math.PI * 2) / 5;
    const iron = new Mesh(ironGeo, nickel);
    iron.position.set(0.17, 0.006, 0);
    const blade = new Mesh(bladeGeo, walnut);
    // taperPlate lies in its XY plane: turn it flat (XZ) and pitch it 10 degrees.
    blade.rotation.set(-Math.PI / 2 + 0.17, 0, 0);
    blade.position.set(0.24 + 0.25, -0.002, 0);
    arm.add(iron, blade);
    blades.add(arm);
  }
  root.add(blades);
  return root;
}

export default buildCeilingFan();
