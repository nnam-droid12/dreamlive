import { createComponent, Types } from '@iwsdk/core';

/** The opening ritual, in order. */
export const RitualPhase = {
  /** Waiting for XR; nothing shown. */
  Idle: 'idle',
  /** Caption + palm guide: "Place both hands flat on a table near you." */
  Arrival: 'arrival',
  /** Stage set; starlight rings grow, merge and fade. */
  Rings: 'rings',
  /** The Dreamer walks out, yawns and curls up. */
  DreamerEnter: 'dreamerEnter',
  /** Dreamer asleep; the room dims and stars drift (falling asleep). */
  Asleep: 'asleep',
} as const;

export const Ritual = createComponent('Ritual', {
  phase: { type: Types.Enum, enum: RitualPhase, default: RitualPhase.Idle },
  phaseTime: { type: Types.Float32, default: 0 },
  /** Seconds of visible XR time since the session started. */
  elapsed: { type: Types.Float32, default: 0 },
  /** 0..1 progress of the two-palm hold. */
  holdProgress: { type: Types.Float32, default: 0 },
  leftPalm: { type: Types.Vec3, default: [0, 0, 0] },
  rightPalm: { type: Types.Vec3, default: [0, 0, 0] },
  /** Elapsed time at which the Dreamer fell asleep (-1 = not yet). */
  asleepAt: { type: Types.Float32, default: -1 },
});

/** The single on-screen caption line. Empty text hides it. */
export const Caption = createComponent('Caption', {
  text: { type: Types.String, default: '' },
});
