import type { PaletteKey } from '../config/palette.js';

/** A gaze-choosable object at a branch point. Positions are stage-local meters
 * (origin = stage center on the table, +Z toward the user, +Y up). */
export interface SeedDef {
  id: string;
  /** Beat id the dream continues with when this seed blooms. */
  branch: string;
  position: readonly [number, number, number];
  color: PaletteKey;
  /** Visual radius in meters; also widens the gaze hit cone. */
  radius: number;
}

export interface BeatDef {
  id: string;
  /** Seconds the beat plays before moving on (ignored while a choice waits). */
  duration: number;
  /** Placeholder/scene key the presentation systems react to. */
  scene: string;
  tint: PaletteKey;
  /** Present on branching beats: 2–3 seeds inside the central FoV cone. */
  seeds?: readonly SeedDef[];
  /** Chosen by the lean-back default when nothing was looked at. */
  defaultSeed?: string;
  /** Next beat for linear beats; omitted on the final beat. */
  next?: string;
}

export interface ChapterDef {
  id: string;
  title: string;
  start: string;
  beats: Readonly<Record<string, BeatDef>>;
}
