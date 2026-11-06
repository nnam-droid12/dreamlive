import { createSystem, Entity, VisibilityState } from '@iwsdk/core';
import { DevControls, DreamDirector, DreamSeed, GazeTarget, SeedState } from '../components/dream.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Director } from '../config/director.js';
import { Tuning } from '../config/tuning.js';
import { actOf } from '../dreams/chapter_bigfoot.js';
import { chooseChapter, findChapter } from '../dreams/registry.js';
import { Session } from '../components/session.js';
import type { BeatDef } from '../dreams/types.js';
import { dreamDelta } from '../dreams/beat-context.js';

const dream = Tuning.dream;

/**
 * Runs a chapter as data: linear beats play for their duration; choice beats
 * wait for a seed to bloom (gaze dwell or pinch, handled by DreamSeedSystem).
 * Lean-back default: after leanBackTimeoutSec of looking at no seed — or
 * choiceMaxSec in total — the most-looked-at seed (else the default) blooms.
 * The dream never stalls. Dream time freezes while the headset is off.
 */
export class DreamDirectorSystem extends createSystem({
  director: { required: [DreamDirector, Ritual, DevControls, Caption] },
  seeds: { required: [DreamSeed, GazeTarget] },
}) {
  /** One-time teaching captions, so the core mechanic is obvious in the first minute. */
  private taughtChoice = false;
  private taughtFollow = false;

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || d.getValue(Ritual, 'phase') !== RitualPhase.Asleep) return;
    const delta = dreamDelta(d, realDelta);

    if (!d.getValue(DreamDirector, 'started')) {
      if ((d.getValue(Ritual, 'phaseTime') ?? 0) < dream.startDelaySec) return;
      // The trailer (Director mode) always films the Rooftop Party.
      const chapter = (Director.enabled && findChapter('rooftop-party')) || chooseChapter(d.getValue(Session, 'night') ?? 1, !!d.getValue(Session, 'unlockAll'), d.getValue(Session, 'generation') ?? 0);
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
      this.finish(d);
      return;
    }
    const beatTime = (d.getValue(DreamDirector, 'beatTime') ?? 0) + delta;
    d.setValue(DreamDirector, 'beatTime', beatTime);
    d.setValue(DreamDirector, 'dreamClock', (d.getValue(DreamDirector, 'dreamClock') ?? 0) + delta);

    const signalled = !!beat.endOn && d.getValue(DreamDirector, 'signal') === beat.endOn;
    if (beat.seeds) this.runChoice(d, beat, beatTime, delta);
    else if (beatTime >= beat.duration || signalled) {
      if (beat.next) this.goTo(d, beat.next);
      else this.finish(d);
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
      if (s.getValue(DreamSeed, 'beatId') !== beat.id || s.getValue(DreamSeed, 'locked')) continue;
      const state = s.getValue(DreamSeed, 'state');
      if (state === SeedState.Blooming) {
        blooming = true;
        if ((s.getValue(DreamSeed, 'stateTime') ?? 0) >= dream.seedBloomSec) {
          d.setValue(DreamDirector, 'lastChoice', s.getValue(DreamSeed, 'seedId') ?? '');
          d.setValue(DreamDirector, 'lastChoiceBy', s.getValue(DreamSeed, 'bloomedBy') ?? '');
          const prior = d.getValue(DreamDirector, 'choices') ?? '';
          const entry = `${s.getValue(DreamSeed, 'seedId')}:${s.getValue(DreamSeed, 'bloomedBy')}`;
          d.setValue(DreamDirector, 'choices', prior ? `${prior},${entry}` : entry);
          this.confirmChoice(d, s.getValue(DreamSeed, 'bloomedBy') ?? '');
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
    let pick = mostLooked ?? fallback ?? first;
    const lastAct = actOf(d.getValue(DreamDirector, 'lastChoice') ?? '');
    if (!mostLooked && pick && lastAct && actOf(pick.getValue(DreamSeed, 'seedId') ?? '') === lastAct) {
      for (const s of this.queries.seeds.entities) {
        if (s.getValue(DreamSeed, 'beatId') !== beat.id || s.getValue(DreamSeed, 'locked')) continue;
        if (actOf(s.getValue(DreamSeed, 'seedId') ?? '') !== lastAct) {
          pick = s;
          break;
        }
      }
    }
    if (!pick || pick.getValue(DreamSeed, 'state') === SeedState.Appearing) return;
    pick.setValue(DreamSeed, 'state', SeedState.Blooming);
    pick.setValue(DreamSeed, 'stateTime', 0);
    pick.setValue(DreamSeed, 'bloomedBy', 'leanBack');
  }

  /** Chapter over: hand the session to the waking sequence. */
  private finish(d: Entity): void {
    d.setValue(DreamDirector, 'completed', true);
    d.setValue(Ritual, 'phase', RitualPhase.Waking);
    d.setValue(Ritual, 'phaseTime', 0);
  }

  private caption(d: Entity, text: string, seconds: number): void {
    d.setValue(Caption, 'text', text);
    d.setValue(Caption, 'ttl', seconds);
  }

  private confirmChoice(d: Entity, how: string): void {
    if (how === 'catch') this.caption(d, 'You caught a falling star.', 4);
    else if (how !== 'leanBack' && !this.taughtFollow) {
      this.taughtFollow = true;
      this.caption(d, how === 'pinch' ? 'The dream follows your choice.' : 'The dream follows your gaze.', 4);
    }
  }

  private goTo(d: Entity, beatId: string): void {
    d.setValue(DreamDirector, 'signal', '');
    d.setValue(DreamDirector, 'beatId', beatId);
    const beat = findChapter(d.getValue(DreamDirector, 'chapterId') ?? '')?.beats[beatId];
    if (beat?.seeds && !this.taughtChoice) {
      this.taughtChoice = true;
      this.caption(d, 'Look at a glowing light to choose the dream.', 7);
    }
    d.setValue(DreamDirector, 'beatTime', 0);
    d.setValue(DreamDirector, 'idleGaze', 0);
  }
}
