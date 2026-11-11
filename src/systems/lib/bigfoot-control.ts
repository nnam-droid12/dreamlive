import { Vector3 } from '@iwsdk/core';

/**
 * What the friend system asks of Bigfoot this frame (BigfootSystem applies it
 * while `active`): where he stands and faces, his move, where he looks, and a
 * hand reaching to an exact point (a high-five or a fist bump).
 */
export const BigfootControl = {
  active: false,
  spot: new Vector3(),
  yaw: 0,
  anim: 'idle',
  looking: false,
  look: new Vector3(),
  reach: { left: false, right: false },
  reachAt: { left: new Vector3(), right: new Vector3() },
  shape: { left: 'palm' as 'palm' | 'fist', right: 'palm' as 'palm' | 'fist' },
  /** Where his hands really are (BigfootSystem writes these every frame), for contact checks. */
  hand: { left: new Vector3(), right: new Vector3() },
  /** Where his head bone really is (BigfootSystem writes it every frame): a pat goes just above it. */
  head: new Vector3(),
  /** A happy little hop, 0..1 (procedural lift, so he stays upright; the jump clip crouches). */
  hop: 0,
  /** Dev: what his rig is actually doing (clip, head height above his feet). */
  info: '',
  /** Seconds since your last hand moment with him (bedtime waits while you are playing). */
  quietFor: 0,
  /** A little shake of the whole body (laughing), 0..1. */
  shake: 0,
};
