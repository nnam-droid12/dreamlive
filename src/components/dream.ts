import { createComponent, Types } from '@iwsdk/core';

/** Session-wide dream timeline state (lives on the director entity). */
export const DreamDirector = createComponent('DreamDirector', {
  chapterId: { type: Types.String, default: '' },
  beatId: { type: Types.String, default: '' },
  beatTime: { type: Types.Float32, default: 0 },
  /** Total dream seconds (frozen while the headset is off). */
  dreamClock: { type: Types.Float32, default: 0 },
  /** Seconds the user has looked at no seed during the current choice. */
  idleGaze: { type: Types.Float32, default: 0 },
  /** Seed that decided the last choice and how ('gaze' | 'pinch' | 'leanBack'). */
  lastChoice: { type: Types.String, default: '' },
  lastChoiceBy: { type: Types.String, default: '' },
  /** Every choice this dream, "seed:how" comma-separated, in order. */
  choices: { type: Types.String, default: '' },
  /** Things caught from the TV this dream. */
  catches: { type: Types.Int16, default: 0 },
  started: { type: Types.Boolean, default: false },
  completed: { type: Types.Boolean, default: false },
  /** One-shot event from a set piece (e.g. 'hush'); ends a beat whose endOn matches. */
  signal: { type: Types.String, default: '' },
});

/** Developer controls (testing and the Director-mode recording flag). */
export const DevControls = createComponent('DevControls', {
  /** Multiplies ritual and dream time. 1 in normal play. */
  timeScale: { type: Types.Float32, default: 1 },
});

export const GazeMode = { None: 'none', Eye: 'eye', Head: 'head' } as const;

/** The attention ray this frame (world space), written by AttentionSystem. */
export const GazeRay = createComponent('GazeRay', {
  mode: { type: Types.Enum, enum: GazeMode, default: GazeMode.None },
  origin: { type: Types.Vec3, default: [0, 0, 0] },
  direction: { type: Types.Vec3, default: [0, 0, -1] },
});

/** Something attention can rest on. */
export const GazeTarget = createComponent('GazeTarget', {
  /** Visual radius (m); widens the angular hit cone for near/large targets. */
  radius: { type: Types.Float32, default: 0.03 },
  focused: { type: Types.Boolean, default: false },
  /** Angle between the gaze ray and the target center, degrees. */
  angleDeg: { type: Types.Float32, default: 180 },
  worldPos: { type: Types.Vec3, default: [0, 0, 0] },
});

export const SeedState = {
  Appearing: 'appearing',
  Idle: 'idle',
  Blooming: 'blooming',
  Fading: 'fading',
} as const;

/** A branch-point object. Dwell (0..1) fills while focused and drains slowly. */
export const DreamSeed = createComponent('DreamSeed', {
  seedId: { type: Types.String, default: '' },
  branch: { type: Types.String, default: '' },
  dwell: { type: Types.Float32, default: 0 },
  lookTotal: { type: Types.Float32, default: 0 },
  state: { type: Types.Enum, enum: SeedState, default: SeedState.Appearing },
  stateTime: { type: Types.Float32, default: 0 },
  /** Beat this seed belongs to; it fades once the dream moves on. */
  beatId: { type: Types.String, default: '' },
  /** How it bloomed: 'gaze' | 'pinch' | 'leanBack'. */
  bloomedBy: { type: Types.String, default: '' },
  /** Its act opens on a later night: shown dim, can't be chosen. */
  locked: { type: Types.Boolean, default: false },
});
