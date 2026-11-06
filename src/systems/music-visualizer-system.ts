import { createSystem, Vector3, VisibilityState } from '@iwsdk/core';
import { DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Tuning } from '../config/tuning.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { Motes, MoteStyle } from '../visuals/motes.js';

const cfg = Tuning.visualizer;

/**
 * Each scene has its own music visualization, driven live by the music
 * (Session music bands from the analyser): golden dream dust in the bedroom,
 * light streaming upward for the leaps, colourful sparkles that jump on the
 * kick for the gifts, a slow pink-gold swirl for the ending, cool fireflies at
 * bedtime. (At the party the skyline itself is the visualizer.) The cloud is a
 * box around the viewer, re-centred gently so it never feels head-locked.
 */
export class MusicVisualizerSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, Session, RoomSlots] },
}) {
  private motes!: Motes;
  private beat = newBeatContext();
  private time = 0;
  private amount = 0;
  private center = new Vector3();
  private head = new Vector3();
  private placed = false;

  init(): void {
    this.motes = new Motes(cfg.count, new Vector3(cfg.box.x, cfg.box.y, cfg.box.z));
    this.motes.points.visible = false;
    this.world.createTransformEntity(this.motes.points);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    this.time += realDelta;
    const style = this.styleFor(d);
    this.amount += ((style ? 1 : 0) - this.amount) * Math.min(1, realDelta * 0.8);
    const p = this.motes.points;
    p.visible = this.amount > 0.01;
    if (!p.visible) return;
    if (style) this.motes.blendTo(style, Math.min(1, realDelta * 0.7));

    // Follow the viewer loosely (the box is centred on them at floor level).
    this.player.head.getWorldPosition(this.head);
    this.head.y = 0;
    if (!this.placed || this.center.distanceTo(this.head) > cfg.recenter) {
      this.placed = true;
      this.center.copy(this.head);
    }
    p.position.copy(this.center);

    const u = this.motes.mat.uniforms;
    u.uTime.value = this.time;
    u.uOpacity.value = this.amount * cfg.opacity;
    const b = u.uBands.value as Vector3;
    const k = Math.min(1, realDelta * 10);
    b.x += ((d.getValue(Session, 'musicBass') ?? 0) - b.x) * k;
    b.y += ((d.getValue(Session, 'musicMid') ?? 0) - b.y) * k;
    b.z += ((d.getValue(Session, 'musicHigh') ?? 0) - b.z) * k;
    u.uKick.value = d.getValue(Session, 'musicKick') ?? 0;
  }

  /** The look for the current scene, or undefined where another visualizer (the skyline) takes over. */
  private styleFor(d: import('@iwsdk/core').Entity): MoteStyle | undefined {
    const phase = d.getValue(Ritual, 'phase');
    if (phase === RitualPhase.Idle) return undefined;
    if (d.getValue(Session, 'bedtime')) return cfg.styles.bedtime;
    if (phase === RitualPhase.Waking || phase === RitualPhase.Awake) return cfg.styles.ending;
    if (phase !== RitualPhase.Asleep) return cfg.styles.bedroom;
    if (d.getValue(DreamDirector, 'chapterId') !== 'rooftop-party') return cfg.styles.bedroom;
    if (d.getValue(RoomSlots, 'viewOutside')) return undefined;
    const scene = readBeat(d, this.beat) ? this.beat.scene : '';
    if (scene === 'leap-out' || scene === 'leap-back') return cfg.styles.leap;
    if (scene === 'gifts') return cfg.styles.gifts;
    if (scene === 'to-bed') return cfg.styles.ending;
    if (scene === 'arrive' || scene === 'party-wait' || scene.startsWith('party-')) return undefined;
    return cfg.styles.bedroom;
  }
}
