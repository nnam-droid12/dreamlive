import {
  AssetManager,
  Color,
  EquirectangularReflectionMapping,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from '@iwsdk/core';

/**
 * Real building facades (CC0 photo-based PBR sets from ambientCG, in
 * public/textures/facades): colour, normal and, for the night-capable ones,
 * an emission map of lit windows with interiors. Towers carry
 * `userData.facade` (a key below); `applyFacades` loads the sets and swaps the
 * placeholder material on every tower that asks for one. Facades tile every
 * TILE metres (the geometry's UVs are in metres / TILE).
 */
export type FacadeKey = 'f17' | 'f13' | 'f9' | 'f18a' | 'f19a' | 'f20a' | 'f1' | 'f5';

interface FacadeSpec {
  /** Has a lit-windows emission map; otherwise the colour map glows faintly at night. */
  emit: boolean;
  /** Glass curtain walls reflect the sky. */
  glass: boolean;
  roughness: number;
  metalness: number;
}

export const FACADES: Record<FacadeKey, FacadeSpec> = {
  f17: { emit: true, glass: false, roughness: 0.55, metalness: 0.2 },
  f13: { emit: true, glass: false, roughness: 0.6, metalness: 0.15 },
  f9: { emit: true, glass: true, roughness: 0.25, metalness: 0.6 },
  f18a: { emit: false, glass: false, roughness: 0.75, metalness: 0.05 },
  f19a: { emit: false, glass: false, roughness: 0.45, metalness: 0.35 },
  f20a: { emit: false, glass: false, roughness: 0.6, metalness: 0.2 },
  f1: { emit: false, glass: true, roughness: 0.15, metalness: 0.85 },
  f5: { emit: false, glass: true, roughness: 0.18, metalness: 0.8 },
};

/** Metres of facade per texture tile. */
export const FACADE_TILE = 14;

export interface FacadeSet {
  materials: Map<FacadeKey, MeshStandardMaterial>;
  /** Night amount 0..1: lit windows glow (and plain facades faintly) as night falls. */
  setNight(night: number): void;
}

const load = async (url: string, srgb: boolean): Promise<Texture> => {
  const t = await AssetManager.loadTexture(url);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
};

export async function loadFacades(sky?: Texture): Promise<FacadeSet> {
  const base = `${import.meta.env.BASE_URL}textures/facades/`;
  const materials = new Map<FacadeKey, MeshStandardMaterial>();
  if (sky) {
    sky.mapping = EquirectangularReflectionMapping;
    sky.colorSpace = SRGBColorSpace;
  }
  await Promise.all(
    (Object.keys(FACADES) as FacadeKey[]).map(async (key) => {
      const spec = FACADES[key];
      const [map, normalMap, emit] = await Promise.all([
        load(`${base}${key}_color.webp`, true),
        load(`${base}${key}_normal.webp`, false),
        spec.emit ? load(`${base}${key}_emit.webp`, true) : Promise.resolve(undefined),
      ]);
      const mat = new MeshStandardMaterial({
        map,
        normalMap,
        roughness: spec.roughness,
        metalness: spec.metalness,
        emissive: new Color(0xffffff),
        emissiveMap: emit ?? map,
        emissiveIntensity: 0,
        envMap: spec.glass && sky ? sky : null,
        envMapIntensity: spec.glass ? 0.9 : 0.3,
      });
      mat.name = `Facade_${key}`;
      materials.set(key, mat);
    }),
  );
  return {
    materials,
    setNight(night: number) {
      for (const [key, m] of materials) m.emissiveIntensity = FACADES[key].emit ? 0.25 + 1.35 * night : 0.06 * night;
    },
  };
}
