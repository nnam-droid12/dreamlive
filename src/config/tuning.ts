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
    defaultWidth: 0.6,
    defaultDepth: 0.4,
    maxWidth: 0.9,
    maxDepth: 0.6,
    /** Where the auto/air stage sits relative to the head. */
    airForward: 0.45,
    airDrop: 0.45,
    /** Re-scan detected planes this often. */
    roomScanIntervalSec: 0.5,
    maxWallDistance: 4,
  },

  palmCalibration: {
    holdSec: 2,
    /** Hold progress drains this many times slower than it fills (forgiving). */
    decayRatio: 0.5,
    /** Palm normal must be within this angle of straight down. */
    maxPalmTiltDeg: 35,
    /** Both palms must be within this vertical distance of each other. */
    maxHeightDelta: 0.06,
    /** Palm speed below this counts as "still". */
    maxSpeed: 0.08,
    minPalmSpacing: 0.08,
    /** Palms must be at least this far below the eyes (hands raised to the face never tuck in). */
    minDropBelowHead: 0.2,
    maxPalmSpacing: 0.8,
    /** Palm center sits this far above the surface it rests on. */
    palmSurfaceOffset: 0.02,
    /** A detected table within this height of the palms is snapped to. */
    tableSnapTolerance: 0.08,
    /** With no tuck-in by then, the stage is placed automatically. */
    autoTuckInSec: 25,
  },

  ritual: {
    ringGrowSec: 0.9,
    ringMergeSec: 1.0,
    ringFadeSec: 0.8,
    tintFadeSec: 2,
    tintOpacity: 0.42,
    dreamerScale: 1.5,
    dreamerWalkSec: 2.6,
    dreamerWalkDistance: 0.12,
    dreamerYawnSec: 1.8,
    dreamerCurlSec: 1.6,
    zzzIntervalSec: 1.4,
    vignetteFadeSec: 3,
    vignetteOpacity: 0.45,
    starCount: 90,
    /** Where the palm guide floats when no table is detected. */
    guideForward: 0.45,
    guideDrop: 0.4,
    shadowOpacity: 0.35,
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

  dream: {
    /** "Falling asleep" lasts this long before the dream begins. */
    startDelaySec: 10,
    /** A choice never waits longer than this, even if the user keeps glancing. */
    choiceMaxSec: 25,
    /** Dwell drains this many times slower than it fills when you look away. */
    dwellDecayRatio: 0.5,
    seedAppearSec: 0.8,
    seedBloomSec: 0.9,
    seedFadeSec: 0.7,
  },

  performance: {
    targetFps: 72,
    degradeBelowFps: 66,
  },
} as const;
