import { createSystem, VisibilityState } from '@iwsdk/core';
import { DevControls } from '../components/dream.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Tuning } from '../config/tuning.js';

const r = Tuning.ritual;
const RINGS_TOTAL_SEC = r.ringGrowSec + r.ringMergeSec + r.ringFadeSec;
export const ARRIVAL_CAPTION = 'Shh... Bigfoot is asleep. Look at him to peek into his dream.';

/**
 * Runs the opening timeline: Idle → Arrival (on entering XR) → Rings →
 * DreamerEnter → Asleep (set by DreamerSystem). Dream time only advances while
 * the XR session is visible, so taking the headset off freezes the ritual.
 */
export class RitualDirectorSystem extends createSystem({
  director: { required: [Ritual, Caption, DevControls] },
}) {
  private wasArriving = false;

  update(realDelta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;

    const delta = realDelta * (d.getValue(DevControls, 'timeScale') ?? 1);
    let phase = d.getValue(Ritual, 'phase');
    if (phase === RitualPhase.Idle) {
      phase = RitualPhase.Arrival;
      d.setValue(Ritual, 'phase', phase);
      d.setValue(Ritual, 'phaseTime', 0);
      d.setValue(Ritual, 'elapsed', 0);
    }
    const elapsed = (d.getValue(Ritual, 'elapsed') ?? 0) + delta;
    const phaseTime = (d.getValue(Ritual, 'phaseTime') ?? 0) + delta;
    d.setValue(Ritual, 'elapsed', elapsed);
    d.setValue(Ritual, 'phaseTime', phaseTime);

    if (phase === RitualPhase.Rings && phaseTime >= RINGS_TOTAL_SEC) {
      d.setValue(Ritual, 'phase', RitualPhase.DreamerEnter);
      d.setValue(Ritual, 'phaseTime', 0);
    } else if (phase === RitualPhase.Asleep && (d.getValue(Ritual, 'asleepAt') ?? -1) < 0) {
      d.setValue(Ritual, 'asleepAt', elapsed);
    }

    // Own the caption only around Arrival so sound captions can use it later.
    const arriving = phase === RitualPhase.Arrival;
    if (arriving !== this.wasArriving) {
      this.wasArriving = arriving;
      d.setValue(Caption, 'text', arriving ? ARRIVAL_CAPTION : '');
      d.setValue(Caption, 'ttl', 0);
    }
  }
}
