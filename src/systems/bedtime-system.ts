import { createSystem, VisibilityState } from '@iwsdk/core';
import { DreamDirector } from '../components/dream.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Tuning } from '../config/tuning.js';

const cfg = Tuning.bedtime;

/**
 * Bedtime mode: a calm place to stay after the story. Chosen from the palm
 * menu, or by itself a little while after the Rooftop night ends. The sky goes
 * to deep night, rain runs down the glass, the party falls quiet and Bigfoot is
 * back in bed, snoring. A soft fade from black covers the change.
 */
export class BedtimeSystem extends createSystem({
  director: { required: [Session, Ritual, DreamDirector, Caption] },
}) {
  private was = false;
  private autoDone = false;
  private generation = -1;

  update(): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const gen = d.getValue(Session, 'generation') ?? 0;
    const phase = d.getValue(Ritual, 'phase');
    if (gen !== this.generation || phase === RitualPhase.Idle || phase === RitualPhase.Arrival) {
      // A new dream: bedtime is over until the story ends again.
      this.generation = gen;
      this.autoDone = false;
      if (d.getValue(Session, 'bedtime')) d.setValue(Session, 'bedtime', false);
    }
    const awake = phase === RitualPhase.Awake;
    if (awake && !this.autoDone && d.getValue(DreamDirector, 'chapterId') === 'rooftop-party' && (d.getValue(Ritual, 'phaseTime') ?? 0) > cfg.autoAfterSec) {
      this.autoDone = true;
      d.setValue(Session, 'bedtime', true);
    }
    const bed = !!d.getValue(Session, 'bedtime');
    if (bed === this.was) return;
    this.was = bed;
    d.setValue(Session, 'fadeIn', cfg.fadeSec);
    if (bed) {
      d.setValue(Session, 'djSong', '');
      d.setValue(Session, 'weather', 'rain');
      d.setValue(Session, 'dawnOverride', 0);
      d.setValue(Caption, 'text', 'Bedtime. Bigfoot is fast asleep. Listen to the rain on New York.');
    } else {
      d.setValue(Session, 'weather', 'clear');
      d.setValue(Session, 'dawnOverride', -1);
      d.setValue(Caption, 'text', 'Good morning.');
    }
    d.setValue(Caption, 'ttl', 5);
  }
}
