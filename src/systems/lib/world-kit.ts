import { Entity, Object3D, Vector3 } from '@iwsdk/core';
import { Sound } from '../../audio/engine.js';
import { Caption } from '../../components/ritual.js';
import { Session } from '../../components/session.js';

type Vec = { x: number; y: number; z: number };

/**
 * Shared pieces of the dream worlds (clouds, winter, sea): the fade in and out,
 * both hands (position and speed, from the grip spaces, which follow the hands
 * when hand tracking is on), Bigfoot's place in the world, and his lines.
 */
export class WorldKit {
  /** 0..1, how far this world is faded in. */
  amount = 0;
  on = false;
  readonly hands = [new Vector3(), new Vector3()];
  readonly handSpeed = [0, 0];
  private last = [new Vector3(), new Vector3()];
  private primed = false;
  private spoke = new Set<string>();

  constructor(private id: string) {}

  /** Fade towards the wanted state; returns true on the frame the world starts. */
  step(d: Entity, dt: number, rate = 0.6): boolean {
    const want = (d.getValue(Session, 'world') ?? '') === this.id;
    const started = want && !this.on;
    if (started) this.spoke.clear();
    if (!want && this.on) d.setValue(Session, 'worldAnim', '');
    this.on = want;
    this.amount += ((want ? 1 : 0) - this.amount) * Math.min(1, dt * rate);
    if (!want && this.amount < 0.002) this.amount = 0;
    return started;
  }

  /** Read both hands (left, right) and how fast each is moving (m/s). */
  readHands(left: Object3D, right: Object3D, dt: number): void {
    left.getWorldPosition(this.hands[0]);
    right.getWorldPosition(this.hands[1]);
    for (let i = 0; i < 2; i++) {
      const v = this.primed && dt > 0 ? this.hands[i].distanceTo(this.last[i]) / dt : 0;
      this.handSpeed[i] += (v - this.handSpeed[i]) * Math.min(1, dt * 10);
      this.last[i].copy(this.hands[i]);
    }
    this.primed = true;
  }

  /** The nearer hand to p, and its distance (index in `hand`). */
  nearest(p: Vec, out: { hand: number; dist: number }): void {
    const a = this.hands[0].distanceTo(p as Vector3);
    const b = this.hands[1].distanceTo(p as Vector3);
    out.hand = a < b ? 0 : 1;
    out.dist = Math.min(a, b);
  }

  /** Put Bigfoot in the world: his floor point, heading, and move. */
  placeBigfoot(d: Entity, at: Vec, yaw: number, anim: string): void {
    const v = d.getVectorView(Session, 'worldSpot');
    v[0] = at.x;
    v[1] = at.y;
    v[2] = at.z;
    d.setValue(Session, 'worldYaw', yaw);
    if (d.getValue(Session, 'worldAnim') !== anim) d.setValue(Session, 'worldAnim', anim);
  }

  /** A line from Bigfoot, once per visit (voice clip public/audio/voice/<id>.mp3 plus a caption). */
  say(d: Entity, id: string, text: string, at: Vec): void {
    if (this.spoke.has(id)) return;
    this.spoke.add(id);
    Sound.speak(id, at);
    d.setValue(Caption, 'text', `Bigfoot: ${text}`);
    d.setValue(Caption, 'ttl', Math.max(3.5, text.split(' ').length * 0.42));
  }

  /** Caption only (titles, hints). */
  caption(d: Entity, text: string, ttl = 5): void {
    d.setValue(Caption, 'text', text);
    d.setValue(Caption, 'ttl', ttl);
  }

  preload(ids: string[]): void {
    for (const id of ids) Sound.preloadVoice(id);
  }
}
