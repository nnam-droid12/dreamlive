import { createComponent, Types } from '@iwsdk/core';

/** Session-wide state that outlives one dream: pause, unlocks, the shelf and replays. */
export const Session = createComponent('Session', {
  /** Pause panel open: dream time, animation and audio are frozen. */
  paused: { type: Types.Boolean, default: false },
  /** "Judges & demo: unlock all dreams". */
  unlockAll: { type: Types.Boolean, default: false },
  /** Accessibility: opaque, larger, high-contrast captions. */
  highContrast: { type: Types.Boolean, default: false },
  /** Accessibility: no parallax or flashes, calmer room effects, slower catchables. */
  reducedMotion: { type: Types.Boolean, default: false },
  /** Real nights since the first visit, 1-based (local calendar dates). */
  night: { type: Types.Int16, default: 1 },
  /** Bumped by "Restart dream"; systems with private dream state reset on change. */
  generation: { type: Types.Int16, default: 0 },
  /** Act whose memory is replaying on the TV ('' = none). */
  replay: { type: Types.String, default: '' },
  replayTime: { type: Types.Float32, default: 0 },
  /** Memory Shelf built; `shelfNext` is where the next orb lands. */
  shelfReady: { type: Types.Boolean, default: false },
  shelfNext: { type: Types.Vec3, default: [0, 0, 0] },
  /** Slot number the next orb to land takes (one past the newest on the shelf). */
  shelfNextSlot: { type: Types.Int16, default: 0 },
  /** Adaptive quality level, 0 = full (QualitySystem). */
  quality: { type: Types.Int8, default: 0 },
  /** Smoothed measured frame rate. */
  fps: { type: Types.Float32, default: 0 },
  /** The palm menu: the song the user chose ('' = the story's), weather, manual time of night. */
  djSong: { type: Types.String, default: '' },
  weather: { type: Types.String, default: 'clear' },
  dawnOverride: { type: Types.Float32, default: -1 },
  /** Bedtime mode after the story: night, rain on the glass, Bigfoot asleep and snoring. */
  bedtime: { type: Types.Boolean, default: false },
  /** Bumped to fire a burst (confetti, fireworks); FX systems react to changes. */
  confettiShots: { type: Types.Int16, default: 0 },
  fireworkShots: { type: Types.Int16, default: 0 },
  /** Seconds left of the fade-in after the headset comes back or the pause ends. */
  fadeIn: { type: Types.Float32, default: 0 },
});
