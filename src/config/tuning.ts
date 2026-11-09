/**
 * Every tunable number in Dreamlive lives here: timings, thresholds, sizes.
 * Units: seconds, meters, degrees unless a name says otherwise.
 */
import { Palette } from './palette.js';

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
    /** How much lighter the sleep vignette gets at golden hour or sunrise (0.85 = 85% lighter). */
    vignetteDayCut: 0.85,
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

  city: {
    /** Traffic lanes in the window frame (m): cross streets past both towers' ends, the avenue beyond the party tower. */
    lanes: [
      { axis: 'x', at: 10.2, dir: 1, from: -40, to: 70 },
      { axis: 'x', at: 12.4, dir: -1, from: -40, to: 70 },
      { axis: 'x', at: -9.6, dir: 1, from: -40, to: 70 },
      { axis: 'x', at: -11.8, dir: -1, from: -40, to: 70 },
      { axis: 'z', at: 24.4, dir: 1, from: -60, to: 60 },
      { axis: 'z', at: 26.8, dir: -1, from: -60, to: 60 },
    ] as const,
    carsPerLane: 7,
    carSpeed: 9,
    /** Body tints (multiplied with the car's own colours, so the lights stay bright). */
    carColors: [0xffffff, 0xd8dcea, 0xffe2b8, 0xc4d4ff],
    /** The helicopter circles the party tower: centre (frame x, z), radius, height, speed (rad/s). */
    heli: { x: 15, z: 0.5, radius: 24, height: 30, speed: 0.12 },
    /** Birds at sunrise: how many, and the line the flock flies along (frame m) and how long it takes. */
    birds: 11,
    flock: { from: { x: 11, y: 9, z: -35 }, to: { x: 17, y: 14, z: 45 }, sec: 22 },
    /** Finale fireworks: this far into the leap home, and into the gifts. */
    finaleLeapAt: 3.5,
    finaleGiftsAt: 17,
  },

  partyLight: {
    /** Laser beams from the party stage into the room: count, thickness, opacity (+ beat flash). */
    beams: 4,
    beamRadius: 0.012,
    beamOpacity: 0.35,
    beamFlash: 0.5,
    /** Where beams land, in the window frame: this far back into the room, sweeping this wide, this fast. */
    reachBack: -6.6,
    sweepWidth: 2.6,
    sweepSpeed: 0.55,
    /** Showcase room spotlights: strength (+ flash), reach, cone, sweep speed. */
    spotIntensity: 40,
    spotFlash: 70,
    spotRange: 12,
    spotAngle: 0.38,
    spotSpeed: 0.4,
    /** How fast the room lights come up and fade out. */
    fadeRate: 1.2,
  },

  movie: {
    /** The screen: width (m, 16:9), distance in front of the viewer, height of its centre. */
    width: 3,
    distance: 3.4,
    height: 1.7,
    /** The film's light on the room: strength, reach, how far in front of the screen it sits. */
    lightIntensity: 6,
    lightRange: 9,
    lightAhead: 1.2,
    volume: 1,
    /** Bigfoot cheers at these film times (s); he yawns and turns in this long before the end. */
    laughs: [24, 58, 97, 128],
    yawnBeforeEnd: 14,
    /** Where Bigfoot watches from: beside the viewer (m to the left, m forward). */
    beside: 1.3,
    ahead: 0.4,
  },

  clouds: {
    /** The cloud sea: its height below the floor (m) and size. */
    seaY: -9,
    seaRadius: 600,
    /** Distant cumulus towers (billboards) and their distance band (m). */
    puffs: 34,
    puffNear: 45,
    puffFar: 220,
    /** Little clouds drifting through the room that a wave of the hand scatters. */
    roomPuffs: 7,
    roomPuffSize: 0.75,
    /** A hand this close (m) and this fast (m/s) scatters a little cloud; it re-forms after this long (s). */
    waveReach: 0.45,
    waveSpeed: 0.35,
    reformSec: 7,
    /** Bigfoot's balloon: how far beyond the window (m), how far it drifts to each side, basket floor height, seconds per swing, size. */
    balloonOut: 8,
    balloonSwing: 2.2,
    balloonY: -0.6,
    balloonLap: 60,
    balloonScale: 1.0,
    /** Bigfoot (1.6 m) stands on a step in the basket so he shows from the chest up. */
    basketStep: 0.38,
    /** Other balloons far away. */
    farBalloons: 6,
    /** Falling stars you can catch: how many at once, fall speed (m/s), touch reach (m), pause between (s). */
    stars: 2,
    starFall: 0.13,
    starReach: 0.2,
    starGap: 3.5,
    /** Shooting stars streaking high over the clouds (every so many s). */
    streakEvery: 5,
  },

  winter: {
    /** The frozen lake: its centre this far out of the window (m), radius, board height. */
    rinkOut: 11,
    rinkRadius: 7.5,
    boardHeight: 0.5,
    /** String-light posts around the rink, and bulbs per span. */
    posts: 10,
    bulbsPerSpan: 9,
    /** Spruce forest: how many, nearest and furthest (m), share on the window side. */
    pines: 170,
    pineNear: 26,
    pineFar: 150,
    pineFront: 0.7,
    /** Skaters (party guests) and their lap: radius band (m), seconds per lap. */
    skaters: 6,
    skateRadius: [4.2, 6.6],
    skateLap: 26,
    /** Bigfoot skates an inner circle (m), seconds per lap. */
    bigfootRadius: 3.1,
    bigfootLap: 20,
    /** Snowfall: flakes, box around you (m), normal share falling, how long a shake keeps the blizzard (s). */
    flakes: 2600,
    snowBox: { x: 16, y: 9, z: 16 },
    snowBase: 0.3,
    blizzardSec: 8,
    /** A shake: both hands' average speed (m/s) held this long (s). */
    shakeSpeed: 0.9,
    shakeHold: 0.35,
    /** Lights: moonlight, sky fill, the fire's glow (and its reach), the tree's glow. */
    moon: 0.9,
    skyFill: 0.55,
    fire: 2.4,
    fireRange: 6,
  },

  photo: {
    /** The finger frame: each hand's thumb-index gap, how far ahead of the eyes, the rectangle's limits (m). */
    openMin: 0.05,
    /** Each L's index tip must sit at least this far above (one hand) or below (the other) its thumb tip. */
    minLift: 0.03,
    minReach: 0.18,
    minWidth: 0.12,
    maxWidth: 0.75,
    minHeight: 0.06,
    /** Hold the frame this long to take the photo; Bigfoot starts posing after this long; then a cooldown. */
    holdSec: 0.7,
    poseAfter: 0.2,
    poseSec: 2.5,
    cooldownSec: 2.5,
    /** The picture: width in px and aspect; the print's width (m); pop, show and fly-to-gallery timings; flash. */
    px: 512,
    aspect: 4 / 3,
    printWidth: 0.2,
    popSec: 0.35,
    showSec: 2.6,
    flySec: 1.6,
    flashSec: 0.35,
    /** The gallery above the TV: how many prints, spacing, height above the TV's centre. */
    gallery: 4,
    gallerySpacing: 0.26,
    galleryUp: 0.95,
  },

  visualizer: {
    /** Music motes: how many, the box around the viewer they fill (m), how far the viewer moves before it re-centres, overall opacity. */
    count: 260,
    box: { x: 6, y: 3, z: 6 },
    recenter: 3,
    opacity: 0.9,
    /** Per-scene looks (colours from Palette): drift (m), wander speed, rise (m/s), size, bass/kick response, twinkle. */
    styles: {
      bedroom: { colorA: Palette.motesBedroomA, colorB: Palette.motesBedroomB, drift: 0.35, speed: 0.12, rise: 0.03, size: 22, bassSize: 1.2, kickJump: 0, twinkle: 0.8 },
      leap: { colorA: Palette.motesLeapA, colorB: Palette.motesLeapB, drift: 0.1, speed: 0.3, rise: 1.4, size: 18, bassSize: 0.8, kickJump: 0, twinkle: 0.3 },
      gifts: { colorA: Palette.motesGiftsA, colorB: Palette.motesGiftsB, drift: 0.25, speed: 0.35, rise: 0.05, size: 21, bassSize: 1.6, kickJump: 0.35, twinkle: 0.6 },
      ending: { colorA: Palette.motesEndingA, colorB: Palette.motesEndingB, drift: 0.5, speed: 0.08, rise: 0.02, size: 21, bassSize: 1, kickJump: 0, twinkle: 0.9 },
      bedtime: { colorA: Palette.motesBedtimeA, colorB: Palette.motesBedtimeB, drift: 0.45, speed: 0.06, rise: -0.01, size: 17, bassSize: 0.8, kickJump: 0, twinkle: 1 },
    },
  },

  cinema: {
    /** The floating screen: width (m), and where it floats in rig space (front-left of the viewer). */
    // About 20 degrees left of straight ahead: fully inside Meta VR Glasses' narrower view too.
    width: 1.6,
    x: -0.95,
    y: 1.78,
    z: -2.6,
    /** The live picture: texture size, refresh every N frames, field of view, seconds per shot. */
    texWidth: 640,
    texHeight: 360,
    every: 3,
    fov: 40,
    shotSec: 4.5,
  },

  film: {
    /** Title and chapter cards: distance in front of the viewer, how long they show, fade in/out. */
    distance: 2.4,
    titleSec: 6,
    chapterSec: 5,
    fadeSec: 0.8,
    /** End credits: start this long after waking, roll for this long, showing this share of the roll at once. */
    creditsAt: 3,
    creditsSec: 30,
    creditsWindow: 0.32,
  },

  bedtime: {
    /** After the Rooftop story, bedtime starts by itself this long into being awake (after the credits). */
    autoAfterSec: 36,
    /** Music box level at bedtime; the fade-from-black that hides Bigfoot getting back into bed. */
    music: 0.1,
    fadeSec: 1.6,
    /** Rain-on-glass highlight colour strength comes from Palette.rain. */
  },

  palm: {
    /** Left palm held up this long (right hand not cupping) opens the menu; turned over this long closes it. */
    openHoldSec: 0.35,
    closeHoldSec: 0.7,
    /** The menu floats this far above the palm (hands) or the left controller. */
    above: 0.14,
  },

  fx: {
    /** Fireworks: shells per press, seconds between them, sparks per shell, burst speed, spark life. */
    volley: 4,
    volleyGapSec: 0.45,
    shellSparks: 180,
    shellSpeed: 7,
    shellLife: 2.2,
    shellSize: 0.5,
    /** Where shells burst, in the window frame (m): beyond the party roof, above the city. */
    sky: { x0: 14, x1: 32, y0: 14, y1: 24, z0: -12, z1: 12 },
    /** Confetti near the viewer: pieces, speed, life, piece size. */
    confetti: 140,
    confettiSpeed: 1.3,
    confettiLife: 3.2,
    confettiSize: 0.018,
    /** Weather fills this window-frame box; fade rate; fall speeds; fog density. */
    weatherBox: { x0: 0.5, x1: 34, y0: -6, y1: 22, z0: -16, z1: 18 },
    weatherRate: 0.8,
    rainDrops: 1400,
    snowFlakes: 1600,
    rainSpeed: 11,
    snowSpeed: 0.9,
    fogDensity: 0.045,
  },

  drawWindow: {
    /** With no drawing, the window starts drawing itself after this long, taking this long. */
    autoAfterSec: 9,
    autoDrawSec: 2.5,
    /** The drawn window dissolves open over this long. */
    openSec: 1.4,
    /** The invisible drawing surface over the wall, and the smallest window accepted. */
    padWidth: 3.6,
    padHeight: 2.8,
    minWidth: 0.5,
    minHeight: 0.9,
  },

  transform: {
    /** Without a drawn window, the opening appears this far into his walk to the window. */
    autoHoleAt: 2.5,
    /** Approach rates (per second) for the opening, the wall, the ceiling and the sunrise. */
    holeRate: 1.2,
    wallRate: 0.45,
    ceilingRate: 0.35,
    dawnRate: 0.3,
    /** The ceiling starts opening once the wall is this far gone. */
    ceilingAfter: 0.5,
    /** How far the sky warms while he walks back to bed (sunrise completes on waking). */
    dawnInBed: 0.45,
    /** Golden hour: how fast it changes, how golden the party stays as it ends. */
    duskRate: 0.25,
    duskLateParty: 0.55,
    /** The low sun: degrees left of straight out of the window, and above the horizon. */
    sunAzimuthDeg: 38,
    sunElevationDeg: 6,
    /** Sun and warm fill light at full golden hour (sunrise uses dawnLight). */
    sunIntensity: 3.2,
    fillIntensity: 1.3,
    dawnLight: 0.7,
    /** Showcase room image-based light: night vs golden hour. */
    iblNight: 0.32,
    iblGolden: 1.1,
  },

  tour: {
    /** Viewpoint changes: fade to black, move, fade back in (never a gliding camera). */
    fadeOutSec: 0.45,
    fadeInSec: 0.7,
  },

  rooftop: {
    /** Party energy across the street before Bigfoot arrives (music, lights, crowd). */
    idleEnergy: 0.35,
    /** Real party guests (animated people) on the dance floor, and their size vs. a 1.8 m person. */
    guests: 14,
    guestScale: 1,
    /** How strongly the skyline becomes a music visualizer while the party is live (0..1). */
    visualizer: 0.85,
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
    pileMax: 14,
    /** Size of the gifts the Yeti throws to Bigfoot (1 = a 24 cm box). */
    giftScale: 0.7,
    /** Now and then a goodie flies across into the room to be caught: cadence, flight time, arc. */
    viewerThrowEvery: 3.6,
    viewerFlightSec: 2.8,
    viewerArc: 2.2,
    /** Gifts that fly to the viewer: size (vs. Bigfoot's), how far ahead and how far below the eyes they land. */
    viewerGiftScale: 0.3,
    viewerGiftReach: 0.7,
    viewerGiftDrop: 0.5,
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
