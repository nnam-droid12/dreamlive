import {
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshStandardMaterial,
  Pressed,
  RayInteractable,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DreamDirector } from '../components/dream.js';
import { MemoryOrb } from '../components/memory.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta } from '../dreams/beat-context.js';
import { ACT_TITLE } from '../dreams/chapter_bigfoot.js';
import { MemoryStore } from '../memory/store.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';
import { buildMemoryOrb, ORB_RADIUS } from '../visuals/memory-orb.js';

const cfg = Tuning.memoryShelf;
const LEDGE_DEPTH = 0.13;
const LEDGE_THICK = 0.03;
const SLIDE_RATE = 3;

/**
 * The Memory Shelf: a walnut ledge on the wall beside the TV holding one orb per
 * dream kept, across sessions (MemoryStore). Pinching an orb (hand ray, or gaze +
 * pinch) replays its act on the TV while no dream is playing.
 */
export class MemoryShelfSystem extends createSystem({
  director: { required: [Session, RoomSlots, Ritual, Caption, DreamDirector] },
  orbs: { required: [MemoryOrb] },
  pressed: { required: [MemoryOrb, Pressed] },
}) {
  private built = false;
  private time = 0;
  private origin = new Vector3();
  private along = new Vector3();
  private normal = new Vector3();
  private up = new Vector3(0, 1, 0);
  private slotPos = new Vector3();
  private shelved: Entity[] = [];

  init(): void {
    this.cleanupFuncs.push(this.queries.pressed.subscribe('qualify', (e) => this.replay(e)));
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.built) {
      if (!d.getValue(RoomSlots, 'anchorReady')) return;
      this.build(d);
    }
    const delta = dreamDelta(d, realDelta);
    this.time += delta;
    this.arrange(d, delta);

    // A replay lasts a while, and gives way the moment a dream starts.
    if (d.getValue(Session, 'replay')) {
      const t = (d.getValue(Session, 'replayTime') ?? 0) + delta;
      d.setValue(Session, 'replayTime', t);
      const dreaming = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && d.getValue(DreamDirector, 'started');
      if (t >= cfg.replaySec || dreaming) d.setValue(Session, 'replay', '');
    }
  }

  /** Orders shelved orbs oldest → newest, keeps the newest `capacity`, slides them home. */
  private arrange(d: Entity, delta: number): void {
    this.shelved.length = 0;
    for (const e of this.queries.orbs.entities) {
      if ((e.getValue(MemoryOrb, 'slot') ?? -1) >= 0) this.shelved.push(e);
    }
    this.shelved.sort((a, b) => (a.getValue(MemoryOrb, 'slot') ?? 0) - (b.getValue(MemoryOrb, 'slot') ?? 0));
    while (this.shelved.length > cfg.capacity) this.shelved.shift()!.dispose();
    const k = Math.min(1, SLIDE_RATE * delta);
    for (let i = 0; i < this.shelved.length; i++) {
      const obj = this.shelved[i].object3D;
      if (!obj) continue;
      this.slot(i, this.slotPos);
      this.slotPos.y += Math.sin(this.time * 1.4 + i) * 0.004;
      obj.position.lerp(this.slotPos, k);
      const inner = obj.getObjectByName('Moment');
      if (inner) inner.rotation.y += delta * 0.6;
    }
    const last = this.shelved[this.shelved.length - 1];
    d.setValue(Session, 'shelfNextSlot', last ? (last.getValue(MemoryOrb, 'slot') ?? 0) + 1 : 0);
    this.slot(Math.min(this.shelved.length, cfg.capacity - 1), this.slotPos).toArray(d.getVectorView(Session, 'shelfNext'));
  }

  /** World position of shelf slot i (left to right). */
  private slot(i: number, out: Vector3): Vector3 {
    const offset = (i - (cfg.capacity - 1) / 2) * cfg.spacing;
    return out.copy(this.origin).addScaledVector(this.along, offset).addScaledVector(this.up, LEDGE_THICK / 2 + ORB_RADIUS + 0.004);
  }

  private build(d: Entity): void {
    this.built = true;
    const anchor = new Vector3().fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    this.normal.fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    this.along.crossVectors(this.up, this.normal).normalize();
    this.origin
      .copy(anchor)
      .addScaledVector(this.along, cfg.offsetRight)
      .addScaledVector(this.up, -cfg.drop)
      .addScaledVector(this.normal, LEDGE_DEPTH / 2 + 0.01);

    const ledge = new Group();
    ledge.name = 'MemoryShelf';
    const wood = new MeshStandardMaterial({ color: Palette.shelfWood, roughness: 0.55, metalness: 0 });
    const length = cfg.capacity * cfg.spacing + 0.08;
    const board = new Mesh(bevelBox(length, LEDGE_THICK, LEDGE_DEPTH, 0.008), wood);
    board.castShadow = board.receiveShadow = true;
    ledge.add(board);
    ledge.position.copy(this.origin);
    ledge.lookAt(this.slotPos.copy(this.origin).add(this.normal));
    this.world.createTransformEntity(ledge);

    const saved = MemoryStore.orbs().slice(-cfg.capacity);
    saved.forEach((o, i) => {
      const orb = buildMemoryOrb(o.momentId);
      orb.position.copy(this.slot(i, this.slotPos));
      const e = this.world.createTransformEntity(orb);
      e.addComponent(MemoryOrb, { chapterId: o.chapterId, momentId: o.momentId, createdAt: o.createdAt, slot: i });
      e.addComponent(RayInteractable);
    });
    d.setValue(Session, 'shelfReady', true);
  }

  private replay(e: Entity): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d || d.getValue(Session, 'paused') || (e.getValue(MemoryOrb, 'slot') ?? -1) < 0) return;
    const phase = d.getValue(Ritual, 'phase');
    if (phase !== RitualPhase.Awake && phase !== RitualPhase.Arrival) return;
    const act = e.getValue(MemoryOrb, 'momentId') ?? '';
    d.setValue(Session, 'replay', act);
    d.setValue(Session, 'replayTime', 0);
    if (e.object3D) Sound.play('bloom', e.object3D.position, 0.7);
    d.setValue(Caption, 'text', `A memory: ${ACT_TITLE[act] ?? 'a dream'}.`);
    d.setValue(Caption, 'ttl', 5);
  }
}
