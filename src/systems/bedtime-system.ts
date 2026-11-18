import { Director } from '../config/director.js';
import { createSystem, VisibilityState } from '@iwsdk/core';
import { DreamDirector } from '../components/dream.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Tuning } from '../config/tuning.js';

const cfg = Tuning.bedtime;

/**
 * Bedtime mode (now used only by the Director's film; the app no longer offers it).
 * The sky goes
 * to deep night, rain runs down the glass, the party falls quiet and Bigfoot is
 * back in bed, snoring. A soft fade from black covers the change.
 */
export class BedtimeSystem extends createSystem({
  director: { required: [Session, Ritual, DreamDirector, Caption] },
}) {
  private was = false;
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
      if (d.getValue(Session, 'bedtime')) d.setValue(Session, 'bedtime', false);
    }
    // Bedtime is no longer offered in the app (it does not start by itself, and the palm menu and
    // the sea's Goodnight no longer open it); only the Director's film may still use it.
    if (!Director.enabled && d.getValue(Session, 'bedtime')) d.setValue(Session, 'bedtime', false);
    const bed = !!d.getValue(Session, 'bedtime');
    if (bed === this.was) return;
    this.was = bed;
    d.setValue(Session, 'fadeIn', cfg.fadeSec);
    if (bed) {
      d.setValue(Session, 'djSong', '');
      // A calm, clear night: no rain at bedtime.
      d.setValue(Session, 'weather', 'clear');
      d.setValue(Session, 'skyOverride', 'night');
      d.setValue(Caption, 'text', 'Bedtime. Bigfoot is fast asleep. Goodnight, New York.');
    } else {
      d.setValue(Session, 'weather', 'clear');
      d.setValue(Session, 'skyOverride', '');
      d.setValue(Caption, 'text', 'Good morning.');
    }
    d.setValue(Caption, 'ttl', 5);
  }
}
