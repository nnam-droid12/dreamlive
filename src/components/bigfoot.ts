import { createComponent, Types } from '@iwsdk/core';

export const BigfootState = {
  Sleeping: 'sleeping',
  Sleepwalking: 'sleepwalking',
  InTv: 'inTv',
  /** Out on the neighbouring rooftop (Rooftop Party). */
  Partying: 'partying',
  Returning: 'returning',
  Stretching: 'stretching',
  Awake: 'awake',
} as const;

/** Bigfoot in the room (the one that sleeps on the bed and walks to the TV). */
export const Bigfoot = createComponent('Bigfoot', {
  state: { type: Types.Enum, enum: BigfootState, default: BigfootState.Sleeping },
  stateTime: { type: Types.Float32, default: 0 },
  /** Seconds left of a pose for the camera (a photo is being taken). */
  pose: { type: Types.Float32, default: 0 },
});
