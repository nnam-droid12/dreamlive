import { createSystem, VisibilityState } from '@iwsdk/core';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { Journal } from '../memory/journal.js';
import { FriendshipBoard } from '../visuals/friendship-board.js';

const cfg = Tuning.memory;

/**
 * "It remembers you": starts this visit in the journal, and hangs the
 * friendship chalkboard on the bedroom wall (beside the TV in the showcase
 * room; on a headset, on the TV's wall beside the screen), redrawing it in
 * chalk whenever your story together grows.
 */
export class JournalSystem extends createSystem({
  director: { required: [RoomSlots] },
}) {
  private board = new FriendshipBoard();
  private drawn = -1;
  private placed = false;

  init(): void {
    Journal.begin();
    this.board.root.visible = false;
    this.world.createTransformEntity(this.board.root);
  }

  update(): void {
    if (this.visibilityState.peek() === VisibilityState.NonImmersive && !Showcase.enabled) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (!this.placed) this.place(d);
    const v = Journal.version();
    if (v !== this.drawn) {
      this.drawn = v;
      this.board.draw(Journal.now());
    }
  }

  private place(d: import('@iwsdk/core').Entity): void {
    this.placed = true;
    if (Showcase.enabled) {
      this.board.root.position.set(cfg.board.x, cfg.board.y, cfg.board.z);
      this.board.root.rotation.set(0, cfg.board.yaw, 0);
    } else {
      // Beside the TV on its wall (the anchor), a little to the right.
      const a = d.getVectorView(RoomSlots, 'anchorPoint');
      const n = d.getVectorView(RoomSlots, 'anchorNormal');
      const w = d.getValue(RoomSlots, 'anchorWidth') ?? 2;
      const rx = -n[2];
      const rz = n[0];
      this.board.root.position.set(a[0] + rx * (w / 2 + 0.75) + n[0] * 0.01, 1.55, a[2] + rz * (w / 2 + 0.75) + n[2] * 0.01);
      this.board.root.rotation.set(0, Math.atan2(n[0], n[2]), 0);
    }
    this.board.root.visible = true;
  }
}
