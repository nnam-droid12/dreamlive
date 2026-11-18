import { Group, Mesh, Vector3 } from '@iwsdk/core';
import { buildEagle, buildEagleEgg, EAGLE, poseEagle } from '../../scene-assets/eagle.scene-asset.js';
import { Tuning } from '../../config/tuning.js';

const cfg = Tuning.garden;
const ease = (t: number) => t * t * (3 - 2 * t);

export type EagleState = 'away' | 'arrive' | 'mat' | 'approach' | 'perch' | 'lay' | 'leave' | 'gone';

/** The left hand as the eagle sees it: held out palm up and still (`ready`), where, and which way it faces. */
/** The right hand's pinch (thumb and index tips together), for picking up the egg. */
export interface EaglePinch {
  on: boolean;
  at: Vector3;
}

export interface EaglePalm {
  ready: boolean;
  palm: Vector3;
  normal: Vector3;
}

/**
 * The garden's eagle: some seconds into the garden it glides in from the sky and
 * lands on the picnic mat. Hold your left palm out and it comes to you: it flies
 * from the mat, lands on your palm, lays an egg there and flies off into the sky.
 * The egg stays on your palm (it rolls off onto the lawn if you tip your hand).
 */
export class GardenEagle {
  readonly root: Group = buildEagle();
  readonly egg: Mesh = buildEagleEgg();
  state: EagleState = 'away';
  /** Seconds in the current state. */
  t = 0;
  private from = new Vector3();
  private to = new Vector3();
  private pos = new Vector3();
  private last = new Vector3();
  private look = new Vector3();
  private side = new Vector3();
  private perch = new Vector3();
  private up = new Vector3(0, 1, 0);
  private eggOn: 'none' | 'palm' | 'held' | 'falling' | 'lawn' = 'none';
  private eggV = 0;
  private eggGrow = 0;
  private palmFor = 0;
  private flapPhase = 0;
  /** On your palm it walks round from facing you to showing you its side (rad, 0 .. pi/2). */
  private turn = 0;
  /** Where on your palm it lays the egg: just behind its tail (world offset from the palm). */
  private eggOff = new Vector3();
  private back = new Vector3();
  private torso = this.root.getObjectByName('Torso');
  private legs = this.root.getObjectByName('Legs');
  private axisX = new Vector3(1, 0, 0);

  constructor() {
    // Bigger than the model's hand-sized default: an eagle should feel big (about 50 cm long, 1 m wingspan).
    this.root.scale.setScalar(cfg.eagleScale);
    this.egg.scale.setScalar(cfg.eagleScale * cfg.eggScale);
    this.root.visible = false;
    this.egg.visible = false;
    // Drawn after the see-through hands, so on your palm it sits on it, not behind the glass.
    this.root.traverse((o) => (o.renderOrder = 20));
    this.egg.renderOrder = 21;
  }

  /** A new garden visit: the eagle is away again, the egg gone. */
  reset(): void {
    this.state = 'away';
    this.t = 0;
    this.root.visible = false;
    this.egg.visible = false;
    this.eggOn = 'none';
    this.palmFor = 0;
    this.turn = 0;
    this.eggOff.set(0, 0, 0);
  }

  /** True while the eagle owns the left palm (the butterflies keep away). */
  get wantsPalm(): boolean {
    return this.state === 'mat' || this.state === 'approach' || this.state === 'perch' || this.state === 'lay' || (this.state === 'leave' && this.t < 1.5) || this.eggOn === 'palm';
  }

  /** Where it is (world). */
  get position(): Vector3 {
    return this.pos;
  }

  /**
   * Step the eagle. `time` = seconds since the garden began; `mat` = where it lands;
   * `head`/`fwd` = the viewer (where it comes from, which way it faces); `palm` = the left hand.
   * Returns a caption when something happens (or '').
   */
  update(dt: number, time: number, mat: Vector3, head: Vector3, fwd: Vector3, palm: EaglePalm, pinch: EaglePinch): string {
    this.t += dt;
    this.last.copy(this.pos);
    this.side.set(-fwd.z, 0, fwd.x);
    this.perch.copy(palm.palm).addScaledVector(palm.normal, 0.012);
    let say = '';
    let flap = 0;
    let fold = 1;
    let pitch = 0.5;
    let tip = 0;
    let sit = 0;
    switch (this.state) {
      case 'away':
        if (time > cfg.eagleAfter) {
          // From high in the sky ahead and off to the right.
          this.from.copy(mat).addScaledVector(fwd, 14).addScaledVector(this.side, -9).addScaledVector(this.up, 7);
          this.pos.copy(this.from);
          this.go('arrive');
          this.root.visible = true;
          say = 'An eagle!';
        }
        break;
      case 'arrive': {
        const k = Math.min(1, this.t / cfg.eagleArriveSec);
        // A wide gliding curve, then a steep last drop onto the mat, wings flared.
        this.pos.lerpVectors(this.from, mat, ease(k));
        this.pos.addScaledVector(this.side, Math.sin(Math.PI * k) * 2.5);
        this.pos.y += Math.sin(Math.PI * Math.min(1, k * 1.15)) * 1.2;
        this.flapPhase += dt * (k > 0.8 ? 16 : 4);
        flap = k > 0.8 ? 0.15 + 0.75 * Math.sin(this.flapPhase) : 0.12 + 0.12 * Math.sin(this.flapPhase);
        tip = flap * 0.3;
        fold = k > 0.95 ? (k - 0.95) / 0.05 : 0;
        pitch = 0.1 + 0.9 * Math.max(0, (k - 0.75) / 0.25);
        if (k >= 1) {
          this.go('mat');
          say = 'Hold out your left palm to call the eagle';
        }
        break;
      }
      case 'mat':
        this.pos.copy(mat);
        this.palmFor = palm.ready ? this.palmFor + dt : 0;
        if (this.palmFor > cfg.palmHold) {
          this.from.copy(this.pos);
          this.go('approach');
        }
        break;
      case 'approach': {
        const k = Math.min(1, this.t / cfg.eagleApproachSec);
        this.pos.lerpVectors(this.from, this.perch, ease(k));
        this.pos.y += Math.sin(Math.PI * k) * 0.45;
        this.flapPhase += dt * 15;
        flap = 0.2 + 0.8 * Math.sin(this.flapPhase);
        tip = flap * 0.35;
        fold = k < 0.1 ? 1 - k / 0.1 : k > 0.9 ? (k - 0.9) / 0.1 : 0;
        pitch = 0.25 + 0.6 * k;
        if (k >= 1) this.go('perch');
        break;
      }
      case 'perch':
      case 'lay':
        this.pos.copy(this.perch);
        if (this.state === 'perch') {
          // It walks round on your palm, a few small steps, from facing you to showing you its side.
          const k = Math.min(1, Math.max(0, (this.t - cfg.eagleTurnFrom) / cfg.eagleTurnSec));
          const steps = 4;
          const s = k * steps;
          const step = Math.min(steps, Math.floor(s) + ease(s - Math.floor(s)));
          this.turn = (step / steps) * Math.PI * 0.5;
          if (k > 0 && k < 1) {
            // Each step: a small lift and a sway of the body.
            const lift = Math.abs(Math.sin(s * Math.PI));
            this.pos.y += lift * 0.006 * cfg.eagleScale;
            pitch = 0.5 + 0.05 * lift;
          }
        }
        if (this.state === 'perch' && this.t > cfg.eagleLayAfter) {
          this.go('lay');
          // Laid on the side toward you, so you see it appear beside its feet.
          this.back.set(head.x - this.pos.x, 0, head.z - this.pos.z).normalize();
          this.eggOff.copy(this.back).multiplyScalar(0.045 * cfg.eagleScale);
        } else if (this.state === 'lay') {
          // It sits down on your hand, lays the egg, then stands up again before it flies.
          const up = cfg.eagleLaySec - 0.6;
          sit = this.t < 0.5 ? ease(this.t / 0.5) : this.t < up ? 1 : 1 - ease(Math.min(1, (this.t - up) / 0.6));
          pitch = 0.5 - 0.3 * sit;
          if (this.t > 0.6 && this.eggOn === 'none') {
            this.eggOn = 'palm';
            this.eggGrow = 0;
            this.egg.visible = true;
          }
          if (this.t > cfg.eagleLaySec) {
            this.from.copy(this.pos);
            this.go('leave');
            say = 'The eagle left you an egg';
          }
        }
        // A lowered or turned hand sends it off.
        if (!palm.ready && this.t > 0.4 && (this.state as EagleState) !== 'leave') {
          this.from.copy(this.pos);
          this.go('leave');
        }
        break;
      case 'leave': {
        const k = Math.min(1, this.t / cfg.eagleLeaveSec);
        this.to.copy(this.from).addScaledVector(fwd, 16).addScaledVector(this.side, 6).addScaledVector(this.up, 10);
        this.pos.lerpVectors(this.from, this.to, k * k);
        this.flapPhase += dt * 14;
        flap = 0.25 + 0.8 * Math.sin(this.flapPhase);
        tip = flap * 0.35;
        fold = Math.max(0, 1 - this.t / 0.25);
        pitch = 0.35;
        if (k >= 1) {
          this.go('gone');
          this.root.visible = false;
        }
        break;
      }
      case 'gone':
        break;
    }
    this.root.position.copy(this.pos);
    // Facing: along its flight; standing, toward you.
    if (this.state === 'mat' || this.state === 'perch' || this.state === 'lay') this.look.set(head.x, this.pos.y, head.z);
    else this.look.subVectors(this.pos, this.last).setY(0).add(this.pos);
    if (this.look.distanceToSquared(this.pos) > 1e-10) this.root.lookAt(this.look);
    // On your palm: turned round (walking) to show its side.
    if (this.state === 'perch' || this.state === 'lay') this.root.rotateY(this.turn);
    else this.turn = 0;
    poseEagle(this.root, flap, fold, pitch, tip);
    // Sitting: the body settles down onto its folded legs.
    if (this.torso) this.torso.position.y = EAGLE.torsoY * (1 - 0.55 * sit);
    if (this.legs) this.legs.scale.y = 1 - 0.75 * sit;
    this.stepEgg(dt, palm, pinch);
    return say;
  }

  private go(s: EagleState): void {
    this.state = s;
    this.t = 0;
  }

  /** The egg (world) while it is out, for the film's fingers; null otherwise. */
  get eggAt(): Vector3 | null {
    return this.eggOn === 'none' ? null : this.egg.position;
  }

  private stepEgg(dt: number, palm: EaglePalm, pinch: EaglePinch): void {
    // Pinch it with your other hand's fingers to lift it off your palm; let go to set it down.
    if (this.eggOn === 'palm' && this.eggGrow >= 1 && pinch.on && pinch.at.distanceTo(this.egg.position) < cfg.eggPinchReach) this.eggOn = 'held';
    if (this.eggOn === 'held') {
      if (!pinch.on) {
        this.eggOn = 'falling';
        this.eggV = 0;
        return;
      }
      // Held upright between thumb and finger.
      this.egg.position.copy(pinch.at).addScaledVector(this.up, -0.027 * cfg.eagleScale * cfg.eggScale);
      this.egg.quaternion.identity();
      return;
    }
    if (this.eggOn === 'palm') {
      this.eggGrow = Math.min(1, this.eggGrow + dt);
      this.egg.scale.setScalar((0.2 + 0.8 * ease(this.eggGrow)) * cfg.eagleScale * cfg.eggScale);
      this.egg.position.copy(palm.palm).add(this.eggOff).addScaledVector(palm.normal, 0.004);
      this.egg.quaternion.setFromUnitVectors(this.up, palm.normal);
      // Lower your hand to the mat (or the grass) and it is set down there; tip your hand and it rolls off.
      if (this.eggGrow >= 1 && (palm.palm.y < cfg.eggSetDown || palm.normal.y < 0.35)) {
        this.eggOn = 'falling';
        this.eggV = 0;
      }
    } else if (this.eggOn === 'falling') {
      this.eggV += 9.8 * dt;
      // It comes to rest lying on its side, on the mat.
      const rest = 0.014 + 0.016 * cfg.eagleScale * cfg.eggScale;
      this.egg.position.y = Math.max(rest, this.egg.position.y - this.eggV * dt);
      if (this.egg.position.y <= rest) {
        this.eggOn = 'lawn';
        this.egg.quaternion.setFromAxisAngle(this.axisX, Math.PI / 2);
      }
    }
  }
}
