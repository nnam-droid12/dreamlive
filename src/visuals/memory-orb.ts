import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
} from '@iwsdk/core';
import { Palette, type PaletteKey } from '../config/palette.js';
import { makeDiscMaterial } from './glow-materials.js';

export const ORB_RADIUS = 0.05;
const MOMENT_COLOR: Record<string, PaletteKey> = {
  surf: 'moonBlue',
  dj: 'pinkSoft',
  ski: 'starWhite',
};

/** The glowing glass keepsake of one dream act (wave blue, party pink, snow white). */
export function buildMemoryOrb(moment: string): Object3D {
  const color = Palette[MOMENT_COLOR[moment] ?? 'starWhite'];
  const orb = new Group();
  orb.name = 'MemoryOrb';
  const shell = new Mesh(
    new SphereGeometry(ORB_RADIUS, 24, 16),
    new MeshStandardMaterial({
      color,
      emissive: new Color(color),
      emissiveIntensity: 0.55,
      roughness: 0.15,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  const halo = new Mesh(new PlaneGeometry(ORB_RADIUS * 5, ORB_RADIUS * 5), makeDiscMaterial(color));
  (halo.material as ShaderMaterial).uniforms.opacity.value = 0.75;
  halo.onBeforeRender = (_r, _s, camera) => halo.quaternion.copy(camera.quaternion);
  const moment3d = new Group();
  moment3d.name = 'Moment';
  moment3d.add(new Mesh(new SphereGeometry(0.016, 16, 12), new MeshBasicMaterial({ color })));
  orb.add(halo, shell, moment3d);
  return orb;
}
