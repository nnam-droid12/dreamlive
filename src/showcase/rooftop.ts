/**
 * The Rooftop Party world: the taller skyscraper opposite Bigfoot's window with
 * a DJ party on its roof, Bigfoot's own tower (its facade, with his window cut
 * out), other towers all around and the street far below. Built in the window
 * frame (see rooftop-layout.ts) so it stands outside the showcase glass or
 * beyond the headset's dream window. Repeats are instanced.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { PaletteSets } from '../config/palette.js';
import { personGeometry } from '../dream-tv/dj.js';
import { facadeTexture } from '../dream-tv/ski.js';
import { buildDjBooth } from '../scene-assets/dj-booth.scene-asset.js';
import { buildDecoTower } from '../scene-assets/landmark-deco.scene-asset.js';
import { buildGlassSupertall } from '../scene-assets/landmark-glass.scene-asset.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';
import { EqualizerUniforms, makeEqualizer } from '../visuals/equalizer.js';
import { FACADE_TILE } from './facades.js';
import { Rooftop } from './rooftop-layout.js';
import { buildModernTower, TowerMaterials, TowerStyle } from '../scene-assets/lib/modern-tower.js';
import { createTowerMaterials } from './tower-materials.js';

const B = Rooftop.building;
const H = Rooftop.home;
const CROWD = 40;
/** Real facades for the towers around (picked per tower position): stone, brick, glass, lit offices. */
const TOWER_STYLES: readonly TowerStyle[] = ['blue', 'dark', 'stone', 'blue', 'dark', 'blue', 'stone'];
const BULB_COLORS = [0xffd27a, 0xff5fb8, 0x35e0ff, 0xb38bff];

export interface RooftopWorld {
  /** Root in window-frame coordinates (place it on the frame). */
  root: Group;
  /** Everything on the room's side of the window wall (other towers behind it). */
  behind: Group;
  /** Turntable platters, to spin. */
  platters: Object3D[];
  /** Tints the lasers, dance floor and light (the chosen song's palette). */
  setPalette(colors: readonly number[]): void;
  /** The skyline as a music visualizer (towers as VU meters); its owner feeds the live bands. */
  equalizer: EqualizerUniforms;
  /** The modern towers' shared materials (dressed with textures once loaded; lit at night). */
  towerMats: TowerMaterials;
  /** The party crowd's spots (feet, scale), and the simple stand-in figures shown until real guests load. */
  crowdSpots: readonly { p: Vector3; s: number; phase: number }[];
  crowdStandIns: readonly InstancedMesh[];
  /** Per frame: time, beat phase 0..1 (1 = on the kick), party energy 0..1. */
  update(t: number, beat: number, energy: number): void;
}

/** UVs of a flat geometry laid out in metres (shape coordinates) → facade tiles. */
function tileUVs(g: BufferGeometry, sx = 1, sy = 1): BufferGeometry {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * sx) / FACADE_TILE, (uv.getY(i) * sy) / FACADE_TILE);
  uv.needsUpdate = true;
  return g;
}

/** An outward-facing wall plane (invisible from inside, so it never hides the room). */
function wallPlane(w: number, h: number, mat: MeshStandardMaterial): Mesh {
  return new Mesh(new PlaneGeometry(w, h), mat);
}

export function buildRooftop(): RooftopWorld {
  const root = new Group();
  root.name = 'RooftopParty';
  const behind = new Group();
  behind.name = 'BehindTheWindowWall';
  root.add(behind);
  const facade = facadeTexture();
  facade.repeat.set(4, 10);
  const facadeMat = new MeshStandardMaterial({ map: facade, emissiveMap: facade, emissive: new Color(0xffffff), emissiveIntensity: 0.55, roughness: 0.7, side: FrontSide });
  const equalizer = makeEqualizer(facadeMat);
  const towerMats = createTowerMaterials();
  const concrete = new MeshStandardMaterial({ color: 0x3a3740, roughness: 0.9 });
  const trim = new MeshStandardMaterial({ color: 0x2a2730, roughness: 0.6 });
  const m = new Matrix4();

  // The party skyscraper opposite, taller than Bigfoot's.
  const w = B.farX - B.nearX;
  const d = B.maxZ - B.minZ;
  // The party tower: a glass office tower with a flat roof (the party is up there, so no crown).
  const body = buildModernTower({ w, d, h: B.roofY - B.baseY, style: 'blue', setbacks: false, seed: 1, crown: false }, towerMats);
  body.position.set((B.nearX + B.farX) / 2, B.baseY, (B.minZ + B.maxZ) / 2);
  const roof = new Mesh(new BoxGeometry(w, 0.3, d), concrete);
  roof.position.set(body.position.x, B.roofY - 0.15, body.position.z);
  root.add(body, roof);
  for (const [x, z, pw, pd, ph] of [
    [B.nearX + 0.12, (B.minZ + B.maxZ) / 2, 0.25, d, 0.6],
    [B.farX - 0.12, (B.minZ + B.maxZ) / 2, 0.25, d, 1.1],
    [(B.nearX + B.farX) / 2, B.minZ + 0.12, w, 0.25, 1.1],
    [(B.nearX + B.farX) / 2, B.maxZ - 0.12, w, 0.25, 1.1],
  ] as const) {
    const p = new Mesh(bevelBox(pw, ph, pd, 0.02), trim);
    p.position.set(x, B.roofY + ph / 2, z);
    root.add(p);
  }
  // A classic wooden water tower at the far corner.
  const wood = new MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.85 });
  const tank = new Group();
  const barrel = new Mesh(new CylinderGeometry(1.3, 1.3, 2.4, 20), wood);
  barrel.position.y = 3.6;
  const cap = new Mesh(new ConeGeometry(1.45, 1.0, 20), wood);
  cap.position.y = 5.3;
  tank.add(barrel, cap);
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const leg = new Mesh(new CylinderGeometry(0.07, 0.07, 2.4, 6), trim);
    leg.position.set(lx, 1.2, lz);
    tank.add(leg);
  }
  tank.position.set(B.farX - 3, B.roofY, B.maxZ - 3);
  root.add(tank);

  // Bigfoot's own tower: a facade with his window cut out, its roof, sides and back.
  // All faces point outward, so from inside the room (or a real room) they vanish.
  const front = new Shape();
  front.moveTo(-20, H.baseY);
  front.lineTo(20, H.baseY);
  front.lineTo(20, H.roofY);
  front.lineTo(-20, H.roofY);
  front.lineTo(-20, H.baseY);
  const glass = new Path();
  glass.moveTo(H.glassZ0, 0);
  glass.lineTo(H.glassZ0, 3.0);
  glass.lineTo(H.glassZ1, 3.0);
  glass.lineTo(H.glassZ1, 0);
  glass.lineTo(H.glassZ0, 0);
  front.holes.push(glass);
  const homeFront = new Mesh(tileUVs(new ShapeGeometry(front)), facadeMat);
  homeFront.userData.facade = 'f18a';
  // Shape x → frame -z after turning to face +x; mirror so the hole lands on the glass.
  homeFront.rotation.y = Math.PI / 2;
  homeFront.scale.x = -1;
  homeFront.position.x = 0.04;
  const homeRoof = wallPlane(14, 40, facadeMat);
  homeRoof.material = concrete;
  homeRoof.rotation.x = -Math.PI / 2;
  homeRoof.position.set(-7, H.roofY, 0);
  behind.add(homeRoof);
  for (const s of [-1, 1]) {
    const side = wallPlane(14, H.roofY - H.baseY, facadeMat);
    tileUVs(side.geometry, 14, H.roofY - H.baseY);
    side.userData.facade = 'f18a';
    side.rotation.y = s > 0 ? 0 : Math.PI;
    side.position.set(-7, (H.roofY + H.baseY) / 2, s * 20);
    behind.add(side);
  }
  root.add(homeFront);
  // The ledge he steps out onto.
  const ledge = new Mesh(bevelBox(Rooftop.ledge.depth, 0.18, Rooftop.bay.width + 0.2, 0.02), concrete);
  ledge.name = 'Ledge';
  ledge.position.set(Rooftop.ledge.depth / 2, -0.09, 0);
  root.add(ledge);

  // Other towers all around: across the avenue, down the street, and behind his tower.
  for (const [x, z, tw, td, top, back] of [
    [30, -30, 12, 10, 18, 0], [34, 6, 10, 12, 30, 0], [28, 32, 12, 10, 12, 0],
    [9, -26, 10, 10, 2, 0], [10, 28, 10, 9, 9, 0], [58, 3, 14, 12, 34, 0],
    [-30, -36, 12, 10, 26, 1], [-28, 34, 12, 12, 14, 1], [-40, 0, 14, 16, 34, 1],
  ] as const) {
    // Modern towers built like real ones: glass curtain walls, concrete slabs, mullion fins, setbacks, crowns.
    const seed = Math.abs(x + z);
    const h = top - H.baseY;
    const t = buildModernTower({ w: tw, d: td, h, style: TOWER_STYLES[seed % TOWER_STYLES.length], setbacks: h > 55, seed }, towerMats);
    t.position.set(x, H.baseY, z);
    (back ? behind : root).add(t);
  }

  // Landmarks on the skyline beyond the party: an art-deco spire to the left, a glass supertall to the right.
  for (const [build, at] of [[buildDecoTower, Rooftop.landmarks.deco], [buildGlassSupertall, Rooftop.landmarks.glass]] as const) {
    const t = build();
    t.position.set(at.x, H.baseY, at.z);
    t.rotation.y = at.yaw;
    root.add(t);
  }

  // The street ("ground floor") far below: asphalt and lamps.
  const street = new Mesh(new PlaneGeometry(200, 200), new MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.95 }));
  street.rotation.x = -Math.PI / 2;
  street.position.set(10, H.baseY, 0);
  root.add(street);
  const lamps = new InstancedMesh(new SphereGeometry(0.25, 8, 6), new MeshBasicMaterial({ color: 0xffd8a0 }), 16);
  for (let i = 0; i < 16; i++) {
    m.makeTranslation(i % 2 ? Rooftop.street.x1 : Rooftop.street.x0, H.baseY + 5, -32 + i * 4.2);
    lamps.setMatrixAt(i, m);
  }
  root.add(lamps);
  // Lit by the scene (golden hour, then party lights), each dancer in their own outfit colour.
  const crowdMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: new Color(0x2a1830), emissiveIntensity: 0.35 });
  const outfit = new Color();
  const dress = (mesh: InstancedMesh, offset: number) => {
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, outfit.setHex(PaletteSets.crowdOutfits[(i + offset) % PaletteSets.crowdOutfits.length]));
  };

  // The party: a low stage at the near edge with the booth facing the crowd (+z).
  const S = Rooftop.stage;
  const stage = new Mesh(bevelBox(S.x1 - S.x0, S.height, S.z1 - S.z0, 0.03), trim);
  stage.position.set((S.x0 + S.x1) / 2, B.roofY + S.height / 2, (S.z0 + S.z1) / 2);
  root.add(stage);
  const booth = buildDjBooth();
  booth.position.copy(Rooftop.booth);
  root.add(booth);
  const platters: Object3D[] = [];
  booth.traverse((o) => {
    if (o.name === 'Platter') platters.push(o);
  });

  // Dance floor tiles and the crowd, facing the DJ.
  const C = Rooftop.crowd;
  const tiles = new InstancedMesh(new BoxGeometry(1.0, 0.04, 1.1), new MeshBasicMaterial(), 36);
  const tilePos: Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const p = new Vector3(C.x0 + (C.x1 - C.x0) * ((i + 0.5) / 6), B.roofY + 0.02, C.z0 + (C.z1 - C.z0) * ((j + 0.5) / 6));
      tilePos.push(p);
      m.makeTranslation(p.x, p.y, p.z);
      tiles.setMatrixAt(i * 6 + j, m);
    }
  }
  root.add(tiles);
  const crowd = [new InstancedMesh(personGeometry(false), crowdMat, CROWD / 2), new InstancedMesh(personGeometry(true), crowdMat, CROWD / 2)];
  crowd.forEach((c, k) => {
    dress(c, k * 4);
    root.add(c);
  });
  const spots = Array.from({ length: CROWD }, (_, i) => ({
    p: new Vector3(C.x0 + ((i * 0.618) % 1) * (C.x1 - C.x0), B.roofY, C.z0 + ((i * 0.377) % 1) * (C.z1 - C.z0)),
    s: 0.85 + ((i * 0.53) % 1) * 0.2,
    phase: ((i * 0.29) % 1) * 0.5,
  })).filter((s) => s.p.distanceTo(Rooftop.danceSpot) > 0.9);
  // Space is left for Bigfoot to dance among them; draw only the people placed.
  crowd[0].count = Math.ceil(spots.length / 2);
  crowd[1].count = Math.floor(spots.length / 2);
  const faceDj = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

  // The raised VIP deck the viewer is brought to (railing behind them, view kept clear).
  const D = Rooftop.deck;
  const deck = new Mesh(bevelBox(D.x1 - D.x0, D.height, D.z1 - D.z0, 0.03), trim);
  deck.position.set((D.x0 + D.x1) / 2, B.roofY + D.height / 2, (D.z0 + D.z1) / 2);
  root.add(deck);
  for (const [x, z, rw, rd] of [[D.x1, (D.z0 + D.z1) / 2, 0.05, D.z1 - D.z0], [(D.x0 + D.x1) / 2, D.z0, D.x1 - D.x0, 0.05]] as const) {
    const rail = new Mesh(new BoxGeometry(rw, 0.05, rd), trim);
    rail.position.set(x, B.roofY + D.height + 1.0, z);
    root.add(rail);
  }

  // String lights over the dance floor.
  const strands = 3;
  const perStrand = 20;
  const bulbs = new InstancedMesh(new SphereGeometry(0.06, 8, 6), new MeshBasicMaterial(), strands * perStrand);
  const color = new Color();
  for (let s = 0; s < strands; s++) {
    const a = new Vector3(B.nearX + 1, B.roofY + 3.2, C.z0 - 1 + s * 3);
    const b = new Vector3(B.farX - 2, B.roofY + 3.2, C.z0 + s * 3.5);
    for (let i = 0; i < perStrand; i++) {
      const k = i / (perStrand - 1);
      const p = new Vector3().lerpVectors(a, b, k);
      p.y -= Math.sin(k * Math.PI) * 0.9;
      m.makeTranslation(p.x, p.y, p.z);
      bulbs.setMatrixAt(s * perStrand + i, m);
      bulbs.setColorAt(s * perStrand + i, color.setHex(BULB_COLORS[i % 4]));
    }
  }
  root.add(bulbs);

  // Lasers from the stage, the party light over the floor, and a warm key light on the DJ.
  const lasers: Mesh[] = [];
  const laserGeo = new CylinderGeometry(0.02, 0.02, 30, 6, 1, true).translate(0, 15, 0);
  for (let i = 0; i < 6; i++) {
    const beam = new Mesh(laserGeo, new MeshBasicMaterial({ color: BULB_COLORS[i % 4], transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    beam.position.set(S.x0 + (S.x1 - S.x0) * ((i + 0.5) / 6), B.roofY + S.height + 0.2, S.z0 + 0.2);
    root.add(beam);
    lasers.push(beam);
  }
  const light = new PointLight(0xff5fb8, 0, 24, 1.2);
  light.position.set((C.x0 + C.x1) / 2, B.roofY + 4, (C.z0 + C.z1) / 2);
  const key = new PointLight(0xffe2c4, 9, 7, 1.4);
  key.position.set(Rooftop.djSpot.x - 1.2, Rooftop.djSpot.y + 2.6, Rooftop.djSpot.z + 2.2);
  // And one on the front row, where Bigfoot dances.
  const key2 = new PointLight(0xffe8d0, 6, 6, 1.4);
  key2.position.set(Rooftop.danceSpot.x + 1.2, Rooftop.danceSpot.y + 3.0, Rooftop.danceSpot.z - 0.8);
  root.add(light, key, key2);

  const pos = new Vector3();
  const scl = new Vector3();
  const tile = new Color();
  let palette: readonly number[] = BULB_COLORS;
  return {
    root,
    behind,
    platters,
    equalizer,
    towerMats,
    crowdSpots: spots,
    crowdStandIns: crowd,
    setPalette(colors) {
      palette = colors;
      lasers.forEach((l, i) => (l.material as MeshBasicMaterial).color.setHex(colors[i % colors.length]));
    },
    update(t, beat, energy) {
      const hit = Math.pow(beat, 4);
      platters.forEach((p, i) => (p.rotation.y = t * (i ? -3.5 : 3.5)));
      // The stand-in figures bob until the real party guests take over (then they are hidden).
      if (crowd[0].visible) {
        for (let i = 0; i < spots.length; i++) {
          const s = spots[i];
          pos.copy(s.p).setY(B.roofY + Math.abs(Math.sin((t * 2 + s.phase) * Math.PI)) * 0.12 * (0.3 + energy));
          scl.setScalar(s.s);
          m.compose(pos, faceDj, scl);
          crowd[i % 2].setMatrixAt(i >> 1, m);
        }
        crowd.forEach((c) => (c.instanceMatrix.needsUpdate = true));
      }
      const step = Math.floor(t * 2);
      for (let i = 0; i < tilePos.length; i++) {
        tiles.setColorAt(i, tile.setHex(palette[(i + step) % palette.length]).multiplyScalar(0.25 + 0.75 * energy * ((i + step) % 3 === 0 ? 1 : 0.35)));
      }
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      lasers.forEach((b, i) => {
        b.visible = energy > 0.05;
        b.rotation.z = Math.sin(t * 0.9 + i * 1.3) * 0.7;
        b.rotation.x = Math.sin(t * 0.7 + i) * 0.4;
        (b.material as MeshBasicMaterial).opacity = (0.25 + 0.6 * hit) * energy;
      });
      light.color.setHex(palette[Math.floor(t * 0.5) % palette.length]);
      light.intensity = (14 + 16 * hit) * energy;
    },
  };
}
