import type { PaletteKey } from '../config/palette.js';

/** A gaze-choosable object at a branch point. */
export interface SeedDef {
  id: string;
  /** Beat id the dream continues with when this seed blooms. */
  branch: string;
  /** 'stage' (default): [u, y, v] — u, v in -1..1 of the stage half-size, y meters
   * above the table; +v is toward the user. 'wall': [right, up, out] meters from
   * the wall anchor (real wall ahead, or the paper backdrop). */
  anchor?: 'stage' | 'wall';
  position: readonly [number, number, number];
  /** 'fall': drifts slowly down toward the table while the choice waits. */
  motion?: 'fall';
  /** Cupped hands beneath it catch it (blooms with 'catch'). */
  catchable?: boolean;
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
  /** A set-piece signal (e.g. 'hush') that ends this beat early. */
  endOn?: string;
}

export interface ChapterDef {
  id: string;
  title: string;
  start: string;
  beats: Readonly<Record<string, BeatDef>>;
}
