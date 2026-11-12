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
  /** The refresh rate asked of the headset (0 = not set / not supported). */
  private hz = 0;

  init(): void {
    // On a headset: foveated rendering, and the smoothest refresh rate it offers.
    const onStart = (): void => {
      const session = this.renderer.xr.getSession() as (Omit<XRSession, 'updateTargetFrameRate' | 'supportedFrameRates'> & { supportedFrameRates?: Float32Array; updateTargetFrameRate?: (r: number) => Promise<void> }) | null;
      if (!session) return;
      this.renderer.xr.setFoveation(cfg.foveation);
      this.hz = 0;
      const rates = session.supportedFrameRates ? Array.from(session.supportedFrameRates) : [];
      if (typeof session.updateTargetFrameRate === 'function' && rates.includes(cfg.preferredHz)) this.setHz(session as unknown as XRSession, cfg.preferredHz);
    };
    this.renderer.xr.addEventListener('sessionstart', onStart);
    this.cleanupFuncs.push(() => this.renderer.xr.removeEventListener('sessionstart', onStart));
  }

  private setHz(session: XRSession, hz: number): void {
    this.hz = hz;
    const s = session as unknown as { updateTargetFrameRate?: (r: number) => Promise<void> };
    if (typeof s.updateTargetFrameRate === 'function') void s.updateTargetFrameRate(hz).catch(() => undefined);
  }

  update(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d || delta <= 0 || this.visibilityState.peek() !== VisibilityState.Visible) return;
    const fps = 1 / delta;
    this.avgFps = this.avgFps ? this.avgFps + (fps - this.avgFps) * 0.05 : fps;
    d.setValue(Session, 'fps', this.avgFps);
    if (Showcase.enabled) return;

    this.sinceChange += delta;
    // The bar is the refresh rate actually asked for (90 Hz needs ~85 fps; 72 Hz ~66).
    const target = this.hz || cfg.targetFps;
    const floor = target - (cfg.targetFps - cfg.degradeBelowFps);
    this.lowFor = this.avgFps < floor ? this.lowFor + delta : 0;
    this.highFor = this.avgFps > target - 3 ? this.highFor + delta : 0;
    const level = d.getValue(Session, 'quality') ?? 0;
    // Rather than stutter at 90, settle at a steady 72 once quality has stepped down this far.
    if (this.lowFor >= cfg.degradeAfterSec && this.hz === cfg.preferredHz && level >= cfg.fallbackAtLevel) {
      const session = this.renderer.xr.getSession();
      if (session) this.setHz(session, cfg.steadyHz);
      this.lowFor = 0;
    } else if (this.lowFor >= cfg.degradeAfterSec && level < 3) this.set(d, level + 1);
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
