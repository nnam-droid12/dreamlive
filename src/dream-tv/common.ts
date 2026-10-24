/**
 * Building blocks shared by the dream scenes shown inside the TV.
 * Each scene is its own little world, rendered through the TV like a window.
 */
import {
  AssetManager,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Texture,
} from '@iwsdk/core';

export interface DreamTvScene {
  key: string;
  scene: Scene;
  /** Where Bigfoot stands in this scene (he is moved here when it starts). */
  slot: Object3D;
  /** Camera framing: eye position and look target (scene space). */
  eye: [number, number, number];
  target: [number, number, number];
  /** Bigfoot's animation while this scene plays. */
  pose: 'idle' | 'dance' | 'wave' | 'walk' | 'jump';
  update(t: number, delta: number): void;
}

let skyline: Promise<Texture | null> | undefined;
export function loadSkyline(): Promise<Texture | null> {
  skyline ??= AssetManager.loadTexture(`${import.meta.env.BASE_URL}env/nyc-skyline.webp`)
    .then((t) => {
      t.colorSpace = SRGBColorSpace;
      return t;
    })
    .catch(() => null);
  return skyline;
}

/** Vertical gradient sky as a canvas texture. */
export function gradientTexture(top: string, bottom: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A new scene with sky gradient, skyline backdrop and soft lighting. */
export function baseScene(sky: [string, string], skylineTex: Texture | null, skylineY = 4): Scene {
  const s = new Scene();
  s.background = gradientTexture(sky[0], sky[1]);
  if (skylineTex) {
    const city = new Mesh(new PlaneGeometry(90, 60), new MeshBasicMaterial({ map: skylineTex }));
    city.position.set(0, skylineY, -40);
    s.add(city);
  }
  s.add(new HemisphereLight(0xcfd8ff, 0x2a2230, 1.1));
  const key = new DirectionalLight(0xfff0e0, 1.6);
  key.position.set(3, 6, 5);
  s.add(key);
  return s;
}

/** Twinkly sparkles scattered in a box; returns the Points to animate. */
export function sparkles(count: number, size: number, color: number, box: [number, number, number], center: [number, number, number]): Points {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (((i * 0.618034) % 1) - 0.5) * box[0];
    pos[i * 3 + 1] = center[1] + (((i * 0.754877) % 1) - 0.5) * box[1];
    pos[i * 3 + 2] = center[2] + (((i * 0.569840) % 1) - 0.5) * box[2];
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  return new Points(g, new PointsMaterial({ color: new Color(color), size, transparent: true, opacity: 0.9, depthWrite: false }));
}
