import { createSystem, Entity, Matrix4, Quaternion, Vector3, XRPlane } from '@iwsdk/core';
import { HandGestureState, Handedness } from '../components/hands.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots, StageSource, StageSurface } from '../components/stage.js';
import { Tuning } from '../config/tuning.js';

const cfg = Tuning.palmCalibration;
const stage = Tuning.stage;
/** A detected surface counts as "under the palms" within this height. */
const SURFACE_MATCH_HEIGHT = 0.12;
const Y_AXIS = new Vector3(0, 1, 0);
const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

interface PlaneShape {
  polygon: ReadonlyArray<DOMPointReadOnly>;
  semanticLabel?: string;
}

/** A real surface the stage can sit on (world space). */
interface Surface {
  center: Vector3;
  yaw: number;
  width: number;
  depth: number;
}

/**
 * The tuck-in: both palms flat, still and level for ~2 s define the dream
 * stage (always available, even when a table was auto-detected — it is also
 * the ritual). The stage fits whichever detected surface is under the palms;
 * if none was reported, it trusts the palms (an invisible surface at palm
 * height). With no attempt for autoTuckInSec, it places the stage itself — on
 * the detected table, or on a cloud floating in front when there is none.
 */
export class PalmCalibrationSystem extends createSystem({
  hands: { required: [HandGestureState] },
  director: { required: [Ritual, StageSurface, RoomSlots] },
  planes: { required: [XRPlane] },
}) {
  private left = new Vector3();
  private right = new Vector3();
  private mid = new Vector3();
  private head = new Vector3();
  private headQuat = new Quaternion();
  private local = new Vector3();
  private inverse = new Matrix4();
  private planeQuat = new Quaternion();
  private axis = new Vector3();
  private found: Surface = { center: new Vector3(), yaw: 0, width: 0, depth: 0 };

  update(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d || d.getValue(Ritual, 'phase') !== RitualPhase.Arrival) return;

    let leftHand: Entity | undefined;
    let rightHand: Entity | undefined;
    for (const e of this.queries.hands.entities) {
      if (e.getValue(HandGestureState, 'hand') === Handedness.Left) leftHand = e;
      else rightHand = e;
    }
    let ok = false;
    if (this.ready(leftHand) && this.ready(rightHand)) {
      this.left.fromArray(leftHand!.getVectorView(HandGestureState, 'palmCenter'));
      this.right.fromArray(rightHand!.getVectorView(HandGestureState, 'palmCenter'));
      const spacing = this.left.distanceTo(this.right);
      this.player.head.getWorldPosition(this.head);
      const ceiling = this.head.y - cfg.minDropBelowHead;
      ok =
        this.left.y <= ceiling &&
        this.right.y <= ceiling &&
        Math.abs(this.left.y - this.right.y) <= cfg.maxHeightDelta &&
        spacing >= cfg.minPalmSpacing &&
        spacing <= cfg.maxPalmSpacing;
    }

    let hold = d.getValue(Ritual, 'holdProgress') ?? 0;
    hold = ok ? hold + delta / cfg.holdSec : Math.max(0, hold - (delta * cfg.decayRatio) / cfg.holdSec);
    d.setValue(Ritual, 'holdProgress', Math.min(1, hold));

    if (hold >= 1) {
      this.mid.addVectors(this.left, this.right).multiplyScalar(0.5);
      this.mid.y -= cfg.palmSurfaceOffset;
      this.left.y = this.right.y = this.mid.y;
      this.placeStage(d, true);
    } else if (hold === 0 && (d.getValue(Ritual, 'phaseTime') ?? 0) >= cfg.autoTuckInSec) {
      this.placeStage(d, false);
    }
  }

  private ready(e?: Entity): boolean {
    return (
      !!e &&
      !!e.getValue(HandGestureState, 'tracked') &&
      !!e.getValue(HandGestureState, 'palmDown') &&
      !!e.getValue(HandGestureState, 'still')
    );
  }

  /** The detected horizontal surface under `point` (closest in height), if any. */
  private surfaceUnder(point: Vector3): Surface | undefined {
    let best = SURFACE_MATCH_HEIGHT;
    let hit = false;
    for (const e of this.queries.planes.entities) {
      const plane = e.getValue(XRPlane, '_plane') as PlaneShape | undefined;
      const obj = e.object3D;
      if (!plane || !obj) continue;
      if (plane.semanticLabel === 'floor' || plane.semanticLabel === 'ceiling') continue;
      obj.updateWorldMatrix(true, false);
      obj.getWorldQuaternion(this.planeQuat);
      if (Math.abs(this.axis.set(0, 1, 0).applyQuaternion(this.planeQuat).y) < 0.85) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
      this.local.copy(point).applyMatrix4(this.inverse.copy(obj.matrixWorld).invert());
      const dy = Math.abs(this.local.y);
      if (dy >= best || this.local.x < minX - 0.05 || this.local.x > maxX + 0.05) continue;
      if (this.local.z < minZ - 0.05 || this.local.z > maxZ + 0.05) continue;
      best = dy;
      hit = true;
      this.found.center.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2).applyMatrix4(obj.matrixWorld);
      this.axis.set(1, 0, 0).applyQuaternion(this.planeQuat);
      this.found.yaw = Math.atan2(-this.axis.z, this.axis.x);
      this.found.width = maxX - minX;
      this.found.depth = maxZ - minZ;
    }
    return hit ? this.found : undefined;
  }

  private placeStage(d: Entity, byPalms: boolean): void {
    this.player.head.getWorldPosition(this.head);
    let surface: Surface | undefined;
    let source: (typeof StageSource)[keyof typeof StageSource];
    if (byPalms) {
      surface = this.surfaceUnder(this.mid);
      source = surface ? StageSource.Table : StageSource.Palm;
    } else if (d.getValue(RoomSlots, 'tableFound')) {
      this.found.center.fromArray(d.getVectorView(RoomSlots, 'tableCenter'));
      this.found.yaw = d.getValue(RoomSlots, 'tableYaw') ?? 0;
      this.found.width = d.getValue(RoomSlots, 'tableWidth') ?? 0;
      this.found.depth = d.getValue(RoomSlots, 'tableDepth') ?? 0;
      surface = this.found;
      source = StageSource.Auto;
      // Pull the table center toward the user so the stage sits within reach.
      this.mid.copy(surface.center);
      this.local.subVectors(this.head, this.mid).setY(0);
      const pull = Math.max(0, Math.min(this.local.length() - stage.maxReach * 0.6, 0.3));
      this.mid.addScaledVector(this.local.normalize(), pull);
    } else {
      this.player.head.getWorldQuaternion(this.headQuat);
      this.local.set(0, 0, -1).applyQuaternion(this.headQuat).setY(0).normalize();
      this.mid.copy(this.head).addScaledVector(this.local, stage.airForward);
      this.mid.y = this.head.y - stage.airDrop;
      source = StageSource.Air;
    }

    const yaw = Math.atan2(this.head.x - this.mid.x, this.head.z - this.mid.z);
    let width: number = stage.defaultWidth;
    let depth: number = stage.defaultDepth;
    if (surface) {
      // Fit the stage inside the surface: work in the surface's own frame.
      const turned = Math.abs(Math.cos(yaw - surface.yaw)) < Math.SQRT1_2;
      width = Math.max(Math.min(turned ? surface.depth : surface.width, stage.maxWidth), stage.minWidth);
      depth = Math.max(Math.min(turned ? surface.width : surface.depth, stage.maxDepth), stage.minDepth);
      const ax = turned ? depth : width;
      const az = turned ? width : depth;
      this.local.subVectors(this.mid, surface.center).applyAxisAngle(Y_AXIS, -surface.yaw);
      this.local.x = clamp(this.local.x, Math.max(0, surface.width - ax) / 2);
      this.local.z = clamp(this.local.z, Math.max(0, surface.depth - az) / 2);
      this.mid.copy(this.local).applyAxisAngle(Y_AXIS, surface.yaw).add(surface.center);
      this.mid.y = surface.center.y;
    }
    if (!byPalms) {
      this.local.set(0.14, 0, 0).applyAxisAngle(Y_AXIS, yaw);
      this.left.copy(this.mid).sub(this.local);
      this.right.copy(this.mid).add(this.local);
    }

    d.setValue(StageSurface, 'source', source);
    this.mid.toArray(d.getVectorView(StageSurface, 'center'));
    d.setValue(StageSurface, 'yaw', yaw);
    d.setValue(StageSurface, 'width', width);
    d.setValue(StageSurface, 'depth', depth);
    this.left.toArray(d.getVectorView(Ritual, 'leftPalm'));
    this.right.toArray(d.getVectorView(Ritual, 'rightPalm'));
    d.setValue(Ritual, 'holdProgress', byPalms ? 1 : 0);
    d.setValue(Ritual, 'phase', RitualPhase.Rings);
    d.setValue(Ritual, 'phaseTime', 0);
  }
}
