/**
 * Director mode (development only, `?director`): plays one scripted, smoothly
 * shot dream for the demo video. `&norecord` plays it without recording.
 *
 * `&offline` renders the trailer offline: every frame advances the story by
 * exactly 1/fps seconds however long the laptop takes to draw it, each frame is
 * captured on demand, and the sound is mixed afterwards from a logged timeline
 * (scripts/trailer/mix.py), so the result is smooth and in sync on slow hardware.
 * `&w=1280&h=720` sets the render size (before entering XR). The same flags can
 * come from VITE_DIRECTOR (e.g. `director&offline&w=1280&h=720`) in .env.development.local.
 */
// URL flags, or (dev only, for a managed browser that cannot be navigated) VITE_DIRECTOR in .env.development.local.
const search = typeof location === 'undefined' ? '' : location.search;
const params = new URLSearchParams(search.includes('director') ? search : (import.meta.env.VITE_DIRECTOR ?? ''));
const on = import.meta.env.DEV && params.has('director');

export const Director = {
  enabled: on,
  record: on && !params.has('norecord'),
  offline: on && params.has('offline'),
  /** `&tour`: skip the dream and play only the tour after it (for checking those shots). */
  tour: on && params.has('tour'),
  /** `&debug`: print the systems' diagnostics (Session.debug) on the frames, for checking test renders. */
  debug: on && params.has('debug'),
  /**
   * `&skip=2520`: resume a stopped render. The story plays from the start as always (the render is
   * deterministic, one fixed step per frame), but the first N frames are not saved again; numbering continues.
   */
  skip: Number(params.get('skip') ?? 0),
  /** `&only=4-14,76-94`: test renders save only frames in these tour-time windows (s); the story still plays through. */
  only: (params.get('only') ?? '')
    .split(',')
    .map((r) => r.split('-').map(Number))
    .filter((r) => r.length === 2 && r.every((x) => Number.isFinite(x))) as [number, number][],
  fps: 30,
  width: Number(params.get('w') ?? 0),
  height: Number(params.get('h') ?? 0),
  /** Seeds the scripted gaze chooses, in order, per chapter. */
  picks: { 'rooftop-party': ['house'], 'bigfoot-dream': ['dj', 'ski-2'] } as Record<string, readonly string[]>,
  /** Seconds the end card holds before the recording stops. */
  endCardSec: 7,
  fileName: 'dreamlive-demo.webm',
};

/**
 * Shared with other systems while Director mode runs: the offline render loop's
 * after-frame hook, and whether the cinema screen may show in the current shot.
 */
export const DirectorFrame = {
  onFrame: undefined as undefined | (() => void),
  cinema: true,
  offscreen: false,
  /**
   * Offline renders wait while anything is pending: frames still being saved,
   * or a video still seeking to this step's picture. While busy, the story does
   * not advance and no frame is captured (so none is ever dropped or stale).
   */
  busy: 0,
};
