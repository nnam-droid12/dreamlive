import { createSystem, Entity, Matrix4, Vector3 } from '@iwsdk/core';
import { Gestures, HandGestureState, Handedness } from '../components/hands.js';
import { StageSurface } from '../components/stage.js';
import { Tuning } from '../config/tuning.js';

/** Joints read per hand: palm center = mid(metacarpal, knuckle); normal from metacarpal. */
const JOINT_NAMES: XRHandJoint[] = [
  'wrist',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
];
const SPEED_SMOOTHING = 0.3;

/** XRFrame.fillPoses (WebXR Hand Input) is missing from the bundled DOM typings. */
type FillPosesFrame = XRFrame & {
  fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean;
};
const cfg = Tuning.palmCalibration;
const gest = Tuning.gestures;
const HUSH_MAX_SPEED = 0.15;

/**
 * Reads hand joints straight from WebXR and classifies each hand's palm pose
 * into HandGestureState (tracked, palmDown, still, center, normal, speed).
 * Phase 1 only needs "flat palm, still"; later phases add cupped/hush/pinch/palm-out.
 */
export class GestureSystem extends createSystem({
  hands: { required: [HandGestureState] },
  director: { required: [Gestures, StageSurface] },
}) {
  private poses = new Float32Array(16 * JOINT_NAMES.length);
  private jointSpaces = new WeakMap<XRHand, XRJointSpace[]>();
  private jointMatrix = new Matrix4();
  private center = new Vector3();
  private knuckle = new Vector3();
  private normal = new Vector3();
  private cosMaxTilt = Math.cos((cfg.maxPalmTiltDeg * Math.PI) / 180);
  private cosMaxCup = Math.cos((gest.cupMaxTiltDeg * Math.PI) / 180);
  private a = new Vector3();
  private b = new Vector3();
  private left?: Entity;
  private right?: Entity;

  init(): void {
    for (const hand of [Handedness.Left, Handedness.Right]) {
      this.world.createEntity().addComponent(HandGestureState, { hand });
    }
  }

  update(delta: number): void {
    const frame = this.xrFrame;
    const refSpace = this.xrManager.getReferenceSpace();
    const sources = frame?.session.inputSources;
    for (const entity of this.queries.hands.entities) {
      const handedness = entity.getValue(HandGestureState, 'hand');
      let hand: XRHand | undefined;
      if (sources) {
        for (let i = 0; i < sources.length; i++) {
          const s = sources[i];
          if (s.hand && s.handedness === handedness) hand = s.hand;
        }
      }
      if (!frame || !refSpace || !hand || !this.readPalm(frame, refSpace, hand)) {
        entity.setValue(HandGestureState, 'tracked', false);
        entity.setValue(HandGestureState, 'palmDown', false);
        entity.setValue(HandGestureState, 'palmUp', false);
        entity.setValue(HandGestureState, 'still', false);
        continue;
      }
      const centerView = entity.getVectorView(HandGestureState, 'palmCenter');
      const wasTracked = entity.getValue(HandGestureState, 'tracked');
      let speed = 0;
      if (wasTracked && delta > 0) {
        const dx = this.center.x - centerView[0];
        const dy = this.center.y - centerView[1];
        const dz = this.center.z - centerView[2];
        const instant = Math.sqrt(dx * dx + dy * dy + dz * dz) / delta;
        const prev = entity.getValue(HandGestureState, 'speed') ?? 0;
        speed = prev + (instant - prev) * SPEED_SMOOTHING;
      }
      centerView[0] = this.center.x;
      centerView[1] = this.center.y;
      centerView[2] = this.center.z;
      const normalView = entity.getVectorView(HandGestureState, 'palmNormal');
      normalView[0] = this.normal.x;
      normalView[1] = this.normal.y;
      normalView[2] = this.normal.z;
      entity.setValue(HandGestureState, 'tracked', true);
      entity.setValue(HandGestureState, 'speed', speed);
      entity.setValue(HandGestureState, 'still', !!wasTracked && speed < cfg.maxSpeed);
      entity.setValue(HandGestureState, 'palmDown', -this.normal.y >= this.cosMaxTilt);
      entity.setValue(HandGestureState, 'palmUp', this.normal.y >= this.cosMaxCup);
    }
    this.summarize(delta);
  }

  /** Two-hand and stage-relative gestures: cupped hands and the hush palm. */
  private summarize(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    this.left = this.right = undefined;
    for (const e of this.queries.hands.entities) {
      if (e.getValue(HandGestureState, 'hand') === Handedness.Left) this.left = e;
      else this.right = e;
    }
    const l = this.left;
    const r = this.right;
    let cupped = false;
    if (l && r && l.getValue(HandGestureState, 'palmUp') && r.getValue(HandGestureState, 'palmUp')) {
      this.a.fromArray(l.getVectorView(HandGestureState, 'palmCenter'));
      this.b.fromArray(r.getVectorView(HandGestureState, 'palmCenter'));
      if (this.a.distanceTo(this.b) <= gest.cupMaxSpacing) {
        cupped = true;
        this.a.add(this.b).multiplyScalar(0.5).toArray(d.getVectorView(Gestures, 'cupCenter'));
      }
    }
    d.setValue(Gestures, 'cupped', cupped);

    const c = d.getVectorView(StageSurface, 'center');
    const yaw = d.getValue(StageSurface, 'yaw') ?? 0;
    const halfW = (d.getValue(StageSurface, 'width') ?? 0.6) / 2 + 0.1;
    const halfD = (d.getValue(StageSurface, 'depth') ?? 0.4) / 2 + 0.1;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    let hushing = false;
    for (const h of [l, r]) {
      if (!h || !h.getValue(HandGestureState, 'palmDown')) continue;
      if ((h.getValue(HandGestureState, 'speed') ?? 1) > HUSH_MAX_SPEED) continue;
      const p = h.getVectorView(HandGestureState, 'palmCenter');
      const dx = p[0] - c[0];
      const dz = p[2] - c[2];
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const height = p[1] - c[1];
      if (Math.abs(lx) < halfW && Math.abs(lz) < halfD && height >= gest.hushMinHeight && height <= gest.hushMaxHeight) {
        hushing = true;
      }
    }
    let hold = d.getValue(Gestures, 'hushHold') ?? 0;
    hold = hushing ? hold + delta : Math.max(0, hold - delta);
    const hush = hold >= gest.hushHoldSec;
    d.setValue(Gestures, 'hush', hush);
    d.setValue(Gestures, 'hushHold', hush ? 0 : hold);
  }

  /** Fills this.center / this.normal in world space. Returns false if untracked. */
  private readPalm(frame: XRFrame, refSpace: XRReferenceSpace, hand: XRHand): boolean {
    let spaces = this.jointSpaces.get(hand);
    if (!spaces) {
      spaces = [];
      for (const name of JOINT_NAMES) {
        const space = hand.get(name);
        if (!space) return false;
        spaces.push(space);
      }
      this.jointSpaces.set(hand, spaces);
    }
    const f = frame as FillPosesFrame;
    if (!f.fillPoses || !f.fillPoses(spaces, refSpace, this.poses)) return false;
    const toWorld = this.player.matrixWorld;
    this.jointMatrix.fromArray(this.poses, 16);
    this.center.setFromMatrixPosition(this.jointMatrix);
    // WebXR joint space: +Y points out of the back of the hand, so the palm faces -Y.
    this.normal.setFromMatrixColumn(this.jointMatrix, 1).negate();
    this.knuckle.fromArray(this.poses, 32 + 12);
    this.center.add(this.knuckle).multiplyScalar(0.5).applyMatrix4(toWorld);
    this.normal.transformDirection(toWorld);
    return true;
  }
}
