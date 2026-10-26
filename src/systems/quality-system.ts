import { createSystem, VisibilityState } from '@iwsdk/core';
import { Session } from '../components/session.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';

const cfg = Tuning.performance;

/**
 * Adaptive quality: watches the real frame rate in the headset and steps
 * quality down when it can't hold the target (1: half-resolution TV picture,
 * 2: half the room particles, 3: frozen shadows), and back up after a long
 * stretch of headroom. Showcase (video/desktop capture) always stays at full
 * quality. The measured fps is shown on the pause panel.
 */
export class QualitySystem extends createSystem({
  director: { required: [Session] },
}) {
  private avgFps = 0;
  private lowFor = 0;
  private highFor = 0;
  private sinceChange = 0;

  update(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d || delta <= 0 || this.visibilityState.peek() !== VisibilityState.Visible) return;
    const fps = 1 / delta;
    this.avgFps = this.avgFps ? this.avgFps + (fps - this.avgFps) * 0.05 : fps;
    d.setValue(Session, 'fps', this.avgFps);
    if (Showcase.enabled) return;

    this.sinceChange += delta;
    this.lowFor = this.avgFps < cfg.degradeBelowFps ? this.lowFor + delta : 0;
    this.highFor = this.avgFps > cfg.targetFps - 3 ? this.highFor + delta : 0;
    const level = d.getValue(Session, 'quality') ?? 0;
    if (this.lowFor >= cfg.degradeAfterSec && level < 3) this.set(d, level + 1);
    else if (this.highFor >= cfg.upgradeAfterSec && this.sinceChange >= cfg.upgradeAfterSec && level > 0) this.set(d, level - 1);
  }

  private set(d: import('@iwsdk/core').Entity, level: number): void {
    d.setValue(Session, 'quality', level);
    this.lowFor = this.highFor = this.sinceChange = 0;
    // Shadows are the last resort: keep the last shadow map instead of redrawing it.
    this.renderer.shadowMap.autoUpdate = level < 3;
    if (level >= 3) this.renderer.shadowMap.needsUpdate = true;
  }
}
