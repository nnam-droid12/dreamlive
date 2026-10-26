import type { Entity } from '@iwsdk/core';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Session } from '../components/session.js';
import { findChapter } from './registry.js';

/** The current beat as set pieces see it. */
export interface BeatContext {
  id: string;
  scene: string;
  time: number;
  duration: number;
  /** 0..1 through a timed beat (0 for choice beats). */
  progress: number;
}

/** Fills `out` from the director entity; returns false before the dream starts. */
export function readBeat(d: Entity, out: BeatContext): boolean {
  if (!d.getValue(DreamDirector, 'started')) return false;
  const id = d.getValue(DreamDirector, 'beatId') ?? '';
  const beat = findChapter(d.getValue(DreamDirector, 'chapterId') ?? '')?.beats[id];
  out.id = id;
  out.scene = beat?.scene ?? '';
  out.time = d.getValue(DreamDirector, 'beatTime') ?? 0;
  out.duration = beat?.duration ?? 0;
  out.progress = out.duration > 0 ? Math.min(1, out.time / out.duration) : 0;
  return true;
}

export const newBeatContext = (): BeatContext => ({ id: '', scene: '', time: 0, duration: 0, progress: 0 });

/** 0..1 "pop-up book closing" amount while waking (0 during the dream). */
export function foldAmount(phase: string, phaseTime: number, foldSec: number): number {
  if (phase !== 'waking' && phase !== 'awake') return 0;
  return Math.min(1, phaseTime / foldSec);
}

/**
 * Dream seconds for this frame: real time × the dev time scale, and zero while
 * the pause panel is open. Every system that advances the dream uses this.
 */
export function dreamDelta(d: Entity, realDelta: number): number {
  if (d.hasComponent(Session) && d.getValue(Session, 'paused')) return 0;
  return realDelta * (d.hasComponent(DevControls) ? (d.getValue(DevControls, 'timeScale') ?? 1) : 1);
}
