import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  createSystem,
  DirectionalLight,
  DoubleSide,
  Entity,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { HandSigns, HandReading } from '../input/hand-signs.js';
import { Butterfly, picnicMatTexture, pitchLawnTexture, WingPattern } from '../visuals/garden-life.js';
import { BigfootControl } from './lib/bigfoot-control.js';
import { hideRoomExtras, WorldKit, WorldSpots } from './lib/world-kit.js';
import type { EmulatedHand } from './real-hands.js';

const cfg = Tuning.garden;
/**
 * The distant trees and bushes: pictures of Poly Haven CC0 trees (island_tree_02,
 * searsia_lucida), rendered once from the real models (scripts/dev/bake_trees.py),
 * standing in rings far around you. Picture, width/height, how many, height range
 * (m), and the ring (m from you).
 */
const TREES: [string, number, number, number, number, number, number][] = [
  ['bush_a', 0.867, 34, 2.4, 3.6, 22, 27],
  ['tree_a', 1.425, 22, 7, 10, 28, 36],
  ['tree_b', 1.2, 22, 7.5, 11, 29, 37],
  ['tree_a', 1.425, 26, 10, 13, 42, 52],
  ['tree_b', 1.2, 26, 10, 14, 44, 54],
];
/** Index into the 25 hand joints (WebXR order): the index fingertip. */
const INDEX_TIP = 9;
const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** Where Bigfoot would be and the garden's centre (world), for the film's camera. */
export const GardenSpots = { bigfoot: new Vector3(), center: new Vector3(), /** Times a butterfly was touched away. */ touched: 0, /** Where the perched butterfly is (world), for the film's fingertip; null when none. */ perched: null as Vector3 | null, /** The right index fingertip (world), or null. */ rightTip: null as Vector3 | null };

interface Fly {
  b: Butterfly;
  home: Vector3;
  pos: Vector3;
  last: Vector3;
  phase: number;
  /** wander | approach (to a palm or Bigfoot's head) | perch | leave */
  state: 'wander' | 'approach' | 'perch' | 'leave';
  t: number;
  from: Vector3;
  on: 'left' | 'right' | 'bigfoot' | '';
}

/**
 * A garden grows in your room: the room steps away to a wide, freshly mown lawn
 * under a summer sky, striped like a football pitch, with trees far off all
 * around. You sit on a picnic blanket. Monarchs and blue morphos flutter about.
 * Hold out your left hand, palm up and still, and one flies to you and settles
 * on your palm, slowly opening and closing its wings; touch it with your right
 * index finger and it flies away. It is yours alone: Bigfoot is away.
 * Session.world = 'garden'.
 */
export class GardenWorldSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots] },
}) {
  private kit = new WorldKit('garden');
  private root!: Group;
  private lawn!: Mesh;
  private mat!: Group;
  private trees!: Group;
  private dome!: Mesh;
  private flies: Fly[] = [];
  private hidRoom = false;
  private signs = new HandSigns();
  private upFor = { left: 0, right: 0 };
  private downFor = { left: 0, right: 0 };
  private sun!: DirectionalLight;
  private sky!: HemisphereLight;
  private room?: Object3D;
  private time = 0;
  private head = new Vector3();
  private fwd = new Vector3();
  private headQ = new Quaternion();
  private rightV = new Vector3();
  private center = new Vector3();
  private tmp = new Vector3();
  private tmp2 = new Vector3();

  init(): void {
    this.root = new Group();
    this.root.name = 'GardenWorld';
    this.root.visible = false;
    const loader = new TextureLoader();
    const base = import.meta.env.BASE_URL;
    // The lawn: mown stripes, with the grass scan's relief (Poly Haven, CC0) for the blades.
    const stripes = pitchLawnTexture(css(Palette.gardenLawnLight), css(Palette.gardenLawnDark));
    stripes.wrapS = stripes.wrapT = RepeatWrapping;
    stripes.repeat.set((cfg.radius * 2) / cfg.stripeTile, (cfg.radius * 2) / cfg.stripeTile);
    stripes.anisotropy = 8;
    const relief = loader.load(`${base}textures/garden/leafy_grass_nor_gl_1k.jpg`);
    relief.wrapS = relief.wrapT = RepeatWrapping;
    relief.repeat.set(cfg.groundRepeat, cfg.groundRepeat);
    this.lawn = new Mesh(new CircleGeometry(cfg.radius, 96), new MeshStandardMaterial({ map: stripes, normalMap: relief, normalScale: new Vector2(0.6, 0.6), roughness: 0.95 }));
    this.lawn.name = 'Lawn';
    this.root.add(this.lawn);
    // The picnic blanket you sit on.
    const linen = loader.load(`${base}textures/rough_linen/nor.webp`);
    linen.wrapS = linen.wrapT = RepeatWrapping;
    linen.repeat.set(5, 6);
    const blanket = new Mesh(new PlaneGeometry(cfg.matWidth, cfg.matLength), new MeshStandardMaterial({ map: picnicMatTexture(), normalMap: linen, roughness: 0.97 }));
    blanket.rotation.x = -Math.PI / 2;
    blanket.name = 'PicnicBlanket';
    this.mat = new Group();
    this.mat.add(blanket);
    this.root.add(this.mat);
    // A summer sky all around (Poly Haven CC0 photo), beyond the trees.
    const skyTex = loader.load(`${base}env/sky/day.webp`);
    skyTex.colorSpace = SRGBColorSpace;
    this.dome = new Mesh(new SphereGeometry(cfg.skyRadius, 48, 24), new MeshBasicMaterial({ map: skyTex, side: BackSide, depthWrite: false, fog: false }));
    this.dome.renderOrder = -10;
    this.dome.name = 'GardenSky';
    this.root.add(this.dome);
    // Trees far off: one mesh per picture, every tree a card facing you, hazier further away.
    this.trees = new Group();
    this.trees.name = 'GardenTrees';
    const pics = new Map<string, Texture>();
    let seed = 11;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const haze = new Color(Palette.gardenHaze);
    const groups = new Map<string, { pos: number[]; uv: number[]; col: number[]; idx: number[] }>();
    for (const [pic, aspect, count, h0, h1, r0, r1] of TREES) {
      const g = groups.get(pic) ?? { pos: [], uv: [], col: [], idx: [] };
      groups.set(pic, g);
      for (let i = 0; i < count; i++) {
        const a = ((i + rand() * 0.8) / count) * Math.PI * 2;
        const r = r0 + rand() * (r1 - r0);
        const h = h0 + rand() * (h1 - h0);
        const w = h * aspect * (rand() < 0.5 ? 1 : -1);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        // The card's across direction: perpendicular to the line to you.
        const ax = -Math.sin(a) * (w / 2);
        const az = Math.cos(a) * (w / 2);
        const v = g.pos.length / 3;
        g.pos.push(x - ax, 0, z - az, x + ax, 0, z + az, x + ax, h, z + az, x - ax, h, z - az);
        g.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        const c = new Color(1, 1, 1).lerp(haze, Math.min(0.55, (r - 20) / 60));
        for (let k = 0; k < 4; k++) g.col.push(c.r, c.g, c.b);
        g.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      }
    }
    for (const [pic, g] of groups) {
      let tex = pics.get(pic);
      if (!tex) {
        tex = loader.load(`${base}textures/garden/${pic}.webp`);
        tex.colorSpace = SRGBColorSpace;
        pics.set(pic, tex);
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(g.pos), 3));
      geo.setAttribute('uv', new BufferAttribute(new Float32Array(g.uv), 2));
      geo.setAttribute('color', new BufferAttribute(new Float32Array(g.col), 3));
      geo.setIndex(g.idx);
      // (A touch brighter than the picture: sunlit leaves on a summer day.)
      const m = new Mesh(geo, new MeshBasicMaterial({ map: tex, color: new Color(1.25, 1.25, 1.25), vertexColors: true, alphaTest: 0.45, side: DoubleSide, fog: false }));
      m.frustumCulled = false;
      this.trees.add(m);
    }
    this.root.add(this.trees);
    // Butterflies: monarchs and blue morphos.
    for (let i = 0; i < cfg.butterflies; i++) {
      const pattern: WingPattern = i % 3 === 2 ? 'morpho' : 'monarch';
      const b = new Butterfly(pattern, pattern === 'morpho' ? 0.14 : 0.125);
      // Drawn after the see-through hands, so one on your palm sits on it, not behind the glass.
      b.root.traverse((o) => (o.renderOrder = 20));
      this.root.add(b.root);
      this.flies.push({ b, home: new Vector3(), pos: new Vector3(), last: new Vector3(), phase: i * 1.7, state: 'wander', t: 0, from: new Vector3(), on: '' });
    }
    this.sun = new DirectionalLight(Palette.gardenSun, 0);
    this.sky = new HemisphereLight(Palette.gardenSky, Palette.gardenGround, 0);
    this.world.createTransformEntity(this.root);
    for (const l of [this.sun, this.sun.target, this.sky]) this.world.createTransformEntity(l);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const dt = Math.min(realDelta, 0.1);
    if (this.kit.step(d, dt, 0.6)) this.begin(d);
    const k = this.kit.amount;
    // The garden and the bedroom never show together (as at sea).
    this.root.visible = Showcase.enabled ? (this.kit.on ? k > 0.02 : k > 0.5) : k > 0;
    if (!this.root.visible) {
      this.sun.intensity = this.sky.intensity = 0;
      this.hideRoom(false);
      return;
    }
    this.hideRoom(true);
    this.time += dt;
    this.sun.intensity = k * cfg.sunLight;
    this.sky.intensity = k * cfg.skyLight;
    this.player.head.getWorldPosition(this.head);
    // The sky stays around you.
    this.dome.position.copy(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.getWorldQuaternion(this.headQ)).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.rightV.set(-this.fwd.z, 0, this.fwd.x);
    const dev = (window as unknown as { IWER_DEVICE?: { hands?: { left?: EmulatedHand; right?: EmulatedHand } } }).IWER_DEVICE;
    if (dev?.hands) this.signs.readEmulator(dev.hands, this.player);
    else this.signs.readFrame(this.xrFrame, this.xrManager.getReferenceSpace(), this.player);
    this.signs.update(dt, this.rightV);
    this.butterflies(dt);
    // The garden is yours alone: Bigfoot is away.
    this.kit.placeBigfoot(d, GardenSpots.bigfoot, 0, 'away');
    WorldSpots.hold = false;
  }

  private begin(d: Entity): void {
    this.player.head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.getWorldQuaternion(this.headQ)).setY(0).normalize();
    this.center.set(this.head.x, 0, this.head.z);
    GardenSpots.center.copy(this.center);
    this.root.position.set(0, 0, 0);
    // The lawn's stripes run away from you, like a pitch seen from the halfway line.
    this.lawn.position.set(this.center.x, 0.004, this.center.z);
    this.lawn.rotation.set(-Math.PI / 2, 0, Math.atan2(-this.fwd.x, -this.fwd.z));
    // The blanket under you, its length running ahead.
    this.mat.position.copy(this.center).addScaledVector(this.fwd, cfg.matAhead).setY(0.012);
    this.mat.rotation.set(0, Math.atan2(this.fwd.x, this.fwd.z), 0);
    this.trees.position.copy(this.center);
    // (The film's camera looks this way.)
    GardenSpots.bigfoot.copy(this.center).addScaledVector(this.fwd, cfg.bigfootAhead);
    // A high summer sun, behind you and to the left, so the lawn ahead is lit.
    this.sun.position.copy(this.center).addScaledVector(this.fwd, -20).add(this.tmp.set(0, 32, 0)).addScaledVector(this.rightV, -14);
    this.sun.target.position.copy(this.center).addScaledVector(this.fwd, 4);
    this.flies.forEach((f, i) => {
      const a = (i / this.flies.length) * Math.PI * 2;
      f.home.copy(this.center).add(this.tmp.set(Math.cos(a) * (1.1 + (i % 3) * 0.45), 0.75 + (i % 2) * 0.3, Math.sin(a) * (1.1 + (i % 3) * 0.45)));
      f.pos.copy(f.home);
      f.state = 'wander';
      f.on = '';
    });
    this.time = 0;
    this.kit.caption(d, 'A garden grows in your room');
  }

  /** At the garden there is only the garden: the showcase bedroom steps away. */
  private hideRoom(hide: boolean): void {
    if (!Showcase.enabled) return;
    hideRoomExtras(this.scene, hide, 'garden');
    this.room ??= this.scene.getObjectByName('NycBedroom') ?? undefined;
    if (!this.room) return;
    // Only give the room back if the garden took it (another world may be holding it).
    if (hide) {
      this.room.visible = false;
      this.hidRoom = true;
    } else if (this.hidRoom) {
      this.room.visible = true;
      this.hidRoom = false;
    }
  }

  /** A hand held out palm up and still, open or gently curved to receive: a place for a butterfly to land. */
  private palmReady(h: HandReading): boolean {
    return h.tracked && (h.sign === 'open' || h.sign === 'other') && h.normal.y > 0.55 && h.speed < 0.45;
  }

  private butterflies(dt: number): void {
    for (const side of ['left'] as const) {
      const h = this.signs[side];
      const ready = this.palmReady(h);
      this.upFor[side] = ready ? this.upFor[side] + dt : 0;
      this.downFor[side] = ready ? 0 : this.downFor[side] + dt;
      const perched = this.flies.some((f) => f.on === side);
      if (this.upFor[side] > cfg.palmHold && !perched) {
        // The nearest wandering butterfly comes to this hand.
        let best: Fly | undefined;
        for (const f of this.flies) if (f.state === 'wander' && (!best || f.pos.distanceTo(h.palm) < best.pos.distanceTo(h.palm))) best = f;
        if (best) this.approach(best, side);
      }
    }
    for (const f of this.flies) {
      f.t += dt;
      f.last.copy(f.pos);
      let flap = 0.75 + 0.6 * Math.sin(this.time * 26 + f.phase);
      const target = this.perchPoint(f.on, this.tmp2);
      if (f.state === 'wander') {
        const t = this.time * 0.5 + f.phase;
        f.pos.copy(f.home).add(this.tmp.set(Math.sin(t * 1.3) * 0.7, Math.sin(t * 2.1) * 0.25 + Math.sin(t * 7.3) * 0.04, Math.cos(t * 0.9) * 0.7));
      } else if (f.state === 'approach' && target) {
        const e = Math.min(1, f.t / cfg.approachSec);
        const s = e * e * (3 - 2 * e);
        // Over and down onto the perch, fluttering, slowing as it settles.
        this.tmp.lerpVectors(f.from, target, s);
        this.tmp.y += Math.sin(Math.PI * e) * 0.25 + Math.sin(this.time * 9 + f.phase) * 0.02 * (1 - e);
        f.pos.copy(this.tmp);
        flap = 0.6 + 0.55 * Math.sin(this.time * (26 - 14 * e) + f.phase);
        if (e >= 1) {
          f.state = 'perch';
          f.t = 0;
        }
      } else if (f.state === 'perch' && target) {
        f.pos.copy(target);
        // Resting: the wings open and close slowly.
        flap = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(f.t * 2.2 + f.phase));
        // A touch of the right index fingertip (or the palm closing or moving away) sends it off.
        const r = this.signs.right;
        const touched = r.tracked && f.t > 0.6 && r.joints[INDEX_TIP].distanceTo(f.pos) < cfg.touchReach;
        if (touched || this.downFor[f.on as 'left' | 'right'] > cfg.leaveAfter) this.lift(f, touched);
      } else {
        // Leaving: up and away, back home to the flowers.
        const e = Math.min(1, f.t / 1.6);
        f.pos.lerpVectors(f.from, this.tmp.copy(f.home).add(this.tmp2.set(0, 0.4, 0)), e * e * (3 - 2 * e));
        f.pos.y += Math.sin(Math.PI * e) * 0.5;
        if (e >= 1) f.state = 'wander';
      }
      f.b.root.position.copy(f.pos);
      // Heading: along its flight; perched, along the hand's fingers (or facing you on Bigfoot's head).
      if (f.state === 'perch') {
        const h = f.on === 'bigfoot' ? undefined : this.signs[f.on as 'left' | 'right'];
        this.tmp.copy(h ? h.pointDir : this.fwd.clone().negate()).setY(0);
        if (this.tmp.lengthSq() < 1e-4) this.tmp.set(0, 0, 1);
        f.b.root.lookAt(this.tmp.normalize().add(f.pos));
      } else {
        this.tmp.subVectors(f.pos, f.last).setY(0);
        if (this.tmp.lengthSq() > 1e-8) f.b.root.lookAt(this.tmp.normalize().add(f.pos));
      }
      f.b.flap(flap);
      // On (or settling onto) a palm, it shows in front of the fingers curled around it.
      f.b.setOnTop(f.state === 'perch' || (f.state === 'approach' && f.t > cfg.approachSec * 0.75));
    }
    const sat = this.flies.find((x) => x.state === 'perch' && x.on === 'left');
    GardenSpots.perched = sat ? sat.pos : null;
    GardenSpots.rightTip = this.signs.right.tracked ? this.signs.right.joints[INDEX_TIP] : null;
  }

  private approach(f: Fly, on: 'left' | 'right' | 'bigfoot'): void {
    f.state = 'approach';
    f.on = on;
    f.t = 0;
    f.from.copy(f.pos);
  }

  private lift(f: Fly, touched = false): void {
    f.state = 'leave';
    f.on = '';
    f.t = 0;
    f.from.copy(f.pos);
    if (touched) GardenSpots.touched++;
  }

  /** Where a perched butterfly sits: on the palm (just above it), or on top of Bigfoot's head. */
  private perchPoint(on: Fly['on'], out: Vector3): Vector3 | undefined {
    if (on === 'bigfoot') return out.copy(BigfootControl.head).add(this.tmp.set(0, Tuning.friend.headTop - 0.02, 0));
    if (on === 'left' || on === 'right') {
      const h = this.signs[on];
      return out.copy(h.palm).addScaledVector(h.normal, cfg.perchAbove);
    }
    return undefined;
  }
}
