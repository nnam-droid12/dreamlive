import { createSystem, Mesh, PlaneGeometry, Quaternion, Vector3 } from '@iwsdk/core';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots, StageSurface } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { makeSoftRectMaterial } from '../visuals/glow-materials.js';

const BACKDROP_W = 1.3;
const BACKDROP_H = 0.85;

/**
 * Chooses where the TV portal and Memory Shelf go: the
 * point on the real wall straight ahead of the seated user, at eye level. With
 * no usable wall, a soft floating paper backdrop stands in 1.2 m ahead.
 * Computed once, at arrival.
 */
export class WallAnchorSystem extends createSystem({
  director: { required: [Ritual, RoomSlots, StageSurface] },
}) {
  private head = new Vector3();
  private center = new Vector3();
  private dir = new Vector3();
  private wall = new Vector3();
  private normal = new Vector3();
  private point = new Vector3();
  private headQuat = new Quaternion();

  update(): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d || d.getValue(RoomSlots, 'anchorReady')) return;
    if (d.getValue(Ritual, 'phase') === RitualPhase.Idle) return;

    // Straight ahead of the seated viewer, at arrival (the TV portal goes there).
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQuat);
    this.dir.set(0, 0, -1).applyQuaternion(this.headQuat).setY(0).normalize();
    this.center.copy(this.head);
    let backdrop = true;
    let screen = false;
    if (d.getValue(RoomSlots, 'screenFound')) {
      // The user's own TV: the dream plays on it, centered on the real screen.
      this.point.fromArray(d.getVectorView(RoomSlots, 'screenCenter'));
      this.normal.fromArray(d.getVectorView(RoomSlots, 'screenNormal'));
      d.setValue(RoomSlots, 'anchorWidth', Math.max(0.8, d.getValue(RoomSlots, 'screenWidth') ?? 0));
      screen = true;
      backdrop = false;
    } else if (d.getValue(RoomSlots, 'wallFound')) {
      this.wall.fromArray(d.getVectorView(RoomSlots, 'wallCenter'));
      this.normal.fromArray(d.getVectorView(RoomSlots, 'wallNormal'));
      const facing = this.dir.dot(this.normal);
      if (facing < -0.5) {
        const t = this.wall.clone().sub(this.center).dot(this.normal) / facing;
        if (t > 0.05 && t < Tuning.stage.maxWallDistance) {
          this.point.copy(this.center).addScaledVector(this.dir, t - 0.01);
          backdrop = false;
        }
      }
    }
    if (backdrop) {
      this.point.copy(this.head).addScaledVector(this.dir, Tuning.stage.backdropDistance);
      this.normal.copy(this.dir).negate();
      this.buildBackdrop();
    }
    if (!screen) this.point.y = this.head.y + 0.05;
    this.point.toArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    this.normal.toArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    d.setValue(RoomSlots, 'anchorIsBackdrop', backdrop);
    d.setValue(RoomSlots, 'anchorIsScreen', screen);
    d.setValue(RoomSlots, 'anchorReady', true);
  }

  private buildBackdrop(): void {
    const mat = makeSoftRectMaterial(Palette.paper);
    mat.uniforms.opacity.value = 0.22;
    mat.uniforms.feather.value = 0.2;
    const panel = new Mesh(new PlaneGeometry(BACKDROP_W, BACKDROP_H), mat);
    panel.name = 'PaperBackdrop';
    panel.position.copy(this.point).setY(this.head.y + 0.05);
    panel.lookAt(this.head.x, panel.position.y, this.head.z);
    this.world.createTransformEntity(panel);
  }
}
