/**
 * The showcase room: a New York high-rise bedroom at night (desktop emulator,
 * screenshots, demo video). Shapes are simple manufactured forms; realism comes
 * from photo-scanned CC0 materials (Poly Haven), image-based lighting and a real
 * skyline photo (Unsplash) outside floor-to-ceiling glass.
 *
 * World layout (meters): the TV wall is at -Z, the window wall at +X, the bed
 * to the left. The seated viewer (`seat`) is turned so the bed and the TV both
 * fit inside the 60° comfortable field of view.
 */
import {
  AssetManager,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
} from '@iwsdk/core';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';
import { makeDissolving } from '../visuals/dissolve.js';

export const NycLayout = {
  room: { minX: -3.4, maxX: 3.6, minZ: -4.2, maxZ: 2.2, height: 3.0 },
  tv: { center: new Vector3(0.2, 1.45, -4.165), width: 2.2, height: 1.24 },
  /** Top of the king mattress where Bigfoot sleeps (center), and the bed's long axis (+X). */
  bed: { top: new Vector3(-2.25, 0.62, -1.9), length: 2.3, width: 2.0 },
  sideTable: { center: new Vector3(1.06, 0.6, -0.5), radius: 0.28 },
  /** The viewer's chair (floor point) and facing (yaw, radians; 0 = -Z, negative = right):
   * turned between the bed and the window, where the Rooftop Party plays out. */
  seat: { position: new Vector3(-0.8, 0, 1.0), yaw: -0.7 },
  /** The window bay Bigfoot slides open: floor point at its center on the glass. */
  window: { origin: new Vector3(3.6, 0, -1.8), out: new Vector3(1, 0, 0), along: new Vector3(0, 0, 1), width: 1.6, bays: [-1.8, -0.2] },
} as const;

type MapSet = { diff?: Texture; nor?: Texture; arm?: Texture };

async function loadSet(id: string, maps: Array<keyof MapSet> = ['diff', 'nor', 'arm']): Promise<MapSet> {
  const base = `${import.meta.env.BASE_URL}textures/${id}/`;
  const out: MapSet = {};
  await Promise.all(
    maps.map(async (m) => {
      try {
        const t = await AssetManager.loadTexture(`${base}${m}.webp`);
        t.wrapS = t.wrapT = RepeatWrapping;
        if (m === 'diff') t.colorSpace = SRGBColorSpace;
        out[m] = t;
      } catch {
        // A missing map only lowers fidelity.
      }
    }),
  );
  return out;
}

/** PBR material from a map set; `tile` = meters per texture repeat (UVs are in meters). */
function pbr(set: MapSet, tile: number, params: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) {
  const rep = (t?: Texture) => {
    if (!t) return undefined;
    const c = t.clone();
    c.repeat.set(1 / tile, 1 / tile);
    c.needsUpdate = true;
    return c;
  };
  const arm = rep(set.arm);
  // Wood, plaster and fabric are dielectric: use the scan's AO + roughness, never its metal channel.
  return new MeshStandardMaterial({
    map: rep(set.diff) ?? null,
    normalMap: rep(set.nor),
    aoMap: arm,
    roughnessMap: arm,
    metalness: 0,
    roughness: 1,
    ...params,
  });
}

/** A plane whose UVs are in meters (so materials tile at real scale). */
function meterPlane(w: number, h: number): PlaneGeometry {
  const g = new PlaneGeometry(w, h);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}

function place(o: Object3D, x: number, y: number, z: number, ry = 0): Object3D {
  o.position.set(x, y, z);
  o.rotation.y = ry;
  return o;
}

const walnut = new MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.5, metalness: 0 });
const graphite = new MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.35, metalness: 0.6 });
const brushedMetal = new MeshStandardMaterial({ color: 0x8c8f94, roughness: 0.3, metalness: 1 });

/** Builds the bedroom. Resolves once its textures are loaded. */
export async function buildNycBedroom(): Promise<Group> {
  const [parquet, plaster, linen, cotton, velvet, wool] = await Promise.all([
    loadSet('herringbone_parquet'),
    loadSet('painted_plaster_wall'),
    loadSet('rough_linen'),
    loadSet('cotton_jersey'),
    loadSet('velour_velvet', ['nor', 'arm']),
    loadSet('poly_wool_herringbone'),
  ]);
  const skyline = await AssetManager.loadTexture(`${import.meta.env.BASE_URL}env/nyc-skyline.webp`);
  skyline.colorSpace = SRGBColorSpace;

  const R = NycLayout.room;
  const W = R.maxX - R.minX;
  const D = R.maxZ - R.minZ;
  const cx = (R.minX + R.maxX) / 2;
  const cz = (R.minZ + R.maxZ) / 2;
  const room = new Group();
  room.name = 'NycBedroom';
  const add = (o: Object3D, shadow = true) => {
    o.traverse((m) => {
      if ((m as Mesh).isMesh) {
        m.castShadow = shadow;
        m.receiveShadow = true;
      }
    });
    room.add(o);
    return o;
  };

  // Shell: herringbone parquet, plaster walls and ceiling.
  // Satin finish: the scan's own roughness reads as wet puddles under point lights.
  const floor = new Mesh(meterPlane(W, D), pbr(parquet, 1.4, { roughnessMap: null, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  add(floor, false);
  const wallMat = pbr(plaster, 2.2, { color: new Color(0xefe9e1) });
  const front = new Mesh(meterPlane(W, R.height), wallMat);
  add(place(front, cx, R.height / 2, R.minZ), false);
  const back = new Mesh(meterPlane(W, R.height), wallMat);
  add(place(back, cx, R.height / 2, R.maxZ, Math.PI), false);
  const left = new Mesh(meterPlane(D, R.height), wallMat);
  add(place(left, R.minX, R.height / 2, cz, Math.PI / 2), false);
  // The ceiling opens into the night sky when the dream transforms the room.
  const ceilingMat = new MeshStandardMaterial({ color: 0xf4f0ea, roughness: 0.95 });
  const ceiling = new Mesh(meterPlane(W, D), ceilingMat);
  ceiling.name = 'DreamCeiling';
  ceiling.userData.dissolve = makeDissolving(ceilingMat, 0xbfd4ff);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, R.height, cz);
  add(ceiling, false);
  // Recessed downlights (warm, no shadows) plus a soft fill, so walls read as warm plaster.
  for (const z of [-3.0, -1.2, 0.6]) {
    const light = new Mesh(new CircleGeometry(0.06, 24), new MeshBasicMaterial({ color: 0xfff1d6 }));
    light.name = 'Downlight';
    light.rotation.x = Math.PI / 2;
    light.position.set(0, R.height - 0.002, z);
    const down = new PointLight(0xffe2c0, 1.1, 4.5, 1.6);
    down.position.set(0, R.height - 0.15, z);
    room.add(light, down);
  }
  room.add(new HemisphereLight(0xfff1e2, 0x3b2f26, 0.75));

  // Window wall: floor-to-ceiling glass, slim black mullions, Manhattan beyond.
  const glass = new MeshStandardMaterial({
    color: 0x0a0f18,
    roughness: 0.04,
    metalness: 0.9,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: DoubleSide,
  });
  // One pane per bay between mullions; the bay at the window frame slides open.
  const bay = D / 4;
  const win = NycLayout.window;
  for (let i = 0; i < 4; i++) {
    const z = R.minZ + bay * (i + 0.5);
    const pane = new Mesh(new PlaneGeometry(bay - 0.02, R.height), glass);
    // The two middle bays can slide (Bigfoot leaves through the one drawn); the end bays sit behind curtains.
    const sliding = i === 1 || i === 2;
    if (sliding) {
      // Its own group so it can slide along the wall, just inside the fixed panes.
      const door = new Group();
      door.name = Math.abs(z - win.origin.z) < bay / 2 ? 'SlidingPane' : `SlidingPane_${i}`;
      door.userData.bayZ = z;
      door.add(place(pane, 0, 0, 0, -Math.PI / 2));
      door.position.set(R.maxX - 0.03, R.height / 2, z);
      room.add(door);
    } else {
      room.add(place(pane, R.maxX, R.height / 2, z, -Math.PI / 2));
    }
  }
  // Until the dream, a plain plaster wall hides the glass: an ordinary bedroom. It dissolves
  // where Bigfoot's window is drawn, then all the way, into a penthouse over New York.
  const veilMat = wallMat.clone();
  const veil = new Mesh(meterPlane(D, R.height), veilMat);
  veil.name = 'DreamVeil';
  veil.userData.dissolve = makeDissolving(veilMat);
  room.add(place(veil, R.maxX - 0.06, R.height / 2, cz, -Math.PI / 2));
  const mullionGeo = new BoxGeometry(0.05, R.height, 0.05);
  for (let z = R.minZ; z <= R.maxZ + 1e-3; z += D / 4) add(place(new Mesh(mullionGeo, graphite), R.maxX, R.height / 2, z));
  add(place(new Mesh(new BoxGeometry(0.06, 0.06, D), graphite), R.maxX, 0.03, cz));
  add(place(new Mesh(new BoxGeometry(0.06, 0.06, D), graphite), R.maxX, R.height - 0.03, cz));
  const city = new Mesh(new PlaneGeometry(150, 100), new MeshBasicMaterial({ map: skyline, color: 0xd8d8d8 }));
  city.name = 'Skyline';
  room.add(place(city, R.maxX + 45, 6, cz - 6, -Math.PI / 2));

  // Plasma TV on the front wall, media console beneath.
  const tv = NycLayout.tv;
  const frame = new Mesh(bevelBox(tv.width + 0.02, tv.height + 0.02, 0.035, 0.004), graphite);
  add(place(frame, tv.center.x, tv.center.y, R.minZ + 0.03));
  const screen = new Mesh(
    new PlaneGeometry(tv.width, tv.height),
    new MeshStandardMaterial({ color: 0x050608, roughness: 0.07, metalness: 0.3 }),
  );
  screen.name = 'TvScreen';
  room.add(place(screen, tv.center.x, tv.center.y, tv.center.z));
  add(place(new Mesh(bevelBox(2.9, 0.42, 0.42, 0.012), walnut), tv.center.x, 0.27, R.minZ + 0.23));
  for (const dx of [-1, 1]) {
    add(place(new Mesh(new CylinderGeometry(0.012, 0.012, 0.06, 8), brushedMetal), tv.center.x + dx * 1.35, 0.03, R.minZ + 0.23));
  }

  buildBed(room, add, { linen, cotton, velvet, wool });
  buildSideTable(add);
  buildDecor(room, add, linen);
  await placeModels(add);
  return room;
}

type Adder = (o: Object3D, shadow?: boolean) => Object3D;

/** Queen bed against the left wall: velvet base and headboard, cotton, linen, wool. */
function buildBed(
  room: Group,
  add: Adder,
  m: { linen: MapSet; cotton: MapSet; velvet: MapSet; wool: MapSet },
): void {
  const R = NycLayout.room;
  const bed = NycLayout.bed;
  const x0 = R.minX;
  const z = bed.top.z;
  const xMid = x0 + bed.length / 2;
  const velvetMat = pbr(m.velvet, 0.6, { color: new Color(0x2f3d55) });
  const cottonMat = pbr(m.cotton, 0.5, { color: new Color(0xf4f1ec) });
  const linenMat = pbr(m.linen, 0.6, { color: new Color(0xd6cdbf) });
  const woolMat = pbr(m.wool, 0.5, { color: new Color(0xc9a27a) });

  add(place(new Mesh(bevelBox(bed.length + 0.05, 0.28, bed.width + 0.1, 0.025, 0.04), velvetMat), xMid, 0.2, z));
  add(place(new Mesh(bevelBox(0.09, 1.15, bed.width + 0.2, 0.03, 0.06), velvetMat), x0 + 0.045, 0.62, z));
  add(place(new Mesh(bevelBox(bed.length - 0.05, 0.24, bed.width, 0.06, 0.08), cottonMat), xMid + 0.02, 0.46, z));
  // Duvet over the lower two thirds, draping a little past the mattress.
  add(place(new Mesh(bevelBox(1.45, 0.08, bed.width + 0.12, 0.035, 0.05), linenMat), x0 + bed.length - 0.72, 0.6, z));
  add(place(new Mesh(bevelBox(0.42, 0.035, bed.width + 0.16, 0.014, 0.02), woolMat), x0 + bed.length - 0.3, 0.65, z));
  for (const side of [-1, 1]) {
    const pillow = new Mesh(bevelBox(0.46, 0.16, 0.78, 0.06, 0.08), cottonMat);
    pillow.rotation.z = -0.12;
    add(place(pillow, x0 + 0.32, 0.64, z + side * 0.48));
  }
  // Rug under the foot of the bed.
  add(place(new Mesh(bevelBox(2.9, 0.012, 2.5, 0.004, 0.02), woolMat), x0 + 1.7, 0.006, z), false);

  // Walnut nightstands; the far one carries a warm lamp (the room's main light).
  const side = bed.width / 2 + 0.32;
  for (const dz of [-side, side]) {
    add(place(new Mesh(bevelBox(0.45, 0.5, 0.42, 0.012), walnut), x0 + 0.26, 0.25, z + dz));
  }
  const lamp = new Group();
  lamp.name = 'BedsideLamp';
  const base = new Mesh(new CylinderGeometry(0.05, 0.07, 0.3, 16), brushedMetal);
  base.position.y = 0.15;
  const shade = new Mesh(
    new CylinderGeometry(0.12, 0.16, 0.2, 24, 1, true),
    new MeshStandardMaterial({ color: 0xfff0d8, emissive: new Color(0xffc98a), emissiveIntensity: 1.2, side: DoubleSide }),
  );
  shade.position.y = 0.38;
  const bulb = new Mesh(new SphereGeometry(0.035, 12, 8), new MeshBasicMaterial({ color: 0xfff3dd }));
  bulb.position.y = 0.36;
  const glow = new PointLight(0xffb878, 2.2, 5, 1.6);
  glow.position.y = 0.36;
  glow.castShadow = true;
  glow.shadow.mapSize.set(512, 512);
  glow.shadow.bias = -0.002;
  lamp.add(base, shade, bulb, glow);
  add(place(lamp, x0 + 0.26, 0.5, z - side));
  void room;
}

/** Small round side table next to the seat — also the tuck-in surface. */
function buildSideTable(add: Adder): void {
  const t = NycLayout.sideTable;
  const table = new Group();
  table.name = 'SideTable';
  const top = new Mesh(new CylinderGeometry(t.radius, t.radius, 0.03, 48), walnut);
  top.position.y = t.center.y - 0.015;
  const leg = new Mesh(new CylinderGeometry(0.018, 0.018, t.center.y - 0.03, 12), brushedMetal);
  leg.position.y = (t.center.y - 0.03) / 2;
  const foot = new Mesh(new CylinderGeometry(0.16, 0.18, 0.02, 32), brushedMetal);
  foot.position.y = 0.01;
  table.add(top, leg, foot);
  add(place(table, t.center.x, 0, t.center.z));
}

/** Framed abstract canvas above the bed, and sheer linen curtains at the glass. */
function buildDecor(room: Group, add: Adder, linen: MapSet): void {
  const R = NycLayout.room;
  const bed = NycLayout.bed;
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  if (g) {
    const bg = g.createLinearGradient(0, 0, 768, 512);
    bg.addColorStop(0, '#1f2a44');
    bg.addColorStop(1, '#3d4f73');
    g.fillStyle = bg;
    g.fillRect(0, 0, 768, 512);
    const blobs: Array<[number, number, number, string]> = [
      [230, 280, 210, '#e8b07a'],
      [520, 210, 170, '#f3d9b5'],
      [600, 380, 120, '#c98a6a'],
      [140, 120, 90, '#9fb8ff'],
    ];
    for (const [x, y, r, c] of blobs) {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, c);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.8;
      g.fillStyle = grad;
      g.fillRect(0, 0, 768, 512);
    }
  }
  const art = new CanvasTexture(canvas);
  art.colorSpace = SRGBColorSpace;
  const frame = new Mesh(bevelBox(0.03, 0.86, 1.26, 0.008), walnut);
  const painting = new Mesh(new PlaneGeometry(1.2, 0.8), new MeshStandardMaterial({ map: art, roughness: 0.85 }));
  painting.position.x = 0.016;
  painting.rotation.y = Math.PI / 2;
  const artGroup = new Group();
  artGroup.name = 'WallArt';
  artGroup.add(frame, painting);
  add(place(artGroup, R.minX + 0.02, 1.72, bed.top.z));

  const sheer = new MeshStandardMaterial({
    map: linen.diff,
    normalMap: linen.nor,
    color: 0xf3ede4,
    roughness: 0.9,
    transparent: true,
    opacity: 0.6,
    side: DoubleSide,
    depthWrite: false,
  });
  for (const z of [R.minZ + 0.45, R.maxZ - 0.45]) {
    const geo = new PlaneGeometry(0.85, R.height - 0.1, 24, 1);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.035);
    geo.computeVertexNormals();
    const curtain = new Mesh(geo, sheer);
    curtain.name = 'Curtain';
    room.add(place(curtain, R.maxX - 0.14, (R.height - 0.1) / 2 + 0.05, z, -Math.PI / 2));
  }
}

/** Real CC0 props (Poly Haven), optimized GLBs. */
async function placeModels(add: Adder): Promise<void> {
  const R = NycLayout.room;
  const bed = NycLayout.bed;
  const load = async (file: string) => {
    try {
      return (await AssetManager.loadGLTF(`${import.meta.env.BASE_URL}models/${file}`)).scene.clone(true);
    } catch {
      return undefined;
    }
  };
  const [plant, pillows] = await Promise.all([load('potted_plant_02.glb'), load('throw_pillows_01.glb')]);
  if (plant) add(place(plant, R.maxX - 0.45, 0, R.minZ + 0.5));
  if (pillows) add(place(pillows, R.minX + 0.62, 0.6, bed.top.z, Math.PI / 2));
}
