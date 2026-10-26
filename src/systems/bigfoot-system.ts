import {
  CanvasTexture,
  createSystem,
  Entity,
  Group,
  Matrix4,
  Quaternion,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { LoopHandle, Sound } from '../audio/engine.js';
import { BIGFOOT_HEIGHT, BigfootRig, createBigfoot } from '../characters/bigfoot.js';
import { Bigfoot, BigfootState } from '../components/bigfoot.js';
import { DevControls, GazeTarget } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { NycLayout } from '../showcase/nyc-bedroom.js';

/** Look at sleeping Bigfoot this long to slip into his dream; else it starts by itself. */
const DREAM_DWELL_SEC = 1.5;
const DREAM_AUTO_SEC = 12;
const UP = new Vector3(0, 1, 0);
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
type State = (typeof BigfootState)[keyof typeof BigfootState];

/**
 * Bigfoot in the room: asleep (and snoring) on the bed — or a cozy spot on the
 * floor in passthrough — until the user looks at him; then he sleep-walks to
 * the TV and leaps in. At the finale he pops back out, shuffles to bed and
 * flops down; on waking he stretches, stands and waves.
 */
export class BigfootSystem extends createSystem({
  director: { required: [Ritual, RoomSlots, DevControls] },
}) {
  private rig?: BigfootRig;
  private entity?: Entity;
  private target?: Entity;
  private loading = false;
  private beat = newBeatContext();
  private dwell = 0;
  private snore?: LoopHandle;
  private zzz: { sprite: Sprite; age: number }[] = [];
  private zzzTimer = 0;
  // Layout (world space), fixed once known.
  private restPos = new Vector3();
  private restAxis = new Vector3();
  private exitTop = new Vector3();
  private exit = new Vector3();
  private tvFloor = new Vector3();
  private tvPoint = new Vector3();
  private lying = new Quaternion();
  private standing = new Quaternion();
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private head = new Vector3();
  private m = new Matrix4();
  private faceQuat = new Quaternion();

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.loading && d.getValue(RoomSlots, 'anchorReady')) {
      this.loading = true;
      void this.spawn(d);
    }
    if (!this.rig || !this.entity) return;
    const delta = dreamDelta(d, realDelta);
    const phase = d.getValue(Ritual, 'phase');
    const phaseTime = d.getValue(Ritual, 'phaseTime') ?? 0;

    if (phase === RitualPhase.Arrival || phase === RitualPhase.Idle) {
      this.lieDown();
      this.waitForGaze(d, delta > 0 ? realDelta : 0, phaseTime);
    } else if (phase === RitualPhase.Asleep) {
      if (!readBeat(d, this.beat)) this.lieDown();
      else if (this.beat.scene === 'sleepwalk') this.sleepwalk(this.beat.time);
      else if (this.beat.scene === 'finale') this.returnToBed(this.beat.time);
      else this.setState(BigfootState.InTv);
    } else if (phase === RitualPhase.Waking || phase === RitualPhase.Awake) {
      this.wake(phase === RitualPhase.Awake ? 99 : phaseTime);
    }

    const sleeping = this.state() === BigfootState.Sleeping;
    this.snore?.setGain(sleeping ? 0.7 : 0);
    this.updateZzz(sleeping, delta);
    this.entity.setValue(Bigfoot, 'stateTime', (this.entity.getValue(Bigfoot, 'stateTime') ?? 0) + delta);
    this.rig.update(delta);
    if (this.target?.object3D) this.rig.headPosition(this.target.object3D.position);
  }

  /** Arrival: a look at sleeping Bigfoot (or patience) starts the dream. */
  private waitForGaze(d: Entity, realDelta: number, phaseTime: number): void {
    const focused = !!this.target?.getValue(GazeTarget, 'focused');
    this.dwell = focused ? this.dwell + realDelta : Math.max(0, this.dwell - realDelta * 0.5);
    if (this.dwell >= DREAM_DWELL_SEC || phaseTime >= DREAM_AUTO_SEC) {
      if (this.dwell >= DREAM_DWELL_SEC) Sound.play('bloom', this.restPos, 0.8);
      d.setValue(Ritual, 'phase', RitualPhase.Asleep);
      d.setValue(Ritual, 'phaseTime', 0);
      this.dwell = 0;
    }
  }

  private state(): State {
    return (this.entity?.getValue(Bigfoot, 'state') as State) ?? BigfootState.Sleeping;
  }

  private setState(s: State): void {
    if (!this.entity || this.state() === s) return;
    this.entity.setValue(Bigfoot, 'state', s);
    this.entity.setValue(Bigfoot, 'stateTime', 0);
    this.rig!.root.visible = s !== BigfootState.InTv;
  }

  // ---- choreography (all times in dream seconds) ---------------------------

  /** Root (feet) position when lying on his back along the surface, head on the pillows. */
  private lyingPosition(out: Vector3): Vector3 {
    return out.copy(this.restPos).addScaledVector(this.restAxis, -BIGFOOT_HEIGHT / 2);
  }

  private lieDown(): void {
    this.setState(BigfootState.Sleeping);
    const r = this.rig!.root;
    // Face up, stretched out; the rig's self-grounding rests his back on the mattress.
    r.quaternion.copy(this.lying);
    this.lyingPosition(r.position);
    r.scale.setScalar(1);
    this.rig!.play('rest');
  }

  /** Yaw facing from → to. Returns a shared scratch quaternion: copy or slerp it at once. */
  private face(from: Vector3, to: Vector3): Quaternion {
    return this.faceQuat.setFromAxisAngle(UP, Math.atan2(to.x - from.x, to.z - from.z));
  }

  /** Position along a hop from a to b at k (0..1), peaking `height` above the line. */
  private arc(a: Vector3, b: Vector3, k: number, height: number, out: Vector3): Vector3 {
    return out.lerpVectors(a, b, k).addScaledVector(UP, Math.sin(Math.PI * k) * height);
  }

  private sleepwalk(t: number): void {
    const r = this.rig!.root;
    if (t >= 11.2) return this.setState(BigfootState.InTv);
    this.setState(BigfootState.Sleepwalking);
    r.scale.setScalar(1);
    if (t < 1) {
      const k = ease(t);
      r.quaternion.copy(this.lying).slerp(this.face(this.exitTop, this.exit), k);
      r.position.lerpVectors(this.lyingPosition(this.tmp), this.exitTop, k);
      this.rig!.play('stretch');
    } else if (t < 1.8) {
      this.arc(this.exitTop, this.exit, (t - 1) / 0.8, 0.25, r.position);
      r.quaternion.copy(this.face(this.exit, this.tvFloor));
      this.rig!.play('jump', { once: true });
    } else if (t < 9.8) {
      r.position.lerpVectors(this.exit, this.tvFloor, (t - 1.8) / 8);
      r.quaternion.copy(this.face(this.exit, this.tvFloor));
      this.rig!.play('walk');
    } else {
      const k = ease((t - 9.8) / 1.4);
      this.arc(this.tvFloor, this.tvPoint, k, 0.35, r.position);
      r.position.addScaledVector(UP, -BIGFOOT_HEIGHT * 0.5 * k);
      r.scale.setScalar(1 - 0.85 * k);
      r.quaternion.copy(this.face(this.tvFloor, this.tvPoint));
      this.rig!.play('jump', { once: true });
    }
  }

  private returnToBed(t: number): void {
    const r = this.rig!.root;
    if (t < 6) return this.setState(BigfootState.InTv);
    this.setState(BigfootState.Returning);
    if (t < 7.4) {
      const k = ease((t - 6) / 1.4);
      this.tmp2.copy(this.tvPoint).addScaledVector(UP, -BIGFOOT_HEIGHT * 0.5);
      this.arc(this.tmp2, this.tvFloor, k, 0.4, r.position);
      r.scale.setScalar(0.15 + 0.85 * k);
      r.quaternion.copy(this.face(this.tvPoint, this.tvFloor));
      this.rig!.play('jump', { once: true });
    } else if (t < 12.2) {
      r.scale.setScalar(1);
      r.position.lerpVectors(this.tvFloor, this.exit, (t - 7.4) / 4.8);
      r.quaternion.copy(this.face(this.tvFloor, this.exit));
      this.rig!.play('walk');
    } else {
      const k = clamp01((t - 12.2) / 1.8);
      if (k < 0.5) {
        this.arc(this.exit, this.exitTop, k * 2, 0.3, r.position);
        this.rig!.play('jump', { once: true });
      } else {
        const j = ease((k - 0.5) * 2);
        r.position.lerpVectors(this.exitTop, this.lyingPosition(this.tmp), j);
        r.quaternion.copy(this.face(this.exit, this.exitTop)).slerp(this.lying, j);
        this.rig!.play('rest');
      }
    }
  }

  private wake(t: number): void {
    const r = this.rig!.root;
    this.player.head.getWorldPosition(this.head);
    this.head.y = 0;
    if (t < 1.5) {
      this.setState(BigfootState.Stretching);
      const k = ease(t / 1.5);
      this.arc(this.lyingPosition(this.tmp), this.exit, k, 0.25, r.position);
      r.quaternion.copy(this.lying).slerp(this.face(this.exit, this.head), k);
      this.rig!.play('jump', { once: true });
    } else if (t < 4) {
      this.setState(BigfootState.Stretching);
      r.position.copy(this.exit);
      r.quaternion.copy(this.face(this.exit, this.head));
      this.rig!.play('stretch');
    } else {
      this.setState(BigfootState.Awake);
      r.position.copy(this.exit);
      r.quaternion.copy(this.face(this.exit, this.head));
      this.rig!.play(t < 7 ? 'wave' : 'idle');
    }
  }

  private updateZzz(sleeping: boolean, delta: number): void {
    if (sleeping) {
      this.zzzTimer -= delta;
      if (this.zzzTimer <= 0) {
        this.zzzTimer = 1.6;
        const free = this.zzz.find((z) => z.age < 0) ?? this.zzz[0];
        if (free) free.age = 0;
      }
    }
    // Rise from his head, wherever the sleeping pose puts it.
    this.rig!.headPosition(this.tmp2).addScaledVector(UP, 0.15);
    for (const z of this.zzz) {
      if (z.age < 0) continue;
      z.age += delta;
      const k = z.age / 3.4;
      if (k >= 1 || !sleeping) {
        z.age = -1;
        z.sprite.visible = false;
        continue;
      }
      z.sprite.visible = true;
      z.sprite.position.copy(this.tmp2).add(this.tmp.set(Math.sin(z.age * 2) * 0.08, k * 0.5, 0));
      z.sprite.scale.setScalar(0.08 + k * 0.1);
      z.sprite.material.opacity = Math.sin(Math.PI * k);
    }
  }

  private async spawn(d: Entity): Promise<void> {
    this.layout(d);
    this.rig = await createBigfoot();
    this.rig.root.name = 'RoomBigfoot';
    this.entity = this.world.createTransformEntity(this.rig.root);
    this.entity.addComponent(Bigfoot, { state: BigfootState.Sleeping });
    const gaze = new Group();
    gaze.name = 'BigfootGazeTarget';
    this.target = this.world.createTransformEntity(gaze);
    this.target.addComponent(GazeTarget, { radius: 0.45 });
    const mat = new SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const sprite = new Sprite(mat.clone());
      sprite.visible = false;
      this.world.createTransformEntity(sprite);
      this.zzz.push({ sprite, age: -1 });
    }
    this.lieDown();
    this.snore = Sound.loop('snore', this.restPos, 0);
  }

  /** Where he sleeps, where he gets off, and the walk to the TV (world space). */
  private layout(d: Entity): void {
    const anchor = this.tmp.fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    const normal = this.tmp2.fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    this.tvPoint.copy(anchor).addScaledVector(normal, 0.05);
    this.tvFloor.set(anchor.x, 0, anchor.z).addScaledVector(normal, 0.55);
    if (Showcase.enabled) {
      const bed = NycLayout.bed;
      this.restPos.copy(bed.top);
      this.restAxis.set(-1, 0, 0);
      this.exitTop.set(bed.top.x + bed.length / 2 - 0.25, bed.top.y, bed.top.z);
      this.exit.set(bed.top.x + bed.length / 2 + 0.45, 0, bed.top.z);
    } else if (d.getValue(RoomSlots, 'restFound')) {
      // Passthrough: the user's real bed or couch. Head toward the end farther from the TV.
      this.restPos.fromArray(d.getVectorView(RoomSlots, 'restCenter'));
      this.restAxis.fromArray(d.getVectorView(RoomSlots, 'restAxis'));
      if (this.restAxis.dot(this.tmp.subVectors(this.tvFloor, this.restPos)) > 0) this.restAxis.negate();
      const half = (d.getValue(RoomSlots, 'restLength') ?? 2) / 2;
      this.exitTop.copy(this.restPos).addScaledVector(this.restAxis, -(half - 0.25));
      this.exit.copy(this.restPos).addScaledVector(this.restAxis, -(half + 0.45)).setY(0);
    } else {
      // Passthrough, no bed or couch found: a cozy floor spot ahead-left, always
      // between the user and the TV so he never sleeps behind the screen.
      this.player.head.getWorldPosition(this.head);
      const fwd = this.tmp2.subVectors(this.tvFloor, this.head).setY(0);
      const toTv = fwd.length();
      fwd.normalize();
      const left = new Vector3().crossVectors(UP, fwd);
      this.restPos.copy(this.head).setY(0.02).addScaledVector(fwd, Math.min(1.5, toTv * 0.5)).addScaledVector(left, 0.6);
      this.restAxis.copy(left);
      this.exitTop.copy(this.restPos).addScaledVector(fwd, 0.5);
      this.exit.copy(this.exitTop);
    }
    // Lying on his back along the surface: model up (+Y) → head direction, model front (+Z) → up.
    const x = new Vector3().crossVectors(this.restAxis, UP);
    this.lying.setFromRotationMatrix(this.m.makeBasis(x, this.restAxis, UP));
    this.standing.copy(this.face(this.restPos, this.tvFloor));
  }
}

function zzzTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.font = 'italic 700 52px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#9fb8ff';
    g.shadowBlur = 8;
    g.fillStyle = '#ffffff';
    g.fillText('z', 32, 34);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
