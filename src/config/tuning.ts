/**
 * Every tunable number in Dreamlive lives here: timings, thresholds, sizes.
 * Units: seconds, meters, degrees unless a name says otherwise.
 */

export const Tuning = {
  session: {
    /** Cold start → Dreamer asleep must stay under this. */
    firstMagicBudgetSec: 45,
    /** Fade-in after the headset is put back on. */
    resumeFadeSec: 1,
  },

  fov: {
    /** Essential content must sit inside this full cone angle. */
    essentialConeDeg: 60,
    /** Captions sit this far below the view center. */
    captionDropDeg: 12,
    captionDistance: 0.9,
  },

  stage: {
    /** Plausible seated table height range above the floor. */
    tableMinHeight: 0.4,
    tableMaxHeight: 1.1,
    /** Horizontal reach from the head that counts as "within arm's length". */
    maxReach: 0.75,
    /** Smallest usable stage; below this the stage extends into the air. */
    minWidth: 0.4,
    minDepth: 0.3,
    /** Floating paper backdrop distance when no wall is detected. */
    backdropDistance: 1.2,
  },

  palmCalibration: {
    holdSec: 2,
    /** Palm normal must be within this angle of straight down. */
    maxPalmTiltDeg: 35,
    /** Both palms must be within this vertical distance of each other. */
    maxHeightDelta: 0.06,
    /** Palm speed below this counts as "still". */
    maxSpeed: 0.08,
  },

  gaze: {
    dwellSec: 1.5,
    /** Look-at-nothing timeout before the lean-back default picks a seed. */
    leanBackTimeoutSec: 8,
    /** Angular radius around a seed that counts as looking at it. */
    seedHitAngleDeg: 7,
    /** Reticle shows only when the gaze is this close to a seed. */
    reticleShowAngleDeg: 15,
  },

  gestures: {
    hushHoldSec: 1,
    palmOutHoldSec: 1,
    pinchStartDistance: 0.02,
    pinchEndDistance: 0.035,
    /** Ignore a repeat of the same gesture inside this window. */
    cooldownSec: 0.8,
  },

  chapter: {
    stormAutoPassSec: 20,
    targetDreamLengthSec: 345,
  },

  performance: {
    targetFps: 72,
    degradeBelowFps: 66,
  },
} as const;
