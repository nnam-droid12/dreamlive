import { createComponent, Types } from '@iwsdk/core';

export const Handedness = { Left: 'left', Right: 'right' } as const;

/** Per-hand pose classification written by GestureSystem. */
export const HandGestureState = createComponent('HandGestureState', {
  hand: { type: Types.Enum, enum: Handedness, default: Handedness.Left },
  tracked: { type: Types.Boolean, default: false },
  /** Palm faces the floor within the tuning tilt limit. */
  palmDown: { type: Types.Boolean, default: false },
  /** Palm speed below the tuning stillness limit. */
  still: { type: Types.Boolean, default: false },
  palmCenter: { type: Types.Vec3, default: [0, 0, 0] },
  /** Unit vector pointing out of the palm. */
  palmNormal: { type: Types.Vec3, default: [0, -1, 0] },
  speed: { type: Types.Float32, default: 0 },
});
