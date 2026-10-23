/**
 * Paper lighthouse on a little rock, ~23 cm tall. Origin = base center on the
 * table; "Lantern" (y ≈ 0.19) is where the light, beam and Dream Seed sit.
 */
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';

const paper = new MeshStandardMaterial({ color: Palette.paper, roughness: 0.95, flatShading: true });
const stripe = new MeshStandardMaterial({ color: Palette.pinkSoft, roughness: 0.9, flatShading: true });
const roof = new MeshStandardMaterial({ color: Palette.indigo, roughness: 0.8, flatShading: true });
const rock = new MeshStandardMaterial({
  color: Palette.paperShade,
  emissive: new Color(Palette.moonBlue),
  emissiveIntensity: 0.08,
  roughness: 1,
  flatShading: true,
});
const lanternGlass = new MeshBasicMaterial({ color: Palette.lanternGlow });

const TOWER_H = 0.15;
const towerGeo = new CylinderGeometry(0.019, 0.03, TOWER_H, 12, 1);
const bandGeo = new CylinderGeometry(1, 1, 0.014, 12, 1, true);
const galleryGeo = new TorusGeometry(0.026, 0.003, 4, 16);
const lanternGeo = new CylinderGeometry(0.013, 0.013, 0.028, 10);
const roofGeo = new ConeGeometry(0.022, 0.028, 10);
const rockGeo = new DodecahedronGeometry(0.05, 0);

export const LANTERN_HEIGHT = 0.024 + TOWER_H + 0.017;

export function createLighthouse(): Object3D {
  const root = new Group();
  root.name = 'Lighthouse';
  const base = new Mesh(rockGeo, rock);
  base.name = 'Rock';
  base.scale.set(1, 0.5, 0.85);
  base.castShadow = true;
  const tower = new Mesh(towerGeo, paper);
  tower.name = 'Tower';
  tower.position.y = 0.024 + TOWER_H / 2;
  tower.castShadow = true;
  root.add(base, tower);
  for (const [y, r] of [[0.06, 0.0265], [0.12, 0.022]] as const) {
    const band = new Mesh(bandGeo, stripe);
    band.name = 'Band';
    band.position.y = y;
    band.scale.set(r, 1, r);
    root.add(band);
  }
  const gallery = new Mesh(galleryGeo, roof);
  gallery.name = 'Gallery';
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = 0.024 + TOWER_H + 0.001;
  const lantern = new Mesh(lanternGeo, lanternGlass);
  lantern.name = 'Lantern';
  lantern.position.y = LANTERN_HEIGHT;
  const cap = new Mesh(roofGeo, roof);
  cap.name = 'Roof';
  cap.position.y = LANTERN_HEIGHT + 0.028;
  cap.castShadow = true;
  root.add(gallery, lantern, cap);
  return root;
}

export default createLighthouse();
