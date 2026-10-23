import { createSystem, Matrix4, Vector3 } from '@iwsdk/core';
import { HandGestureState, Handedness } from '../components/hands.js';
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

/**
 * Reads hand joints straight from WebXR and classifies each hand's palm pose
 * into HandGestureState (tracked, palmDown, still, center, normal, speed).
 * Phase 1 only needs "flat palm, still"; later phases add cupped/hush/pinch/palm-out.
 */
export class GestureSystem extends createSystem({
  hands: { required: [HandGestureState] },
}) {
  private poses = new Float32Array(16 * JOINT_NAMES.length);
  private jointSpaces = new WeakMap<XRHand, XRJointSpace[]>();
  private jointMatrix = new Matrix4();
  private center = new Vector3();
  private knuckle = new Vector3();
  private normal = new Vector3();
  private cosMaxTilt = Math.cos((cfg.maxPalmTiltDeg * Math.PI) / 180);

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
    }
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
