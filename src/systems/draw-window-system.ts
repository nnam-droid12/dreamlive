import {
  BoxGeometry,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RayInteractable,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DreamDirector } from '../components/dream.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { NycLayout } from '../showcase/nyc-bedroom.js';

const cfg = Tuning.drawWindow;
const UP = new Vector3(0, 1, 0);

/**
 * "Draw Bigfoot a window": the user pinches and drags a rectangle on the wall
 * (hand ray or controller; a glowing outline follows), and on release that is
 * where Bigfoot's window opens. In the showcase room it snaps to the nearer of
 * the two middle glass bays; on a headset it opens on the real wall where drawn.
 * With no drawing, the window draws itself so the dream never stalls.
 */
export class DrawWindowSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, RoomSlots, Caption] },
}) {
  private pad?: Entity;
  private outline!: Group;
  /** Seconds since a too-small drawing was turned down (-1 = none). */
  private rejectedFor = -1;
  private bars: Mesh[] = [];
  private beat = newBeatContext();
  private start = new Vector3();
  private end = new Vector3();
  private dragging = false;
  private done = false;
  private opening = -1;
  private auto = 0;
  private origin = new Vector3();
  private out = new Vector3();
  private along = new Vector3();
  private tmp = new Vector3();

  init(): void {
    this.outline = new Group();
    this.outline.name = 'WindowOutline';
    const glow = new MeshBasicMaterial({ color: Palette.lanternGlow, transparent: true, opacity: 0.9, depthTest: false });
    for (let i = 0; i < 4; i++) {
      const bar = new Mesh(new BoxGeometry(1, 1, 1), glow);
      bar.renderOrder = 50;
      this.bars.push(bar);
      this.outline.add(bar);
    }
    this.outline.visible = false;
    this.world.createTransformEntity(this.outline);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (!this.pad) this.buildPad(d);
    const delta = dreamDelta(d, realDelta);
    const drawing = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat) && this.beat.scene === 'draw-window';
    if (drawing && !this.done) {
      // No drawing yet? After a while the window draws itself, slowly, so it reads as magic.
      if (!this.dragging && this.beat.time > cfg.autoAfterSec) {
        this.auto = Math.min(1, this.auto + delta / cfg.autoDrawSec);
        this.defaultRect(this.start, this.end, this.auto);
        this.showOutline();
        if (this.auto >= 1) this.accept(d);
      }
    }
    // A drawing that was rejected, or a scene that moved on, leaves no stray outline behind.
    if (!this.dragging && this.opening < 0 && this.outline.visible && (!drawing || this.rejectedFor > 1.5)) this.outline.visible = false;
    if (this.rejectedFor >= 0) this.rejectedFor += realDelta;
    if (this.opening >= 0) {
      this.opening = Math.min(1, this.opening + delta / cfg.openSec);
      d.setValue(RoomSlots, 'holeOpen', this.opening);
      if (this.opening >= 1) this.outline.visible = false;
    }
  }

  /** An invisible drawing surface over the wall, listening for the pinch-drag. */
  private buildPad(d: Entity): void {
    this.origin.fromArray(d.getVectorView(RoomSlots, 'windowOrigin'));
    this.out.fromArray(d.getVectorView(RoomSlots, 'windowOut'));
    this.along.fromArray(d.getVectorView(RoomSlots, 'windowAlong'));
    const mesh = new Mesh(new PlaneGeometry(cfg.padWidth, cfg.padHeight), new MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    mesh.name = 'WindowDrawPad';
    mesh.position.copy(this.origin).addScaledVector(this.out, -0.1).addScaledVector(UP, cfg.padHeight / 2 + 0.1);
    mesh.lookAt(this.tmp.copy(mesh.position).sub(this.out));
    this.pad = this.world.createTransformEntity(mesh);
    this.pad.addComponent(RayInteractable);
    const onDown = (e: { point?: Vector3 }) => {
      if (this.done || !e.point || !this.isDrawingBeat(d)) return;
      this.dragging = true;
      this.rejectedFor = -1;
      this.start.copy(e.point);
      this.end.copy(e.point);
      this.showOutline();
    };
    const onMove = (e: { point?: Vector3 }) => {
      if (!this.dragging || !e.point) return;
      this.end.copy(e.point);
      this.showOutline();
    };
    const onUp = () => {
      if (!this.dragging) return;
      this.dragging = false;
      const w = Math.abs(this.tmp.subVectors(this.end, this.start).dot(this.along));
      const h = Math.abs(this.end.y - this.start.y);
      if (w >= cfg.minWidth && h >= cfg.minHeight) this.accept(d);
      else {
        this.rejectedFor = 0;
        d.setValue(Caption, 'text', 'Draw it bigger: a window Bigfoot can fit through.');
        d.setValue(Caption, 'ttl', 4);
      }
    };
    mesh.addEventListener('pointerdown' as never, onDown as never);
    mesh.addEventListener('pointermove' as never, onMove as never);
    mesh.addEventListener('pointerup' as never, onUp as never);
    this.cleanupFuncs.push(() => {
      mesh.removeEventListener('pointerdown' as never, onDown as never);
      mesh.removeEventListener('pointermove' as never, onMove as never);
      mesh.removeEventListener('pointerup' as never, onUp as never);
    });
  }

  private isDrawingBeat(d: Entity): boolean {
    return d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat) && this.beat.scene === 'draw-window';
  }

  /** The window it draws by itself: the default bay, traced corner to corner over k (0..1). */
  private defaultRect(a: Vector3, b: Vector3, k: number): void {
    const half = 0.8;
    a.copy(this.origin).addScaledVector(this.along, -half).setY(0.15);
    b.copy(this.origin).addScaledVector(this.along, -half + 2 * half * k).setY(0.15 + 2.6 * k);
  }

  /** The glowing rectangle between the two drag corners, on the wall. */
  private showOutline(): void {
    const t = 0.035;
    const a = this.tmp.subVectors(this.end, this.start);
    const w = a.dot(this.along);
    const h = this.end.y - this.start.y;
    const yaw = Math.atan2(this.along.x, this.along.z);
    const base = new Vector3().copy(this.start).addScaledVector(this.out, -0.12);
    const place = (bar: Mesh, du: number, dv: number, sw: number, sh: number) => {
      bar.position.copy(base).addScaledVector(this.along, du).addScaledVector(UP, dv);
      bar.rotation.set(0, yaw, 0);
      bar.scale.set(t, Math.max(t, Math.abs(sh)), Math.max(t, Math.abs(sw)));
    };
    place(this.bars[0], w / 2, 0, w, t);
    place(this.bars[1], w / 2, h, w, t);
    place(this.bars[2], 0, h / 2, t, h);
    place(this.bars[3], w, h / 2, t, h);
    this.outline.visible = true;
  }

  /** Window chosen: move the window frame there, open it, and let the dream go on. */
  private accept(d: Entity): void {
    this.done = true;
    const mid = this.tmp.addVectors(this.start, this.end).multiplyScalar(0.5);
    const along = mid.clone().sub(this.origin).dot(this.along);
    let shift = along;
    if (Showcase.enabled) {
      // Snap to the nearer middle bay of the glass wall (bay centres are fixed in the room).
      const bays = NycLayout.window.bays;
      const z = this.origin.z + along * this.along.z;
      const nearest = bays.reduce((p, c) => (Math.abs(c - z) < Math.abs(p - z) ? c : p), bays[0]);
      shift = (nearest - this.origin.z) / (this.along.z || 1);
    }
    if (Math.abs(shift) > 0.01) {
      this.origin.addScaledVector(this.along, shift);
      this.origin.toArray(d.getVectorView(RoomSlots, 'windowOrigin'));
      d.setValue(RoomSlots, 'windowVersion', (d.getValue(RoomSlots, 'windowVersion') ?? 0) + 1);
    }
    // The outline settles onto the actual window, then the wall dissolves inside it.
    this.start.copy(this.origin).addScaledVector(this.along, -0.8).setY(0.15);
    this.end.copy(this.origin).addScaledVector(this.along, 0.8).setY(2.85);
    this.showOutline();
    this.opening = 0;
    Sound.play('bloom', this.origin, 0.9);
    d.setValue(Caption, 'text', "There's Bigfoot's window!");
    d.setValue(Caption, 'ttl', 4);
    d.setValue(DreamDirector, 'signal', 'window-drawn');
  }
}
