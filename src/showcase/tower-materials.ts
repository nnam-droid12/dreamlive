import { AssetManager, Color, EquirectangularReflectionMapping, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import type { TowerMaterials } from '../scene-assets/lib/modern-tower.js';

/**
 * Materials for the modern towers. Created plain at once (so the city renders
 * immediately) and dressed when the textures arrive: the sky photo as the
 * glass's reflection, lit-office window maps behind the glass (ambientCG
 * facades' emission), and CC0 concrete and brushed-metal surfaces.
 */
export function createTowerMaterials(): TowerMaterials {
  const glass = (color: number) => new MeshStandardMaterial({ color, metalness: 0.95, roughness: 0.06, emissive: new Color(0xffffff), emissiveIntensity: 0, envMapIntensity: 1.2 });
  return {
    glass: { blue: glass(Palette.towerGlassBlue), dark: glass(Palette.towerGlassDark) },
    stone: new MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    lobby: new MeshStandardMaterial({ color: Palette.towerLobby, metalness: 0.6, roughness: 0.15, emissive: new Color(Palette.windowWarm), emissiveIntensity: 0.25 }),
    concrete: new MeshStandardMaterial({ color: Palette.towerConcrete, roughness: 0.85 }),
    fin: {
      blue: new MeshStandardMaterial({ color: Palette.towerAluminium, metalness: 0.85, roughness: 0.35 }),
      dark: new MeshStandardMaterial({ color: Palette.towerBronze, metalness: 0.85, roughness: 0.4 }),
      stone: new MeshStandardMaterial({ color: Palette.towerConcrete, roughness: 0.8 }),
    },
    crown: new MeshStandardMaterial({ color: Palette.towerCrown, metalness: 0.5, roughness: 0.5 }),
    beacon: new MeshBasicMaterial({ color: Palette.beacon }),
  };
}

const tex = async (url: string, srgb: boolean, repeat = 1): Promise<Texture> => {
  const t = await AssetManager.loadTexture(url);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
};

/** Add the textures (stone towers get their photo facade from facades.ts). */
export async function dressTowerMaterials(m: TowerMaterials, sky: Texture): Promise<void> {
  const b = `${import.meta.env.BASE_URL}textures/`;
  const [blueWin, darkWin, conc, concN, concR, metR] = await Promise.all([
    tex(`${b}facades/f17_emit.webp`, true),
    tex(`${b}facades/f13_emit.webp`, true),
    tex(`${b}building/concrete_color.webp`, true, 2),
    tex(`${b}building/concrete_normal.webp`, false, 2),
    tex(`${b}building/concrete_rough.webp`, false, 2),
    tex(`${b}building/metal_rough.webp`, false, 3),
  ]);
  sky.mapping = EquirectangularReflectionMapping;
  sky.colorSpace = SRGBColorSpace;
  for (const [mat, win] of [[m.glass.blue, blueWin], [m.glass.dark, darkWin]] as const) {
    mat.envMap = sky;
    mat.emissiveMap = win;
    mat.needsUpdate = true;
  }
  m.lobby.envMap = sky;
  m.lobby.needsUpdate = true;
  Object.assign(m.concrete, { map: conc, normalMap: concN, roughnessMap: concR });
  m.concrete.needsUpdate = true;
  for (const f of [m.fin.blue, m.fin.dark]) {
    f.roughnessMap = metR;
    f.envMap = sky;
    f.needsUpdate = true;
  }
}

/** Night amount 0..1: offices light up behind the glass. */
export function towerNight(m: TowerMaterials, night: number): void {
  m.glass.blue.emissiveIntensity = 0.12 + 1.1 * night;
  m.glass.dark.emissiveIntensity = 0.1 + 1.0 * night;
  m.lobby.emissiveIntensity = 0.25 + 0.8 * night;
}
