import { Matrix4, Object3D, Quaternion, Vector3 } from '@iwsdk/core';
import { EmulatedHand, jointOffset, JOINTS } from '../systems/real-hands.js';

/** Joint indices in JOINTS order (WebXR hand joint order). */
const J = {
  wrist: 0,
  thumbMeta: 1,
  thumbProx: 2,
  thumbDist: 3,
  thumbTip: 4,
  indexMeta: 5,
  indexProx: 6,
  indexTip: 9,
  middleMeta: 10,
  middleProx: 11,
  middleTip: 14,
  ringMeta: 15,
  ringProx: 16,
  ringTip: 19,
  pinkyMeta: 20,
  pinkyProx: 21,
  pinkyTip: 24,
};

/** Each finger's knuckle, middle and tip (index, middle, ring, pinky). */
const FINGERS: [number, number, number][] = [
  [J.indexMeta, J.indexProx, J.indexTip],
  [J.middleMeta, J.middleProx, J.middleTip],
  [J.ringMeta, J.ringProx, J.ringTip],
  [J.pinkyMeta, J.pinkyProx, J.pinkyTip],
];

export type HandSign = 'none' | 'open' | 'fist' | 'thumbsUp' | 'point' | 'peace' | 'rock' | 'other';

/** One hand's reading this frame, in world space. */
export interface HandReading {
  tracked: boolean;
  sign: HandSign;
  /** Seconds the current sign has held. */
  held: number;
  /** Palm centre, the way the palm faces, where the index finger points. */
  palm: Vector3;
  normal: Vector3;
  pointDir: Vector3;
  indexTip: Vector3;
  /** Palm velocity (m/s, smoothed) and speed. */
  vel: Vector3;
  speed: number;
  /** True while the hand is waving (open palm swinging side to side). */
  waving: boolean;
  /** Finger extension, 0 (curled) .. 1 (straight): thumb, index, middle, ring, pinky. */
  ext: number[];
}

type FillPosesFrame = XRFrame & { fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean };

interface SideState extends HandReading {
  joints: Vector3[];
  last: Vector3;
  primed: boolean;
  /** Wave detection: sideways swing direction and the times it reversed. */
  swingSign: number;
  swingTimes: number[];
  candidate: HandSign;
  candidateFor: number;
  spaces?: XRJointSpace[];
  hand?: XRHand;
}

function side(): SideState {
  return {
    tracked: false,
    sign: 'none',
    held: 0,
    palm: new Vector3(),
    normal: new Vector3(),
    pointDir: new Vector3(),
    indexTip: new Vector3(),
    vel: new Vector3(),
    speed: 0,
    waving: false,
    ext: [0, 0, 0, 0, 0],
    joints: JOINTS.map(() => new Vector3()),
    last: new Vector3(),
    primed: false,
    swingSign: 0,
    swingTimes: [],
    candidate: 'none',
    candidateFor: 0,
  };
}

/**
 * Hand signs from the 25 tracked joints, for both hands: open palm, fist,
 * thumbs up, point, peace, rock, plus palm position / facing / velocity and a
 * wave detector. Reads a real headset's hand tracking (XRFrame.fillPoses) or,
 * for Director films, the emulator's hands directly; the recognition is the
 * same either way. A sign must hold a few frames before it counts (no flicker).
 */
export class HandSigns {
  readonly left = side();
  readonly right = side();
  private poses = new Float32Array(JOINTS.length * 16);
  private m = new Matrix4();
  private base = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private a = new Vector3();
  private b = new Vector3();
  private c = new Vector3();
  private right3 = new Vector3();
  private up = new Vector3(0, 1, 0);
  private clock = 0;

  /** Read both hands from the XR frame (a real headset, or the live emulator). */
  readFrame(frame: XRFrame | null | undefined, ref: XRReferenceSpace | null | undefined, rig: Object3D): void {
    const f = frame as FillPosesFrame | null | undefined;
    this.left.tracked = this.right.tracked = false;
    if (!f?.fillPoses || !ref) return;
    rig.updateMatrixWorld();
    for (const src of f.session.inputSources) {
      if (!src.hand || (src.handedness !== 'left' && src.handedness !== 'right')) continue;
      const s = this[src.handedness];
      if (s.hand !== src.hand) {
        const hand = src.hand;
        s.hand = hand;
        s.spaces = JOINTS.map((j) => hand.get(j)).filter((x): x is XRJointSpace => !!x);
      }
      if (!s.spaces || s.spaces.length !== JOINTS.length || !f.fillPoses(s.spaces, ref, this.poses)) continue;
      for (let i = 0; i < JOINTS.length; i++) {
        s.joints[i].set(this.poses[i * 16 + 12], this.poses[i * 16 + 13], this.poses[i * 16 + 14]).applyMatrix4(rig.matrixWorld);
      }
      s.tracked = true;
    }
  }

  /** Read both hands from the emulator (Director films, where the XR frame route is not reliable). */
  readEmulator(hands: { left?: EmulatedHand; right?: EmulatedHand } | undefined, rig: Object3D): void {
    this.left.tracked = this.right.tracked = false;
    if (!hands) return;
    rig.updateMatrixWorld();
    for (const name of ['left', 'right'] as const) {
      const h = hands[name];
      const s = this[name];
      if (!h?.connected || !h.inputSource?.hand) continue;
      this.base.compose(this.v.set(h.position.x, h.position.y, h.position.z), this.q.set(h.quaternion.x, h.quaternion.y, h.quaternion.z, h.quaternion.w), this.a.set(1, 1, 1));
      let ok = true;
      for (let i = 0; i < JOINTS.length; i++) {
        const js = h.inputSource.hand.get(JOINTS[i]);
        const off = js && jointOffset(js);
        if (!off) {
          ok = false;
          break;
        }
        this.m.fromArray(off).premultiply(this.base).premultiply(rig.matrixWorld);
        s.joints[i].setFromMatrixPosition(this.m);
      }
      s.tracked = ok;
    }
  }

  /** Classify both hands. `headRight` is the viewer's right (for telling a sideways wave). */
  update(dt: number, headRight: Vector3): void {
    this.clock += dt;
    this.right3.copy(headRight).setY(0).normalize();
    for (const name of ['left', 'right'] as const) this.classify(this[name], name, dt);
  }

  private classify(s: SideState, hand: 'left' | 'right', dt: number): void {
    if (!s.tracked) {
      s.sign = 'none';
      s.held = 0;
      s.waving = false;
      s.primed = false;
      s.speed = 0;
      return;
    }
    const P = s.joints;
    // Palm centre and facing (the palm's normal: out of the palm, mirrored per hand).
    s.palm.copy(P[J.wrist]).add(P[J.indexMeta]).add(P[J.pinkyMeta]).add(P[J.middleProx]).multiplyScalar(0.25);
    this.a.subVectors(P[J.indexProx], P[J.wrist]);
    this.b.subVectors(P[J.pinkyProx], P[J.wrist]);
    s.normal.crossVectors(this.a, this.b).normalize();
    if (hand === 'left') s.normal.negate();
    // Finger extension: how straight each finger is from its knuckle to its tip.
    FINGERS.forEach(([m, p, t], i) => {
      this.a.subVectors(P[p], P[m]).normalize();
      this.b.subVectors(P[t], P[p]).normalize();
      // Also: is the tip further from the wrist than the knuckle? (curled fingers come back)
      const reach = P[t].distanceTo(P[J.wrist]) / Math.max(1e-4, P[p].distanceTo(P[J.wrist]));
      s.ext[i + 1] = Math.max(0, Math.min(1, (this.a.dot(this.b) - 0.2) / 0.7)) * Math.max(0, Math.min(1, (reach - 1.05) / 0.45));
    });
    // Thumb: out from the index knuckle, and straight.
    this.a.subVectors(P[J.thumbProx], P[J.thumbMeta]).normalize();
    this.b.subVectors(P[J.thumbTip], P[J.thumbProx]).normalize();
    const thumbOut = P[J.thumbTip].distanceTo(P[J.indexProx]);
    s.ext[0] = Math.max(0, Math.min(1, (this.a.dot(this.b) - 0.3) / 0.6)) * Math.max(0, Math.min(1, (thumbOut - 0.035) / 0.035));
    s.pointDir.subVectors(P[J.indexTip], P[J.indexProx]).normalize();
    s.indexTip.copy(P[J.indexTip]);
    const th = s.ext[0] > 0.5;
    const ix = s.ext[1] > 0.5;
    const md = s.ext[2] > 0.5;
    const rg = s.ext[3] > 0.5;
    const pk = s.ext[4] > 0.5;
    const thumbUp = this.c.subVectors(P[J.thumbTip], P[J.thumbProx]).normalize().dot(this.up) > 0.6;
    let sign: HandSign = 'other';
    if (ix && md && rg && pk) sign = 'open';
    else if (!ix && !md && !rg && !pk) sign = th && thumbUp ? 'thumbsUp' : 'fist';
    else if (ix && !md && !rg && !pk) sign = 'point';
    else if (ix && md && !rg && !pk) sign = 'peace';
    else if (ix && !md && !rg && pk) sign = 'rock';
    // A sign counts once it has held for a few frames.
    if (sign === s.candidate) s.candidateFor += dt;
    else {
      s.candidate = sign;
      s.candidateFor = 0;
    }
    if (s.candidateFor > 0.12 && s.sign !== s.candidate) {
      s.sign = s.candidate;
      s.held = 0;
    }
    s.held += dt;
    // Palm velocity (smoothed) and the wave: an open palm swinging sideways, reversing at least 3 times in 1.6 s.
    if (s.primed && dt > 0) {
      this.v.subVectors(s.palm, s.last).divideScalar(dt);
      s.vel.lerp(this.v, Math.min(1, dt * 12));
    }
    s.last.copy(s.palm);
    s.primed = true;
    s.speed = s.vel.length();
    const side = s.vel.dot(this.right3);
    const dir = Math.abs(side) > 0.25 ? Math.sign(side) : 0;
    if (dir && dir !== s.swingSign) {
      if (s.swingSign) s.swingTimes.push(this.clock);
      s.swingSign = dir;
    }
    while (s.swingTimes.length && this.clock - s.swingTimes[0] > 1.6) s.swingTimes.shift();
    s.waving = s.sign === 'open' && s.swingTimes.length >= 3;
  }
}
