import {
  AssetManager,
  Box3,
  CircleGeometry,
  Color,
  createSystem,
  DirectionalLight,
  Entity,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
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
import { Butterfly, buildLadybug, Fireflies, WingPattern } from '../visuals/garden-life.js';
import { BigfootControl } from './lib/bigfoot-control.js';
import { WorldKit, WorldSpots } from './lib/world-kit.js';
import type { EmulatedHand } from './real-hands.js';

const cfg = Tuning.garden;
/**
 * Poly Haven plants (CC0): model folder, how many, scale range, and the ring they
 * grow in (m from you): flower beds close around you, ferns and shrubs beyond,
 * and a tall hedge closing the garden in (spaced evenly around it).
 */
const PLANTS: [string, number, number, number, number, number, boolean][] = [
  ['flower_gazania', 40, 1.5, 2.3, 1.2, 3.6, false],
  ['flower_ursinia', 40, 1.5, 2.3, 1.2, 3.6, false],
  ['periwinkle_plant', 20, 1.3, 1.9, 1.3, 4.2, false],
  ['dandelion_01', 16, 1.2, 1.7, 1.5, 4.5, false],
  ['fern_02', 14, 1.4, 2.0, 3.0, 6.5, false],
  ['shrub_03', 14, 1.3, 1.9, 3.5, 7, false],
  ['shrub_02', 22, 2.6, 3.4, 8, 8.8, true],
  ['shrub_03', 22, 2.8, 3.6, 8.6, 9.6, true],
];
/** Indices into the 25 hand joints (WebXR order): the index finger's first knuckle and its tip. */
const INDEX_PROX = 6;
const INDEX_TIP = 9;

/** Where Bigfoot sits and the garden's centre (world), for the film's camera. */
export const GardenSpots = { bigfoot: new Vector3(), center: new Vector3() };

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
 * A garden grows in your room: the room steps away to a lawn at golden hour,
 * real flowers and shrubs all around (Poly Haven, CC0), Bigfoot sitting in the
 * grass. Monarchs and blue morphos flutter between the flowers. Hold out an
 * open hand, palm up and still, and one flies to you and settles on your palm,
 * slowly opening and closing its wings; move away and it lifts off. Point a
 * finger and a ladybug walks along it. At dusk fireflies drift around you and
 * gather near an open hand. Session.world = 'garden'.
 */
export class GardenWorldSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots] },
}) {
  private kit = new WorldKit('garden');
  private root!: Group;
  private flies: Fly[] = [];
  private ladybug!: Group;
  private bugT = 0;
  private fireflies!: Fireflies;
  private fireVel!: Float32Array;
  private hidRoom = false;
  private signs = new HandSigns();
  private upFor = { left: 0, right: 0 };
  private downFor = { left: 0, right: 0 };
  private sun!: DirectionalLight;
  private sky!: HemisphereLight;
  private room?: Object3D;
  private plantsLoaded = false;
  /** The stump's top (Bigfoot's seat height). */
  private seatY = 0.5;
  private time = 0;
  private head = new Vector3();
  private fwd = new Vector3();
  private headQ = new Quaternion();
  private rightV = new Vector3();
  private center = new Vector3();
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private q = new Quaternion();

  init(): void {
    this.root = new Group();
    this.root.name = 'GardenWorld';
    this.root.visible = false;
    this.fireVel = new Float32Array(cfg.fireflies * 3);
    // The lawn: a real grass scan (Poly Haven, CC0), tiled.
    const loader = new TextureLoader();
    const tex = (id: string, srgb: boolean) => {
      const t = loader.load(`${import.meta.env.BASE_URL}textures/garden/leafy_grass_${id}_1k.jpg`);
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(cfg.groundRepeat, cfg.groundRepeat);
      if (srgb) t.colorSpace = SRGBColorSpace;
      return t;
    };
    const ground = new Mesh(new CircleGeometry(cfg.radius, 64), new MeshStandardMaterial({ map: tex('diff', true), normalMap: tex('nor_gl', false), roughnessMap: tex('arm', false), roughness: 1, color: new Color(Palette.gardenLawn) }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.004;
    ground.receiveShadow = true;
    ground.name = 'Lawn';
    this.root.add(ground);
    // Butterflies: monarchs and blue morphos.
    for (let i = 0; i < cfg.butterflies; i++) {
      const pattern: WingPattern = i % 3 === 2 ? 'morpho' : 'monarch';
      const b = new Butterfly(pattern, pattern === 'morpho' ? 0.14 : 0.125);
      this.root.add(b.root);
      this.flies.push({ b, home: new Vector3(), pos: new Vector3(), last: new Vector3(), phase: i * 1.7, state: 'wander', t: 0, from: new Vector3(), on: '' });
    }
    this.ladybug = buildLadybug();
    this.ladybug.scale.setScalar(cfg.ladybugScale);
    this.ladybug.visible = false;
    this.root.add(this.ladybug);
    this.fireflies = new Fireflies(cfg.fireflies);
    this.root.add(this.fireflies.points);
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
    if (!this.plantsLoaded) void this.plant();
    this.time += dt;
    this.sun.intensity = k * cfg.sunLight;
    this.sky.intensity = k * cfg.skyLight;
    this.player.head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.getWorldQuaternion(this.headQ)).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.rightV.set(-this.fwd.z, 0, this.fwd.x);
    const dev = (window as unknown as { IWER_DEVICE?: { hands?: { left?: EmulatedHand; right?: EmulatedHand } } }).IWER_DEVICE;
    if (dev?.hands) this.signs.readEmulator(dev.hands, this.player);
    else this.signs.readFrame(this.xrFrame, this.xrManager.getReferenceSpace(), this.player);
    this.signs.update(dt, this.rightV);
    this.butterflies(dt);
    this.ladybugTick(dt);
    this.firefliesTick(dt);
    // Bigfoot sits on an old tree stump in front of you, looking at you.
    this.kit.placeBigfoot(d, this.tmp.copy(GardenSpots.bigfoot).setY(this.seatY), Math.atan2(this.center.x - GardenSpots.bigfoot.x, this.center.z - GardenSpots.bigfoot.z), 'sit');
    WorldSpots.seatQ.identity();
    WorldSpots.hold = false;
  }

  private begin(d: Entity): void {
    this.player.head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.getWorldQuaternion(this.headQ)).setY(0).normalize();
    this.center.set(this.head.x, 0, this.head.z);
    GardenSpots.center.copy(this.center);
    this.root.position.set(0, 0, 0);
    (this.root.children[0] as Mesh).position.set(this.center.x, 0.004, this.center.z);
    // Bigfoot a couple of metres in front, sitting on the lawn.
    GardenSpots.bigfoot.copy(this.center).addScaledVector(this.fwd, cfg.bigfootAhead);
    // The sun low and warm behind him, a little to the side.
    this.sun.position.copy(this.center).addScaledVector(this.fwd, 30).add(this.tmp.set(-12, 14, 0));
    this.sun.target.position.copy(this.center);
    this.flies.forEach((f, i) => {
      const a = (i / this.flies.length) * Math.PI * 2;
      f.home.copy(this.center).add(this.tmp.set(Math.cos(a) * (1.1 + (i % 3) * 0.45), 0.75 + (i % 2) * 0.3, Math.sin(a) * (1.1 + (i % 3) * 0.45)));
      f.pos.copy(f.home);
      f.state = 'wander';
      f.on = '';
    });
    for (let i = 0; i < cfg.fireflies; i++) {
      const a = i * 2.39996;
      const r = 1.0 + ((i * 0.618) % 1) * 3.4;
      this.fireflies.positions.set([this.center.x + Math.cos(a) * r, 0.3 + ((i * 0.37) % 1) * 1.8, this.center.z + Math.sin(a) * r], i * 3);
    }
    this.time = 0;
    this.kit.caption(d, 'A garden grows in your room');
  }

  /** The plants, once: scattered all around you (none right at your feet, none where Bigfoot sits). */
  private async plant(): Promise<void> {
    this.plantsLoaded = true;
    // An old tree stump for Bigfoot to sit on (Poly Haven, CC0); its top is his seat.
    try {
      const stump = (await AssetManager.loadGLTF(`${import.meta.env.BASE_URL}models/garden/tree_stump_01/tree_stump_01.gltf`)).scene.clone(true);
      stump.position.set(GardenSpots.bigfoot.x, 0, GardenSpots.bigfoot.z);
      stump.scale.setScalar(cfg.stumpScale);
      this.root.add(stump);
      stump.updateMatrixWorld(true);
      this.seatY = new Box3().setFromObject(stump).max.y - 0.03;
    } catch {
      // No stump: he sits lower.
    }
    let seed = 5;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const [name, count, s0, s1, rNear, rFar, even] of PLANTS) {
      let gltf;
      try {
        gltf = await AssetManager.loadGLTF(`${import.meta.env.BASE_URL}models/garden/${name}/${name}.gltf`);
      } catch {
        continue;
      }
      for (let i = 0; i < count; i++) {
        let x = 0;
        let z = 0;
        for (let tries = 0; tries < 12; tries++) {
          const a = even ? ((i + rand() * 0.6) / count) * Math.PI * 2 : rand() * Math.PI * 2;
          const r = rNear + rand() * (rFar - rNear);
          x = this.center.x + Math.cos(a) * r;
          z = this.center.z + Math.sin(a) * r;
          if (Math.hypot(x - GardenSpots.bigfoot.x, z - GardenSpots.bigfoot.z) > 1.3) break;
        }
        const p = gltf.scene.clone(true);
        p.position.set(x, 0, z);
        p.rotation.y = rand() * Math.PI * 2;
        p.scale.setScalar(s0 + rand() * (s1 - s0));
        this.root.add(p);
      }
    }
  }

  /** At the garden there is only the garden: the showcase bedroom steps away. */
  private hideRoom(hide: boolean): void {
    if (!Showcase.enabled) return;
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

  /** An open hand, palm up, held still: a place for a butterfly to land. */
  private palmReady(h: HandReading): boolean {
    return h.tracked && h.sign === 'open' && h.normal.y > 0.55 && h.speed < 0.45;
  }

  private butterflies(dt: number): void {
    for (const side of ['left', 'right'] as const) {
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
    // One likes Bigfoot's head.
    const head = BigfootControl.head;
    if (this.time > cfg.bigfootButterflyAt && !this.flies.some((f) => f.on === 'bigfoot') && head.lengthSq() > 0) {
      const f = this.flies.find((x) => x.state === 'wander');
      if (f) this.approach(f, 'bigfoot');
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
        const leave = f.on === 'bigfoot' ? f.t > cfg.bigfootPerchSec : this.downFor[f.on as 'left' | 'right'] > cfg.leaveAfter;
        if (leave) this.lift(f);
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
    }
  }

  private approach(f: Fly, on: 'left' | 'right' | 'bigfoot'): void {
    f.state = 'approach';
    f.on = on;
    f.t = 0;
    f.from.copy(f.pos);
  }

  private lift(f: Fly): void {
    f.state = 'leave';
    f.on = '';
    f.t = 0;
    f.from.copy(f.pos);
  }

  /** Where a perched butterfly sits: on the palm (just above it), or on top of Bigfoot's head. */
  private perchPoint(on: Fly['on'], out: Vector3): Vector3 | undefined {
    if (on === 'bigfoot') return out.copy(BigfootControl.head).add(this.tmp.set(0, Tuning.friend.headTop - 0.02, 0));
    if (on === 'left' || on === 'right') {
      const h = this.signs[on];
      return out.copy(h.palm).addScaledVector(h.normal, 0.015);
    }
    return undefined;
  }

  /** Point a finger and a ladybug walks along it, from the knuckle to the tip and back. */
  private ladybugTick(dt: number): void {
    const h = this.signs.right.tracked && this.signs.right.sign === 'point' ? this.signs.right : this.signs.left.tracked && this.signs.left.sign === 'point' ? this.signs.left : undefined;
    this.ladybug.visible = !!h;
    if (!h) return;
    this.bugT += dt;
    const e = 0.5 - 0.5 * Math.cos((this.bugT / cfg.ladybugSec) * Math.PI);
    const a = h.joints[INDEX_PROX];
    const b = h.joints[INDEX_TIP];
    this.ladybug.position.lerpVectors(a, b, 0.1 + 0.75 * e).add(this.tmp.set(0, 0.008, 0));
    // Facing the way it walks.
    const forward = Math.sin((this.bugT / cfg.ladybugSec) * Math.PI) >= 0;
    this.tmp.subVectors(forward ? b : a, forward ? a : b).normalize();
    this.ladybug.lookAt(this.tmp2.copy(this.ladybug.position).add(this.tmp));
  }

  /** Fireflies drift and blink at dusk, and gather near an open hand. */
  private firefliesTick(dt: number): void {
    const amount = Math.min(1, Math.max(0, (this.time - cfg.firefliesAfter) / 4));
    const p = this.fireflies.positions;
    const v = this.fireVel;
    for (let i = 0; i < cfg.fireflies; i++) {
      const o = i * 3;
      const t = this.time * 0.3 + i;
      v[o] += (Math.sin(t * 1.7) * 0.05 - v[o] * 0.5) * dt;
      v[o + 1] += (Math.sin(t * 2.3) * 0.04 - v[o + 1] * 0.5) * dt;
      v[o + 2] += (Math.cos(t * 1.3) * 0.05 - v[o + 2] * 0.5) * dt;
      // Drawn to an open hand.
      for (const side of ['left', 'right'] as const) {
        const h = this.signs[side];
        if (!h.tracked || h.sign !== 'open') continue;
        const dx = h.palm.x - p[o];
        const dy = h.palm.y + 0.15 - p[o + 1];
        const dz = h.palm.z - p[o + 2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1.4 && dist > 0.12) {
          const f = (0.25 * dt) / dist;
          v[o] += dx * f;
          v[o + 1] += dy * f;
          v[o + 2] += dz * f;
        }
      }
      p[o] += v[o] * dt;
      p[o + 1] = Math.min(2.4, Math.max(0.15, p[o + 1] + v[o + 1] * dt));
      p[o + 2] += v[o + 2] * dt;
    }
    this.fireflies.update(this.time, amount * this.kit.amount);
  }
}

