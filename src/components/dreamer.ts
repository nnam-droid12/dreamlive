import { createComponent, Types } from '@iwsdk/core';

export const DreamerState = {
  Walking: 'walking',
  Yawning: 'yawning',
  Curling: 'curling',
  Sleeping: 'sleeping',
} as const;

export const Dreamer = createComponent('Dreamer', {
  state: { type: Types.Enum, enum: DreamerState, default: DreamerState.Walking },
  stateTime: { type: Types.Float32, default: 0 },
});
