import { createSystem, Entity, Object3D, Quaternion, RayInteractable, Vector3, VisibilityState } from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Bigfoot, BigfootState } from '../components/bigfoot.js';
import { MemoryOrb } from '../components/memory.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta } from '../dreams/beat-context.js';
import { isUnlocked } from '../dreams/chapter_bigfoot.js';
import { MemoryStore } from '../memory/store.js';
import { buildMemoryOrb } from '../visuals/memory-orb.js';

const HOVER_FORWARD = 0.42;
const HOVER_DROP = 0.1;
const ease = (t: number) => t * t * (3 - 2 * t);

/** The moment the orb keeps: the first choice the user made, else the last. */
export function keptMoment(choices: string): string {
  const list = choices.split(',').filter(Boolean).map((c) => c.split(':'));
  return (list.find(([, how]) => how !== 'leanBack') ?? list[list.length - 1] ?? ['dj'])[0].replace(/-2$/, '');
}

/**
 * Waking: once Bigfoot is up, a memory orb of the kept moment forms above him
 * and floats to hover just below the center of view. Then the session is awake
 * and the orb drifts to the next slot on the Memory Shelf, where it is saved.
 */
export class WakingSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, DevControls, RoomSlots, Caption, Session] },
  dreamers: { required: [Bigfoot] },
}) {
  private orb?: Object3D;
  private orbEntity?: Entity;
  private generation = 0;
  private orbAge = 0;
  private arrived = false;
  private start = new Vector3();
  private hover = new Vector3();
  private head = new Vector3();
  private quat = new Quaternion();
  private fwd = new Vector3();
  private shelf = new Vector3();
  private fromHover = new Vector3();
  private shelfAge = -1;
  private landed = false;

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (d.getValue(Session, 'generation') !== this.generation) this.reset(d);
    const phase = d.getValue(Ritual, 'phase');
    if (phase !== RitualPhase.Waking && phase !== RitualPhase.Awake) return;
    const delta = dreamDelta(d, realDelta);
    const dreamer = this.queries.dreamers.entities.values().next().value;
    if (!this.orb) {
      if (!dreamer || dreamer.getValue(Bigfoot, 'state') !== BigfootState.Awake) return;
      this.spawn(d, dreamer);
      return;
    }
    this.orbAge += delta;
    if (phase === RitualPhase.Awake) {
      this.settleOnWall(d, delta);
      return;
    }
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.quat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.quat).setY(0).normalize();
    this.hover.copy(this.head).addScaledVector(this.fwd, HOVER_FORWARD);
    this.hover.y -= HOVER_DROP;
    const k = Math.min(1, this.orbAge / Tuning.waking.orbRiseSec);
    this.orb.position.lerpVectors(this.start, this.hover, ease(k));
    this.orb.position.y += Math.sin(Math.PI * k) * 0.06 + Math.sin(this.orbAge * 1.6) * 0.006 * k;
    this.orb.scale.setScalar(0.3 + 0.7 * ease(Math.min(1, this.orbAge / 0.8)));
    const inner = this.orb.getObjectByName('Moment');
    if (inner) inner.rotation.y += delta * 0.6;
    if (k >= 1 && !this.arrived) {
      this.arrived = true;
      Sound.play('bloom', this.orb.position, 0.7);
    }
    if (this.arrived && phase === RitualPhase.Waking && this.orbAge >= Tuning.waking.orbRiseSec + Tuning.waking.settleSec) {
      d.setValue(Ritual, 'phase', RitualPhase.Awake);
      d.setValue(Ritual, 'phaseTime', 0);
    }
  }

  /** "Restart dream": an orb still in flight is dropped; one already shelved stays. */
  private reset(d: Entity): void {
    this.generation = d.getValue(Session, 'generation') ?? 0;
    if (this.orbEntity && !this.landed) this.orbEntity.dispose();
    this.orb = this.orbEntity = undefined;
    this.orbAge = 0;
    this.arrived = this.landed = false;
    this.shelfAge = -1;
  }

  /** After waking, the orb drifts to its slot on the Memory Shelf: the session's closing image. */
  private settleOnWall(d: Entity, delta: number): void {
    const orb = this.orb!;
    if (this.shelfAge < 0) {
      this.shelfAge = 0;
      this.fromHover.copy(orb.position);
      this.shelf.copy(orb.position);
      if (d.getValue(Session, 'shelfReady')) {
        this.shelf.fromArray(d.getVectorView(Session, 'shelfNext'));
      } else if (d.getValue(RoomSlots, 'anchorReady')) {
        const a = d.getVectorView(RoomSlots, 'anchorPoint');
        const n = d.getVectorView(RoomSlots, 'anchorNormal');
        this.shelf.set(a[0] + n[0] * 0.06, a[1] - 0.22, a[2] + n[2] * 0.06);
      }
    }
    this.shelfAge += delta;
    const k = Math.min(1, this.shelfAge / 3);
    orb.position.lerpVectors(this.fromHover, this.shelf, ease(k));
    orb.position.y += Math.sin(this.orbAge * 1.6) * 0.004 + Math.sin(Math.PI * k) * 0.05;
    const inner = orb.getObjectByName('Moment');
    if (inner) inner.rotation.y += delta * 0.6;
    if (k >= 1 && !this.landed) {
      this.landed = true;
      Sound.play('chime', this.shelf, 0.7);
      this.keep(d);
      const night = d.getValue(Session, 'night') ?? 1;
      const allOpen = isUnlocked('ski', night, !!d.getValue(Session, 'unlockAll'));
      d.setValue(Caption, 'text', allOpen ? 'Kept on your shelf. Pinch it to dream it again.' : 'Kept on your shelf. A new dream opens tomorrow night.');
      d.setValue(Caption, 'ttl', 8);
    }
  }

  private spawn(d: Entity, dreamer: Entity): void {
    const moment = keptMoment(d.getValue(DreamDirector, 'choices') ?? '');
    dreamer.object3D?.getWorldPosition(this.start);
    this.start.y += 1.25;
    const orb = buildMemoryOrb(moment);
    orb.position.copy(this.start);
    this.orbEntity = this.world.createTransformEntity(orb);
    this.orbEntity.addComponent(MemoryOrb, {
      chapterId: d.getValue(DreamDirector, 'chapterId') ?? '',
      momentId: moment,
      createdAt: new Date().toISOString(),
    });
    this.orb = orb;
    this.orbAge = 0;
  }

  /** Landed: the orb joins the shelf (so it can be pinched to replay) and is saved. */
  private keep(d: Entity): void {
    const e = this.orbEntity;
    if (!e) return;
    if (d.getValue(Session, 'shelfReady')) {
      e.setValue(MemoryOrb, 'slot', d.getValue(Session, 'shelfNextSlot') ?? 0);
      e.addComponent(RayInteractable);
    }
    MemoryStore.addOrb({
      chapterId: e.getValue(MemoryOrb, 'chapterId') ?? '',
      momentId: e.getValue(MemoryOrb, 'momentId') ?? '',
      createdAt: e.getValue(MemoryOrb, 'createdAt') ?? '',
      night: d.getValue(Session, 'night') ?? 1,
    });
  }
}
