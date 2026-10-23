import { createSystem, Entity, VisibilityState } from '@iwsdk/core';
import { DreamDirector, DreamSeed, GazeTarget, SeedState } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Tuning } from '../config/tuning.js';
import { Chapters, findChapter } from '../dreams/registry.js';
import type { BeatDef } from '../dreams/types.js';

const dream = Tuning.dream;

/**
 * Runs a chapter as data: linear beats play for their duration; choice beats
 * wait for a seed to bloom (gaze dwell or pinch, handled by DreamSeedSystem).
 * Lean-back default: after leanBackTimeoutSec of looking at no seed — or
 * choiceMaxSec in total — the most-looked-at seed (else the default) blooms.
 * The dream never stalls. Dream time freezes while the headset is off.
 */
export class DreamDirectorSystem extends createSystem({
  director: { required: [DreamDirector, Ritual] },
  seeds: { required: [DreamSeed, GazeTarget] },
}) {
  update(delta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || d.getValue(Ritual, 'phase') !== RitualPhase.Asleep) return;

    if (!d.getValue(DreamDirector, 'started')) {
      if ((d.getValue(Ritual, 'phaseTime') ?? 0) < dream.startDelaySec) return;
      const chapter = Chapters[0];
      d.setValue(DreamDirector, 'chapterId', chapter.id);
      d.setValue(DreamDirector, 'started', true);
      this.goTo(d, chapter.start);
      return;
    }
    if (d.getValue(DreamDirector, 'completed')) return;

    const beat = findChapter(d.getValue(DreamDirector, 'chapterId') ?? '')?.beats[
      d.getValue(DreamDirector, 'beatId') ?? ''
    ];
    if (!beat) {
      d.setValue(DreamDirector, 'completed', true);
      return;
    }
    const beatTime = (d.getValue(DreamDirector, 'beatTime') ?? 0) + delta;
    d.setValue(DreamDirector, 'beatTime', beatTime);
    d.setValue(DreamDirector, 'dreamClock', (d.getValue(DreamDirector, 'dreamClock') ?? 0) + delta);

    if (beat.seeds) this.runChoice(d, beat, beatTime, delta);
    else if (beatTime >= beat.duration) {
      if (beat.next) this.goTo(d, beat.next);
      else d.setValue(DreamDirector, 'completed', true);
    }
  }

  private runChoice(d: Entity, beat: BeatDef, beatTime: number, delta: number): void {
    let anyFocused = false;
    let blooming = false;
    let mostLooked: Entity | undefined;
    let mostLook = 0;
    let fallback: Entity | undefined;
    let first: Entity | undefined;
    for (const s of this.queries.seeds.entities) {
      if (s.getValue(DreamSeed, 'beatId') !== beat.id) continue;
      const state = s.getValue(DreamSeed, 'state');
      if (state === SeedState.Blooming) {
        blooming = true;
        if ((s.getValue(DreamSeed, 'stateTime') ?? 0) >= dream.seedBloomSec) {
          d.setValue(DreamDirector, 'lastChoice', s.getValue(DreamSeed, 'seedId') ?? '');
          d.setValue(DreamDirector, 'lastChoiceBy', s.getValue(DreamSeed, 'bloomedBy') ?? '');
          this.goTo(d, s.getValue(DreamSeed, 'branch') ?? '');
          return;
        }
      }
      if (s.getValue(GazeTarget, 'focused')) anyFocused = true;
      const look = s.getValue(DreamSeed, 'lookTotal') ?? 0;
      if (look > mostLook) {
        mostLook = look;
        mostLooked = s;
      }
      if (s.getValue(DreamSeed, 'seedId') === beat.defaultSeed) fallback = s;
      first ??= s;
    }
    if (blooming) return;

    const idle = anyFocused ? 0 : (d.getValue(DreamDirector, 'idleGaze') ?? 0) + delta;
    d.setValue(DreamDirector, 'idleGaze', idle);
    if (idle < Tuning.gaze.leanBackTimeoutSec && beatTime < dream.choiceMaxSec) return;
    const pick = mostLooked ?? fallback ?? first;
    if (!pick || pick.getValue(DreamSeed, 'state') === SeedState.Appearing) return;
    pick.setValue(DreamSeed, 'state', SeedState.Blooming);
    pick.setValue(DreamSeed, 'stateTime', 0);
    pick.setValue(DreamSeed, 'bloomedBy', 'leanBack');
  }

  private goTo(d: Entity, beatId: string): void {
    d.setValue(DreamDirector, 'beatId', beatId);
    d.setValue(DreamDirector, 'beatTime', 0);
    d.setValue(DreamDirector, 'idleGaze', 0);
  }
}
