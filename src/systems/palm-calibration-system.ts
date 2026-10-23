import { createSystem, Entity, Quaternion, Vector3 } from '@iwsdk/core';
import { HandGestureState, Handedness } from '../components/hands.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots, StageSource, StageSurface } from '../components/stage.js';
import { Tuning } from '../config/tuning.js';

const cfg = Tuning.palmCalibration;
const stage = Tuning.stage;

/**
 * The tuck-in: both palms flat, still and level for ~2 s defines the dream
 * stage (always available, even when a table was auto-detected — it is also
 * the ritual). Snaps to a detected table at palm height; otherwise trusts the
 * palms, or floats a cloud platform when the room was scanned and nothing is
 * under them. With no attempt for autoTuckInSec, places the stage itself.
 */
export class PalmCalibrationSystem extends createSystem({
  hands: { required: [HandGestureState] },
  director: { required: [Ritual, StageSurface, RoomSlots] },
}) {
  private left = new Vector3();
  private right = new Vector3();
  private mid = new Vector3();
  private head = new Vector3();
  private headQuat = new Quaternion();
  private local = new Vector3();
  private tableCenter = new Vector3();

  update(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d || d.getValue(Ritual, 'phase') !== RitualPhase.Arrival) return;

    let leftHand: Entity | undefined;
    let rightHand: Entity | undefined;
    for (const e of this.queries.hands.entities) {
      if (e.getValue(HandGestureState, 'hand') === Handedness.Left) leftHand = e;
      else rightHand = e;
    }
    const ready = (e?: Entity) =>
      !!e &&
      e.getValue(HandGestureState, 'tracked') &&
      e.getValue(HandGestureState, 'palmDown') &&
      e.getValue(HandGestureState, 'still');

    let ok = false;
    if (ready(leftHand) && ready(rightHand)) {
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
    hold = ok
      ? hold + delta / cfg.holdSec
      : Math.max(0, hold - (delta * cfg.decayRatio) / cfg.holdSec);
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

  private placeStage(d: Entity, byPalms: boolean): void {
    this.player.head.getWorldPosition(this.head);
    const tableFound = !!d.getValue(RoomSlots, 'tableFound');
    this.tableCenter.fromArray(d.getVectorView(RoomSlots, 'tableCenter'));
    const tableYaw = d.getValue(RoomSlots, 'tableYaw') ?? 0;
    const tableW = d.getValue(RoomSlots, 'tableWidth') ?? 0;
    const tableD = d.getValue(RoomSlots, 'tableDepth') ?? 0;
    let source: (typeof StageSource)[keyof typeof StageSource];

    if (!byPalms) {
      if (tableFound) {
        // Pull the table center toward the user so the stage sits within reach.
        this.mid.copy(this.tableCenter);
        this.local.subVectors(this.head, this.mid).setY(0);
        const pull = Math.max(0, Math.min(this.local.length() - stage.maxReach * 0.6, 0.3));
        this.mid.addScaledVector(this.local.normalize(), pull);
        source = StageSource.Auto;
      } else {
        this.player.head.getWorldQuaternion(this.headQuat);
        this.local.set(0, 0, -1).applyQuaternion(this.headQuat).setY(0).normalize();
        this.mid.copy(this.head).addScaledVector(this.local, stage.airForward);
        this.mid.y = this.head.y - stage.airDrop;
        source = StageSource.Air;
      }
    } else if (tableFound && Math.abs(this.tableCenter.y - this.mid.y) <= cfg.tableSnapTolerance) {
      this.mid.y = this.tableCenter.y;
      source = StageSource.Table;
    } else {
      source = (d.getValue(RoomSlots, 'planeCount') ?? 0) > 0 ? StageSource.Air : StageSource.Palm;
    }

    const yaw = Math.atan2(this.head.x - this.mid.x, this.head.z - this.mid.z);
    let width: number = stage.defaultWidth;
    let depth: number = stage.defaultDepth;
    if (source === StageSource.Table || source === StageSource.Auto) {
      // Fit the stage inside the table: work in the table's frame.
      const turned = Math.abs(Math.cos(yaw - tableYaw)) < Math.SQRT1_2;
      const extX = Math.min(turned ? tableD : tableW, stage.maxWidth);
      const extZ = Math.min(turned ? tableW : tableD, stage.maxDepth);
      width = Math.max(extX, stage.minWidth);
      depth = Math.max(extZ, stage.minDepth);
      const ax = turned ? depth : width;
      const az = turned ? width : depth;
      this.local.subVectors(this.mid, this.tableCenter).applyAxisAngle(Y_AXIS, -tableYaw);
      this.local.x = clamp(this.local.x, Math.max(0, tableW - ax) / 2);
      this.local.z = clamp(this.local.z, Math.max(0, tableD - az) / 2);
      this.mid.copy(this.local).applyAxisAngle(Y_AXIS, tableYaw).add(this.tableCenter);
      this.mid.y = this.tableCenter.y;
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

const Y_AXIS = new Vector3(0, 1, 0);
const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
