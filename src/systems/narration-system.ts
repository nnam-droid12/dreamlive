import { createSystem, Vector3, VisibilityState } from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Bigfoot } from '../components/bigfoot.js';
import { DreamDirector } from '../components/dream.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { NARRATION, voiceFileOf } from '../dreams/narration.js';

/**
 * Bigfoot narrates his dream: as each beat of the Rooftop Party starts, his line
 * plays from his head (spatial audio, music ducked) with a subtitle. Lines say
 * what to do next, so the subtitles double as the hands-first instructions.
 */
export class NarrationSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, Caption, Session] },
  bigfoot: { required: [Bigfoot] },
}) {
  private beat = newBeatContext();
  private said = new Set<string>();
  private lastBeat = '';
  private generation = -1;
  private wasBed = false;
  private bedAt = -1;
  private at = new Vector3();
  private preloaded = false;

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.preloaded && Sound.ctx) {
      this.preloaded = true;
      for (const l of NARRATION) Sound.preloadVoice(voiceFileOf(l.id));
    }
    const gen = d.getValue(Session, 'generation') ?? 0;
    if (gen !== this.generation) {
      this.generation = gen;
      this.said.clear();
    }
    if (d.getValue(DreamDirector, 'chapterId') !== 'rooftop-party') return;

    // Beats of the dream.
    const phase = d.getValue(Ritual, 'phase');
    if (phase === RitualPhase.Asleep && readBeat(d, this.beat)) {
      const id = d.getValue(DreamDirector, 'beatId') ?? '';
      if (id !== this.lastBeat) {
        this.lastBeat = id;
        if (id === 'draw-window') this.said.clear();
      }
      this.cue(d, id, this.beat.time);
    }
    // Bedtime, after the story.
    const bed = !!d.getValue(Session, 'bedtime');
    if (bed && !this.wasBed) this.bedAt = 0;
    this.wasBed = bed;
    if (bed && this.bedAt >= 0) {
      this.bedAt += realDelta;
      this.cue(d, 'bedtime', this.bedAt);
    }
  }

  private cue(d: import('@iwsdk/core').Entity, beat: string, t: number): void {
    for (const line of NARRATION) {
      if (line.beat !== beat || t < line.at || this.said.has(line.id)) continue;
      this.said.add(line.id);
      const big = this.queries.bigfoot.entities.values().next().value;
      big?.object3D?.getWorldPosition(this.at);
      this.at.y += 1.5;
      Sound.speak(voiceFileOf(line.id), this.at);
      d.setValue(Caption, 'text', `Bigfoot: ${line.text}`);
      d.setValue(Caption, 'ttl', Math.max(3.5, line.text.split(' ').length * 0.42));
    }
  }
}
