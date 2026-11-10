import { Matrix4, Object3D, Quaternion, Vector3 } from '@iwsdk/core';
import { FilmHands } from './lib/film-hands.js';
import type { GhostHand } from './director-ghost-hands.js';

/** The slice of the emulator (IWER) device the Director drives: headset pose and hands. */
interface IwerVec {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): unknown;
}
interface IwerQuat {
  x: number;
  y: number;
  z: number;
  w: number;
  set(x: number, y: number, z: number, w: number): unknown;
}
interface IwerHand {
  connected: boolean;
  position: IwerVec;
  quaternion: IwerQuat;
  poseId: string;
  pin?: unknown;
  setPin?(pin: null): void;
  updatePinchValue(v: number): void;
  /** Re-applies the pose to the joints (setting poseId alone leaves them as they were). */
  updateHandPose?(): void;
}
interface IwerDevice {
  position: IwerVec;
  quaternion: IwerQuat;
  hands?: { left?: IwerHand; right?: IwerHand };
  controllers?: { left?: { connected: boolean }; right?: { connected: boolean } };
}

export interface HandShot {
  /** Offset from the eyes in head space (x right, y up, z forward is negative). */
  at: Vector3;
  /** Rotation of the hand in head space (identity: palm down, fingers forward). */
  rot: Quaternion;
  pose: string;
  pinch: number;
  /** Optional world point the hand points at (overrides `rot`): the pinch ray aims there. */
  aim?: Vector3;
}

const UP = new Vector3(0, 1, 0);

/** Adds poses to an emulated hand's pose store (kept under a symbol key) that it does not have yet. */
function addPoses(hand: object | undefined, poses: Record<string, unknown>): void {
  if (!hand) return;
  for (const k of Object.getOwnPropertySymbols(hand)) {
    const store = (hand as Record<symbol, { poses?: Record<string, unknown> } | undefined>)[k];
    if (!store?.poses) continue;
    for (const [id, pose] of Object.entries(poses)) if (!(id in store.poses)) store.poses[id] = pose;
  }
}
const ZERO = new Vector3();

/**
 * Drives the emulator's tracked hands for the trailer, like a person's own
 * hands in front of the camera: they draw the window, dance, open the palm menu
 * and pinch it, and cup to catch gifts. Poses are placed relative to the
 * headset each frame (rig space, as the emulator expects) and eased.
 */
export class DirectorHands {
  private device?: IwerDevice;
  private head = new Vector3();
  private headQ = new Quaternion();
  private rigQ = new Quaternion();
  private rigInv = new Quaternion();
  private p = new Vector3();
  private q = new Quaternion();
  private m = new Matrix4();
  private world = new Vector3();
  private dir = new Vector3();
  private every = 0;
  private wq = new Quaternion();
  private wp = new Vector3();

  /** Visible stand-ins for the camera (the emulated hands' own model does not show in captures). */
  constructor(private ghosts?: { left: GhostHand; right: GhostHand }) {}
  private cur = { left: { p: new Vector3(), q: new Quaternion(), pinch: 0, ok: false }, right: { p: new Vector3(), q: new Quaternion(), pinch: 0, ok: false } };

  /** The emulator appears after start-up: find it (and switch to hands) on first use. */
  private connect(): IwerDevice | undefined {
    if (this.device) return this.device;
    const d = (window as unknown as { IWER_DEVICE?: IwerDevice }).IWER_DEVICE;
    if (!d?.hands) return undefined;
    this.device = d;
    // Hands on, controllers off: the trailer is hands-first.
    if (d.controllers?.left) d.controllers.left.connected = false;
    if (d.controllers?.right) d.controllers.right.connected = false;
    if (d.hands?.left) d.hands.left.connected = true;
    if (d.hands?.right) d.hands.right.connected = true;
    // The emulator built into the page only knows default, pinch and point: give its hands the
    // rest of IWER's pose library (fist, thumbs-up, rock, open...) so the film can show them.
    void import('iwer/lib/device/configs/hand/library.js')
      .then((lib) => {
        for (const h of [d.hands?.left, d.hands?.right]) addPoses(h, lib.libraryHandPoses as Record<string, unknown>);
      })
      .catch(() => undefined);
    return d;
  }

  /** The emulator's hands (for drawing them in captures), once connected. */
  deviceHands(): IwerDevice['hands'] {
    return this.connect()?.hands;
  }

  /** Pose both hands (rig = the player rig, for converting world aim points); k = easing 0..1. */
  apply(rig: Object3D, left: HandShot, right: HandShot, k: number): void {
    const d = this.connect();
    if (!d?.hands) return;
    this.head.set(d.position.x, d.position.y, d.position.z);
    this.headQ.set(d.quaternion.x, d.quaternion.y, d.quaternion.z, d.quaternion.w);
    rig.getWorldQuaternion(this.rigQ);
    this.rigInv.copy(this.rigQ).invert();
    this.place(d.hands.left, this.cur.left, left, rig, k, this.ghosts?.left);
    this.place(d.hands.right, this.cur.right, right, rig, k, this.ghosts?.right);
    this.showHandModels(rig);
  }

  /**
   * The hand visuals can be left switched off when the hands were connected
   * before the session's visuals were ready; keep the models (and their
   * parents up to the rig) visible while the Director drives them.
   */
  private showHandModels(rig: Object3D): void {
    if (++this.every % 15 !== 0) return;
    rig.traverse((o) => {
      if (!/^[lr]_handMeshNode$/.test(o.name)) return;
      for (let p: Object3D | null = o; p && p !== rig; p = p.parent) if (!p.visible) p.visible = true;
    });
  }

  private place(hand: IwerHand | undefined, cur: { p: Vector3; q: Quaternion; pinch: number; ok: boolean }, s: HandShot, rig: Object3D, k: number, ghost?: GhostHand): void {
    if (!hand) return;
    this.p.copy(s.at).applyQuaternion(this.headQ).add(this.head);
    if (s.aim) {
      // Point at a world target: the hand's forward (-Z) toward it, in rig space.
      this.world.copy(this.p);
      rig.localToWorld(this.world);
      this.dir.subVectors(s.aim, this.world).normalize().applyQuaternion(this.rigInv);
      // Matrix4.lookAt points -Z from the eye toward the target.
      this.m.lookAt(ZERO, this.dir, UP);
      this.q.setFromRotationMatrix(this.m);
    } else {
      this.q.copy(this.headQ).multiply(s.rot);
    }
    const e = cur.ok ? k : 1;
    cur.ok = true;
    cur.p.lerp(this.p, e);
    cur.q.slerp(this.q, e);
    cur.pinch += (s.pinch - cur.pinch) * Math.min(1, e * 2);
    // A pinned hand snaps back to its pin; let go first (as the emulator's own set-transform does).
    if (hand.pin) hand.setPin?.(null);
    hand.position.set(cur.p.x, cur.p.y, cur.p.z);
    const fh = hand === this.device?.hands?.left ? FilmHands.left : FilmHands.right;
    fh.p.copy(cur.p);
    fh.q.copy(cur.q);
    FilmHands.on = true;
    hand.quaternion.set(cur.q.x, cur.q.y, cur.q.z, cur.q.w);
    if (hand.poseId !== s.pose) hand.poseId = s.pose;
    hand.updatePinchValue(cur.pinch);
    hand.updateHandPose?.();
    if (ghost) {
      this.wp.copy(cur.p);
      rig.localToWorld(this.wp);
      this.wq.copy(this.rigQ).multiply(cur.q);
      ghost.place(this.wp, this.wq);
      ghost.pose(s.pose, cur.pinch, Math.min(1, e * 1.5));
    }
  }
}
