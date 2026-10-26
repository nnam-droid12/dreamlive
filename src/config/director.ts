/**
 * Director mode (development only, `?director`): plays one scripted, smoothly
 * shot dream for the demo video and records the app's own canvas and sound to
 * a WebM download. `&norecord` plays it without recording.
 */
const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const Director = {
  enabled: import.meta.env.DEV && params.has('director'),
  record: import.meta.env.DEV && params.has('director') && !params.has('norecord'),
  /** Seeds the scripted gaze chooses, in order. */
  picks: ['dj', 'ski-2'],
  /** Seconds the end card holds before the recording stops. */
  endCardSec: 7,
  fileName: 'dreamlive-demo.webm',
} as const;
