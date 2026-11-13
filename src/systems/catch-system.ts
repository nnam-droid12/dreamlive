import {
  Box3,
  Color,
  createSystem,
  Entity,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Bigfoot } from '../components/bigfoot.js';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Gestures, HandGestureState } from '../components/hands.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { dreamNight } from '../dreams/nights.js';
import { Tuning } from '../config/tuning.js';
import { buildGift } from '../visuals/goodies.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import { HandReading, HandSigns } from '../input/hand-signs.js';
import type { EmulatedHand } from './real-hands.js';

const SPAWN_EVERY = 2.4;
const FLIGHT_SEC = 2.2;
const HOVER_SEC = 1.4;
const FADE_SEC = 0.8;
const POOL = 6;

/** The gift you are holding (for the film's hand: hold it a moment, then lower it to the floor). */
export const GiftHold = { holding: false, holdFor: 0, inFlight: false, /** A gift is sliding off the hands or falling to the floor. */ placing: false, /** Seconds since a gift last landed on the floor. */ sincePlaced: 99 };
const TOUCH_RADIUS = 0.13;
const CUP_RADIUS = 0.2;
const ease = (t: number) => t * t * (3 - 2 * t);
type Kind = 'surf' | 'dj' | 'ski' | 'gift';

interface Flyer {
  obj: Object3D;
  kind: Kind;
  age: number;
  from: Vector3;
  to: Vector3;
  state: 'idle' | 'flying' | 'caught' | 'missed' | 'held' | 'placing' | 'placed';
  /** A gift on your palm: which hand holds it; where it settles on the floor; its fall speed. */
  holder?: 'left' | 'right';
  floorY: number;
  fall: number;
  spin: Vector3;
  /** Its own cloned materials, faded together. */
  mats: MeshStandardMaterial[];
  /** Seconds of flight and arc height (gifts thrown from the rooftop fly further and higher). */
  flight: number;
  arc: number;
}

/**
 * Hands-first magic during each act: little things fly out of the TV toward
 * the viewer — glowing starfish (surf), mirror disco balls (rooftop party),
 * sparkling snowballs (ski). Touch one or cup both hands under it to catch it;
 * a miss simply hovers in reach, then drifts down and fades. No penalty.
 */
export class CatchSystem extends createSystem({
  director: { required: [DreamDirector, Ritual, RoomSlots, DevControls, Gestures] },
  hands: { required: [HandGestureState] },
  bigfoot: { required: [Bigfoot] },
}) {
  private flyers: Flyer[] = [];
  private models = new Map<Kind, Object3D>();
  private beat = newBeatContext();
  private timer = 1;
  private anchor = new Vector3();
  private normal = new Vector3();
  private right = new Vector3();
  private up = new Vector3(0, 1, 0);
  private head = new Vector3();
  private signs = new HandSigns();
  private sideV = new Vector3();
  private headQuat = new Quaternion();
  private fwd = new Vector3();
  private side = new Vector3();
  private hand = new Vector3();
  private cup = new Vector3();
  private other = new Vector3();
  private otherCup = new Vector3();
  private taughtGoal = false;
  /** Flight-time multiplier (reduced motion slows catchables). */
  private slow = 1;

  init(): void {
    this.models.set('surf', starfish());
    this.models.set('dj', discoBall());
    this.models.set('ski', snowball());
    this.models.set('gift', buildGift(0xff5fb8));
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'anchorReady')) return;
    const delta = dreamDelta(d, realDelta);
    // Both hands' palms (from the joints: on a headset, or the emulator's hands the film drives).
    const dev = (window as unknown as { IWER_DEVICE?: { hands?: { left?: EmulatedHand; right?: EmulatedHand } } }).IWER_DEVICE;
    if (dev?.hands) this.signs.readEmulator(dev.hands, this.player);
    else this.signs.readFrame(this.xrFrame, this.xrManager.getReferenceSpace(), this.player);
    this.player.head.getWorldQuaternion(this.headQuat);
    this.signs.update(Math.min(realDelta, 0.1), this.sideV.set(1, 0, 0).applyQuaternion(this.headQuat).setY(0).normalize());
    const dreaming = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat);
    const scene = this.beat.scene;
    const tvAct = scene === 'surf' || scene === 'dj' || scene === 'ski';
    // Back home after the party, now and then the Yeti DJ throws a gift to the viewer too.
    const party = scene === 'gifts' && this.beat.time > 2;
    const kind: Kind | undefined = !dreaming ? undefined : tvAct ? (scene as Kind) : party ? 'gift' : undefined;
    // One gift at a time: none in the air or in your hand, and a moment after the last one was set down.
    const giftBusy = kind === 'gift' && this.flyers.some((x) => x.kind === 'gift' && (x.state === 'flying' || x.state === 'held' || x.state === 'placing'));
    GiftHold.inFlight = this.flyers.some((x) => x.kind === 'gift' && x.state === 'flying');
    const held = this.flyers.find((x) => x.kind === 'gift' && x.state === 'held');
    GiftHold.holding = !!held;
    GiftHold.holdFor = held ? held.age : 0;
    GiftHold.placing = this.flyers.some((x) => x.kind === 'gift' && x.state === 'placing');
    GiftHold.sincePlaced += delta;
    if (kind && !giftBusy && this.beat.progress > 0.08 && this.beat.progress < 0.95) {
      this.timer -= delta;
      if (this.timer <= 0) {
        // From the rooftop only now and then: most of his goodies go down to the street.
        this.timer = kind === 'gift' ? Tuning.rooftop.viewerThrowEvery : SPAWN_EVERY;
        this.launch(d, kind);
      }
    }
    const cupped = !!d.getValue(Gestures, 'cupped');
    if (cupped) this.cup.fromArray(d.getVectorView(Gestures, 'cupCenter'));
    for (const f of this.flyers) this.step(d, f, delta, cupped);
  }

  private step(d: Entity, f: Flyer, delta: number, cupped: boolean): void {
    if (f.state === 'idle' || f.state === 'placed') return;
    f.age += delta;
    const o = f.obj;
    if (f.kind === 'gift' && (f.state === 'held' || f.state === 'placing' || f.state === 'flying')) {
      if (this.giftStep(d, f, delta, cupped)) return;
    }
    if (f.state === 'flying') {
      const k = Math.min(1, f.age / (f.flight * this.slow));
      o.position.lerpVectors(f.from, f.to, ease(k)).addScaledVector(this.up, Math.sin(Math.PI * k) * f.arc);
      if (k >= 1) o.position.y += Math.sin(f.age * 3) * 0.01;
      // (Grows from small to its own size: a gift for your hands is smaller than the dream's catches.)
      o.scale.setScalar((0.4 + 0.6 * Math.min(1, k * 2)) * (f.kind === 'gift' ? Tuning.rooftop.viewerGiftScale : 1));
      o.rotation.x += f.spin.x * delta;
      o.rotation.y += f.spin.y * delta;
      if (f.kind === 'gift') {
        // (A gift's own step catches it or floats it down to the floor.)
      } else if (this.touched(o.position, cupped) || (k >= 1 && f.age > f.flight * this.slow + 0.35 && !!d.getValue(DevControls, 'autoCatch'))) {
        f.state = 'caught';
        f.age = 0;
        const caught = (d.getValue(DreamDirector, 'catches') ?? 0) + 1;
        d.setValue(DreamDirector, 'catches', caught);
        if (caught === dreamNight(d.getValue(Session, 'night') ?? 1).goldGoal) {
          Sound.play('bloom', o.position, 0.8);
          d.setValue(Caption, 'text', 'Golden memory earned!');
          d.setValue(Caption, 'ttl', 3);
        }
        Sound.play('catch', o.position, 0.6);
      } else if (f.age > f.flight * this.slow + HOVER_SEC) {
        f.state = 'missed';
        f.age = 0;
      }
    } else if (f.state === 'caught') {
      const k = Math.min(1, f.age / 0.45);
      o.scale.setScalar(1 + k * 0.8);
      o.position.y += delta * 0.4;
      this.fade(f, 1 - k);
      if (k >= 1) this.retire(f);
    } else {
      const k = Math.min(1, f.age / FADE_SEC);
      o.position.y -= delta * 0.25;
      this.fade(f, 1 - k);
      if (k >= 1) this.retire(f);
    }
  }

  /**
   * A gift for you: it flies to your open palm and stays there; lower your hand
   * (or tip your palm) and it drops to the floor, where it stays. Returns true
   * when it handled this frame.
   */
  private giftStep(d: Entity, f: Flyer, delta: number, cupped: boolean): boolean {
    const o = f.obj;
    const g = Tuning.rooftop;
    if (f.state === 'flying') {
      // Steer the landing toward both hands held out together in front of you (cupped, open or flat),
      // or else toward one open palm.
      const both = this.offering();
      const palm = both ? undefined : this.openPalm();
      if (both || palm) {
        if (palm) this.hand.copy(palm.palm);
        this.hand.y += 0.07;
        f.to.lerp(this.hand, Math.min(1, delta * 4));
      }
      // Near the end of its flight a gift settles into the hands held out for it.
      const settling = (both || !!palm) && f.age > f.flight * this.slow * 0.6 && o.position.distanceTo(this.hand) < Tuning.rooftop.giftSettle;
      if (settling || this.touched(o.position, cupped)) {
        f.state = 'held';
        f.age = 0;
        f.holder = this.nearestHand(o.position);
        const caught = (d.getValue(DreamDirector, 'catches') ?? 0) + 1;
        d.setValue(DreamDirector, 'catches', caught);
        const gold = caught === dreamNight(d.getValue(Session, 'night') ?? 1).goldGoal;
        if (gold) Sound.play('bloom', o.position, 0.8);
        d.setValue(Caption, 'text', gold ? 'Golden memory earned! Set it down, and he throws another.' : 'Lower your hands to set the gift on the floor.');
        d.setValue(Caption, 'ttl', 3);
        Sound.play('catch', o.position, 0.6);
        return true;
      }
      // Never caught: after a while it floats down to the floor by itself.
      if (f.age > f.flight * this.slow + g.giftWaitSec) this.place(f);
      return false;
    }
    if (f.state === 'held') {
      const h = f.holder ? this.signs[f.holder] : undefined;
      const lost = !h || !h.tracked;
      if (this.bothPalms(false)) {
        o.position.copy(this.hand).addScaledVector(this.cup, 0.06);
        o.rotation.y += delta * 0.6;
      } else if (h && !lost) {
        this.hand.copy(h.palm);
        this.cup.copy(h.normal);
        o.position.copy(this.hand).addScaledVector(this.cup, 0.06);
        o.rotation.y += delta * 0.6;
      }
      this.player.head.getWorldPosition(this.head);
      const low = !lost && this.hand.y < this.head.y - g.giftSetDown;
      const tipped = !lost && this.cup.y < -0.2;
      if ((lost || low || tipped) && f.age > 0.6) this.place(f);
      return true;
    }
    // Placing: it drops (a little gravity) and settles on the floor.
    f.fall += 9.8 * delta * 0.5;
    o.position.y = Math.max(f.floorY, o.position.y - f.fall * delta);
    if (o.position.y <= f.floorY) {
      f.state = 'placed';
      GiftHold.sincePlaced = 0;
      Sound.play('catch', o.position, 0.25);
      this.timer = g.giftAfterPlaced;
    }
    return true;
  }

  private place(f: Flyer): void {
    f.state = 'placing';
    f.age = 0;
    f.fall = 0;
    const box = new Box3().setFromObject(f.obj);
    f.floorY = f.obj.position.y - box.min.y + 0.002;
  }

  /**
   * Both hands tracked and held together (palms within 30 cm); `this.hand` = the
   * point between the palms, `this.cup` = their average facing. With `palmsUp`,
   * both must also face up.
   */
  private bothPalms(palmsUp: boolean): boolean {
    const l = this.signs.left;
    const r = this.signs.right;
    if (!l.tracked || !r.tracked) return false;
    if (palmsUp && (!this.palmOut(l) || !this.palmOut(r))) return false;
    if (l.palm.distanceTo(r.palm) > 0.3) return false;
    this.hand.copy(l.palm).add(r.palm).multiplyScalar(0.5);
    this.cup.copy(l.normal).add(r.normal).normalize();
    return true;
  }

  /**
   * Both hands held out together to receive: tracked, side by side (palms within 30 cm),
   * in front of you and below your eyes. `this.hand` = the point between the palms.
   */
  private offering(): boolean {
    if (!this.bothPalms(false)) return false;
    this.player.head.getWorldPosition(this.head);
    const below = this.head.y - this.hand.y;
    return below > 0.05 && below < Tuning.rooftop.giftSetDown && Math.hypot(this.hand.x - this.head.x, this.hand.z - this.head.z) > 0.15;
  }

  /** A tracked hand held out to receive: palm facing mostly up (open, or gently cupped). */
  private openPalm(): HandReading | undefined {
    for (const side of ['left', 'right'] as const) if (this.palmOut(this.signs[side])) return this.signs[side];
    return undefined;
  }

  private palmOut(h: HandReading): boolean {
    return h.tracked && h.normal.y > Tuning.rooftop.giftPalmUp;
  }

  private nearestHand(p: Vector3): 'left' | 'right' | undefined {
    const l = this.signs.left;
    const r = this.signs.right;
    if (!l.tracked && !r.tracked) return undefined;
    if (!r.tracked) return 'left';
    if (!l.tracked) return 'right';
    return l.palm.distanceTo(p) <= r.palm.distanceTo(p) ? 'left' : 'right';
  }

  private touched(p: Vector3, cupped: boolean): boolean {
    if (cupped && this.cup.distanceTo(p) < CUP_RADIUS) return true;
    for (const side of ['left', 'right'] as const) {
      const h = this.signs[side];
      if (h.tracked && h.palm.distanceTo(p) < TOUCH_RADIUS) return true;
    }
    for (const h of this.queries.hands.entities) {
      if (!h.getValue(HandGestureState, 'tracked')) continue;
      this.hand.fromArray(h.getVectorView(HandGestureState, 'palmCenter'));
      if (this.hand.distanceTo(p) < TOUCH_RADIUS) return true;
    }
    const pads = this.input.xr.gamepads;
    if (pads.left && this.player.gripSpaces.left.getWorldPosition(this.hand).distanceTo(p) < TOUCH_RADIUS) return true;
    if (pads.right && this.player.gripSpaces.right.getWorldPosition(this.hand).distanceTo(p) < TOUCH_RADIUS) return true;
    return false;
  }

  private launch(d: Entity, kind: Kind): void {
    if (!this.taughtGoal) {
      this.taughtGoal = true;
      const goal = dreamNight(d.getValue(Session, 'night') ?? 1).goldGoal;
      d.setValue(Caption, 'text', `Catch ${goal} things from the dream for a golden memory.`);
      d.setValue(Caption, 'ttl', 6);
    }
    let f = this.flyers.find((x) => x.state === 'idle' && x.kind === kind);
    if (!f) {
      if (this.flyers.filter((x) => x.kind === kind).length >= POOL) {
        // A full pool: the oldest gift on the floor makes way.
        const oldest = this.flyers.find((x) => x.kind === kind && x.state === 'placed');
        if (!oldest) return;
        this.retire(oldest);
        return this.launch(d, kind);
      }
      const obj = this.models.get(kind)!.clone(true);
      const mats: MeshStandardMaterial[] = [];
      obj.traverse((m) => {
        const mesh = m as Mesh;
        if (!mesh.isMesh) return;
        const mat = (mesh.material as MeshStandardMaterial).clone();
        mesh.material = mat;
        mats.push(mat);
      });
      this.world.createTransformEntity(obj);
      f = { obj, kind, age: 0, from: new Vector3(), to: new Vector3(), state: 'idle', spin: new Vector3(), mats, flight: FLIGHT_SEC, arc: 0.35, floorY: 0, fall: 0 };
      this.flyers.push(f);
    }
    this.anchor.fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    this.normal.fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    this.right.crossVectors(this.up, this.normal).normalize();
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQuat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.headQuat).setY(0).normalize();
    this.side.crossVectors(this.up, this.fwd).normalize();
    if (kind === 'gift' && d.getValue(RoomSlots, 'windowReady')) {
      // Thrown by the Yeti DJ from the party roof, in through the open window.
      const o = d.getVectorView(RoomSlots, 'windowOrigin');
      const out = d.getVectorView(RoomSlots, 'windowOut');
      const along = d.getVectorView(RoomSlots, 'windowAlong');
      const dj = Rooftop.djSpot;
      f.from.set(o[0] + out[0] * dj.x + along[0] * dj.z, o[1] + dj.y + 1.5, o[2] + out[2] * dj.x + along[2] * dj.z);
      f.flight = Tuning.rooftop.viewerFlightSec;
      f.arc = Tuning.rooftop.viewerArc;
    } else {
      f.from.copy(this.anchor).addScaledVector(this.normal, 0.08).addScaledVector(this.right, (Math.random() - 0.5) * 1.0);
      f.from.y += (Math.random() - 0.5) * 0.5;
      f.flight = FLIGHT_SEC;
      f.arc = 0.35;
    }
    // Ends floating within easy reach: ahead of the chest, a little below the eyes.
    const calm = !!d.getValue(Session, 'reducedMotion');
    this.slow = calm ? 1.6 : 1;
    const gift = kind === 'gift';
    // Gifts for the viewer are small and land at hand height, off to one side, so they never fill the view.
    f.obj.scale.setScalar(gift ? Tuning.rooftop.viewerGiftScale : 1);
    const reach = gift ? Tuning.rooftop.viewerGiftReach : calm ? 0.6 : 0.42;
    const sideways = gift ? (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.12) : (Math.random() - 0.5) * 0.5;
    f.to.copy(this.head).addScaledVector(this.fwd, calm ? Math.max(reach, 0.6) : reach).addScaledVector(this.side, sideways);
    f.to.y -= gift ? Tuning.rooftop.viewerGiftDrop : 0.28;
    f.spin.set(Math.random() * 2 - 1, Math.random() * 3 - 1.5, 0);
    f.state = 'flying';
    f.age = 0;
    f.obj.visible = true;
    f.obj.position.copy(f.from);
    this.fade(f, 1);
  }

  private fade(f: Flyer, a: number): void {
    for (const mat of f.mats) {
      mat.transparent = a < 1;
      mat.opacity = a;
    }
  }

  private retire(f: Flyer): void {
    f.state = 'idle';
    f.obj.visible = false;
  }
}

function wrap(name: string, m: Mesh): Object3D {
  const g = new Group();
  g.name = name;
  g.add(m);
  g.visible = false;
  return g;
}

function starfish(): Object3D {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.022 : 0.055;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const geo = new ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  geo.center();
  return wrap('Starfish', new Mesh(geo, new MeshStandardMaterial({ color: 0xff8a5c, roughness: 0.5, emissive: new Color(0xff6a3d), emissiveIntensity: 0.5 })));
}

function discoBall(): Object3D {
  const mat = new MeshStandardMaterial({ color: 0xdfe6ff, roughness: 0.08, metalness: 1, flatShading: true, emissive: new Color(0xff5fb8), emissiveIntensity: 0.25 });
  return wrap('DiscoBall', new Mesh(new IcosahedronGeometry(0.05, 2), mat));
}

function snowball(): Object3D {
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: new Color(0x9fb8ff), emissiveIntensity: 0.35 });
  return wrap('Snowball', new Mesh(new SphereGeometry(0.05, 18, 12), mat));
}
