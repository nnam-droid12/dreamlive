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
    /** Hands untracked this long during the dream before the notice shows. */
    handsLostNoticeSec: 3,
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
    backdropDistance: 2.2,
    defaultWidth: 0.6,
    defaultDepth: 0.4,
    maxWidth: 0.9,
    maxDepth: 0.6,
    /** Where the auto/air stage sits relative to the head. */
    airForward: 0.45,
    airDrop: 0.45,
    /** Re-scan detected planes this often. */
    roomScanIntervalSec: 0.5,
    maxWallDistance: 5,
    /** Seconds into arrival to wait for detected planes before falling back. */
    anchorWaitSec: 2.5,
    /** Picture width when the TV hangs on the floating backdrop (fits the 60° cone). */
    backdropTvWidth: 1.4,
    /** Headset: the dream window opens this far beyond the TV's right edge. */
    dreamWindowGap: 0.9,
    /** A labeled bed/couch this far away (horizontal) or less can be Bigfoot's bed. */
    maxRestDistance: 4.5,
    /** Seat/top heights that count as a bed or couch surface. */
    restMinHeight: 0.25,
    restMaxHeight: 0.9,
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
    /** A palm hovering this high above the stage counts as hushing. */
    hushMinHeight: 0.04,
    hushMaxHeight: 0.4,
    /** Palm-up tilt allowance for cupping. */
    cupMaxTiltDeg: 50,
    /** Two cupped palms must be closer than this. */
    cupMaxSpacing: 0.22,
    /** A cup this close (horizontally) to a falling star catches it. */
    catchRadius: 0.25,
    /** Palm-out "stop" pose (opens the pause panel): held still this long. */
    palmOutHoldSec: 1.2,
    /** Palm must face away from the user within this angle of the view direction. */
    palmOutMaxAngleDeg: 35,
    /** ...and be at least this far in front of the head (an outstretched arm). */
    palmOutMinReach: 0.25,
    palmOutMaxSpeed: 0.25,
    /** Palm raised to face height (relative to the eyes), so waiting to catch never pauses. */
    palmOutMinHeight: -0.12,
    pinchStartDistance: 0.02,
    pinchEndDistance: 0.035,
    /** Ignore a repeat of the same gesture inside this window. */
    cooldownSec: 0.8,
  },

  chapter: {
    stormAutoPassSec: 20,
    targetDreamLengthSec: 345,
  },

  waking: {
    /** Set pieces fold flat into the table like a closing pop-up book. */
    foldSec: 4,
    stirSec: 2.5,
    stretchSec: 2,
    orbRiseSec: 3,
    /** Seconds after the orb arrives before the session counts as awake. */
    settleSec: 2,
  },

  dream: {
    /** "Falling asleep" lasts this long before the dream begins. */
    startDelaySec: 4,
    /** A choice never waits longer than this, even if the user keeps glancing. */
    choiceMaxSec: 25,
    /** Dwell drains this many times slower than it fills when you look away. */
    dwellDecayRatio: 0.5,
    seedAppearSec: 0.8,
    seedBloomSec: 0.9,
    seedFadeSec: 0.7,
  },

  spill: {
    /** Act progress (0..1) over which the room effects fade in, and out. */
    rampIn: [0.05, 0.16] as const,
    rampOut: [0.86, 0.97] as const,
    /** Effects reach this strength during a memory replay. */
    replayLevel: 0.6,
    /** Strength under reduced motion. */
    calmLevel: 0.35,
    fadeRate: 2,
    sprayCount: 700,
    confettiCount: 500,
    snowCount: 900,
    bpm: 120,
    beamLength: 6,
    beamRadius: 0.7,
    lightIntensity: 2.4,
    lightDistance: 10,
  },

  tour: {
    /** Viewpoint changes: fade to black, move, fade back in (never a gliding camera). */
    fadeOutSec: 0.45,
    fadeInSec: 0.7,
  },

  rooftop: {
    /** Party energy across the street before Bigfoot arrives (music, lights, crowd). */
    idleEnergy: 0.35,
    /** He throws a goodie every this many seconds while DJing; it leaves his hand this late in the throw. */
    throwEvery: 1.8,
    throwRelease: 0.3,
    /** Seconds of the thrown arc, then the parachute's sink rate (m/s) to the street. */
    throwSec: 1.6,
    fallSpeed: 3.2,
    streetPool: 14,
    /** Back home, the Yeti DJ throws Bigfoot a gift this often; it flies this long; his pile is capped. */
    giftEvery: 3.4,
    giftFlightSec: 1.9,
    pileMax: 27,
    /** Now and then a goodie flies across into the room to be caught: cadence, flight time, arc. */
    viewerThrowEvery: 3.6,
    viewerFlightSec: 2.8,
    viewerArc: 2.2,
  },

  memoryShelf: {
    /** Orbs shown on the ledge (newest kept; storage keeps more). */
    capacity: 7,
    spacing: 0.125,
    /** Ledge center: this far along the wall from the TV center (negative = left), and this far down. */
    offsetRight: -1.95,
    /** Outside the showcase: the ledge starts this far beyond the TV's left edge. */
    edgeGap: 0.6,
    drop: 0.12,
    /** A pinched orb replays its act on the TV for this long. */
    replaySec: 12,
  },

  performance: {
    targetFps: 72,
    degradeBelowFps: 66,
    /** Seconds below the floor before stepping quality down; seconds of headroom before stepping up. */
    degradeAfterSec: 3,
    upgradeAfterSec: 20,
    /** TV picture resolution at full and reduced quality. */
    tvFull: [1024, 576] as const,
    tvReduced: [512, 288] as const,
  },
} as const;
