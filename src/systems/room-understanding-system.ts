import { createSystem, Quaternion, Vector3, XRPlane } from '@iwsdk/core';
import { RoomSlots } from '../components/stage.js';
import { Tuning } from '../config/tuning.js';

/** The parts of a WebXR XRPlane we read (semanticLabel is Quest-specific). */
interface DetectedPlane {
  orientation?: string;
  semanticLabel?: string;
  polygon: ReadonlyArray<DOMPointReadOnly>;
}

const stage = Tuning.stage;

/**
 * Picks the stage table (nearest plausible horizontal surface within reach, in
 * front of the seated user), the stage wall (vertical plane most in front) and
 * the ceiling from detected planes. Writes RoomSlots; never errors when plane
 * detection is missing — RoomSlots simply stays "not found".
 */
export class RoomUnderstandingSystem extends createSystem({
  planes: { required: [XRPlane] },
  room: { required: [RoomSlots] },
}) {
  private timer = 0;
  private head = new Vector3();
  private headQuat = new Quaternion();
  private forward = new Vector3();
  private center = new Vector3();
  private quat = new Quaternion();
  private axisX = new Vector3();
  private axisY = new Vector3();
  private toPlane = new Vector3();
  private bestTable = new Vector3();
  private bestWall = new Vector3();
  private bestWallNormal = new Vector3();

  update(delta: number): void {
    this.timer -= delta;
    if (this.timer > 0) return;
    this.timer = stage.roomScanIntervalSec;
    const room = this.queries.room.entities.values().next().value;
    if (!room || room.getValue(RoomSlots, 'locked')) return;

    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQuat);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat).setY(0).normalize();

    let tableScore = Infinity;
    let tableYaw = 0;
    let tableW = 0;
    let tableD = 0;
    let wallScore = 0.3;
    let wallFound = false;
    let ceilingFound = false;
    let ceilingHeight = 0;
    let count = 0;

    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane') as DetectedPlane | undefined;
      const obj = entity.object3D;
      if (!plane || !obj) continue;
      count++;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of plane.polygon) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
      if (!Number.isFinite(minX)) continue;
      obj.updateWorldMatrix(true, false);
      obj.getWorldQuaternion(this.quat);
      this.center.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2).applyMatrix4(obj.matrixWorld);
      this.axisY.set(0, 1, 0).applyQuaternion(this.quat);
      const width = maxX - minX;
      const depth = maxZ - minZ;
      const label = plane.semanticLabel ?? '';

      if (Math.abs(this.axisY.y) > 0.85) {
        const y = this.center.y;
        if (label === 'ceiling' || y > this.head.y + 0.3) {
          ceilingFound = true;
          ceilingHeight = y;
          continue;
        }
        if (label === 'floor' || y < stage.tableMinHeight || y > stage.tableMaxHeight) continue;
        this.toPlane.subVectors(this.center, this.head).setY(0);
        const ahead = this.toPlane.dot(this.forward);
        const reach = Math.max(0, this.toPlane.length() - 0.5 * Math.min(width, depth));
        // Quest labels real tables; prefer them over chairs or couch seats at similar height.
        const score = reach - (label === 'table' ? 0.3 : 0);
        if (ahead < -0.05 || reach > stage.maxReach || score >= tableScore) continue;
        tableScore = score;
        this.bestTable.copy(this.center);
        this.axisX.set(1, 0, 0).applyQuaternion(this.quat);
        tableYaw = Math.atan2(-this.axisX.z, this.axisX.x);
        tableW = width;
        tableD = depth;
      } else if (Math.abs(this.axisY.y) < 0.3 && label !== 'door' && label !== 'window') {
        this.toPlane.subVectors(this.center, this.head).setY(0);
        const dist = this.toPlane.length();
        if (dist > stage.maxWallDistance || dist < 0.2) continue;
        this.axisY.setY(0).normalize();
        if (this.axisY.dot(this.toPlane) > 0) this.axisY.negate();
        const frontness = this.toPlane.normalize().dot(this.forward);
        if (frontness <= wallScore) continue;
        wallScore = frontness;
        wallFound = true;
        this.bestWall.copy(this.center);
        this.bestWallNormal.copy(this.axisY);
      }
    }

    room.setValue(RoomSlots, 'planeCount', count);
    room.setValue(RoomSlots, 'tableFound', tableScore < Infinity);
    if (tableScore < Infinity) {
      this.bestTable.toArray(room.getVectorView(RoomSlots, 'tableCenter'));
      room.setValue(RoomSlots, 'tableYaw', tableYaw);
      room.setValue(RoomSlots, 'tableWidth', tableW);
      room.setValue(RoomSlots, 'tableDepth', tableD);
    }
    room.setValue(RoomSlots, 'wallFound', wallFound);
    if (wallFound) {
      this.bestWall.toArray(room.getVectorView(RoomSlots, 'wallCenter'));
      this.bestWallNormal.toArray(room.getVectorView(RoomSlots, 'wallNormal'));
    }
    room.setValue(RoomSlots, 'ceilingFound', ceilingFound);
    room.setValue(RoomSlots, 'ceilingHeight', ceilingHeight);
  }
}
