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

  tvCartoon: {
    /** How bright the cartoon on the bedroom TV plays (a TV in a dim room, not a lamp). */
    brightness: 0.85,
  },

  movie: {
    /** The screen: width (m, 16:9), distance in front of the viewer, height of its centre. */
    width: 3,
    distance: 3.4,
    height: 1.7,
    /** The film's light on the room: strength, reach, how far in front of the screen it sits. */
    lightIntensity: 2.2,
    lightRange: 5.5,
    lightAhead: 1.2,
    volume: 1,
    /** Bigfoot cheers at these film times (s); he yawns and turns in this long before the end. */
    laughs: [24, 58, 97, 128],
    yawnBeforeEnd: 14,
    /** Where Bigfoot watches from: beside the viewer (m to the left, m forward). */
    beside: 1.3,
    ahead: 0.4,
    /** The loveseat beside you: Bigfoot's seat and the bunny's seat (m to the side), and how far forward. */
    sofaBigfoot: 2.05,
    sofaBunny: 0.95,
    sofaAhead: -0.3,
    /** The cinema: the room's lights during the film (fraction of normal), the soft spot on the loveseat (intensity, cone half-angle rad), and the ceiling fan (turns per second). */
    cinemaLights: 0.1,
    sofaSpot: 6,
    sofaSpotAngle: 0.5,
    fanTurnsPerSec: 2.2,
    /** Seated on the loveseat: how far each one's hip bone sits above the cushion top (m), so thighs rest on it, not in it. */
    bigfootSitPad: 0.24,
    bunnySitPad: 0.09,
    /** The bunny steps out of the film at this film time (s); its size (m), walking speed (m/s). */
    bunnyAt: 5,
    bunnyHeight: 0.8,
    bunnyWalk: 1.0,
    /** Eating: one bite every this many seconds, each this long. */
    biteEvery: 4,
    biteSec: 1.3,
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

  memory: {
    /** The friendship board on the wall (showcase room): position (m) and facing (yaw, rad). */
    board: { x: 2.35, y: 1.62, z: -4.17, yaw: 0 },
    /** Seconds between Bigfoot's two greeting lines when you come back. */
    greetGap: 3.6,
  },

  friend: {
    /** The hangout starts this long after he wakes; he stands this far in front of you and walks at this speed. */
    startAfter: 6,
    distance: 1.05,
    filmDistance: 1.45,
    /** Reach out flat, palm down (to pat his head), and he steps in to this distance (m). */
    closeDistance: 0.7,
    /** ...and in the film, a little further, so his whole head and your hand are in the shot. */
    filmCloseDistance: 0.95,
    walkSpeed: 0.9,
    /** How close your hand must be: a high-five / fist bump held out to him, his head (pat), his belly (tickle), and a touch. */
    reach: 0.95,
    patReach: 0.28,
    /** The top of his head is this far above his head bone (m): where a pat lands. */
    headTop: 0.2,
    tickleReach: 0.36,
    contact: 0.16,
    /** Seconds between moments; the hint card shows this long, and again after this long with nothing happening. */
    cooldown: 0.8,
    hintSec: 7,
    hintAgainSec: 25,
  },

  street: {
    /** Bigfoot's stroll: walking speed (m/s), and when he stops to wave (s). */
    walkSpeed: 2.3,
    waveAt: 6,
    /** His walk clip plays this much faster, to match the brisk stride. */
    walkRate: 1.6,
    /** Yellow cabs on the street and their speed (m/s). */
    taxis: 4,
    taxiSpeed: 7,
  },

  sea: {
    /** Still-water level below the floor (m); the ocean mesh size and detail. */
    seaY: -2.6,
    /** Storm and sunshine: the calmest swell (fraction of the storm's), the sun's height over the sea (deg, from Sun 0 to 1) and bearing from straight out (deg), its light and sky fill. */
    calmAmp: 0.07,
    sunLowDeg: 3,
    sunHighDeg: 15,
    sunAzimuthDeg: -8,
    sunLight: 3,
    sunFill: 0.9,
    /** Bigfoot's rowboat: this far out of the window and along it (m), turned this far from bow-straight-out (deg). */
    boatOut: 4.6,
    boatSide: 0.5,
    boatQuarterDeg: 30,
    /** Bigfoot's hip above the thwart when seated in the boat (m). */
    boatSitPad: 0.16,
    /** The boat's size (1 = 3.6 m long). */
    boatScale: 1.3,
    oceanSize: 520,
    oceanSegments: 200,
    /** Gerstner swells: direction (x, z), steepness (sum under 1), wavelength (m). */
    waves: [
      { dx: 1, dz: 0.2, steep: 0.24, length: 38 },
      { dx: 0.7, dz: 0.7, steep: 0.18, length: 22 },
      { dx: -0.3, dz: 1, steep: 0.14, length: 13 },
      { dx: 0.9, dz: -0.45, steep: 0.1, length: 7.5 },
    ],
    /** Lightning: seconds between strikes (min, max), first strike, how far out (m). */
    strikeGap: [6, 14],
    firstStrike: 4,
    strikeNear: 70,
    strikeFar: 170,
    /** Light: the dim storm light, sky fill, and the flash at a strike. */
    stormLight: 0.25,
    stormFill: 0.35,
    flash: 7,
    /** Bigfoot's surf run: this far out of the window (m), drifting this far either way, seconds per run. */
    surfOut: 7,
    surfSwing: 3.4,
    /** His carving speed (radians of the carve per second): fast at first, easing to slow over surfEase seconds. */
    surfFast: 2.4,
    surfSlow: 0.45,
    surfEase: 7,
    /** Whales: how many, their swim radius band (m), seconds between breaches. */
    whales: 2,
    whaleRadius: [45, 75],
    breachGap: [14, 24],
    breachSec: 4.2,
    /** The lighthouse: how far out and to the side (m), beam turns per minute. */
    lighthouseOut: 110,
    lighthouseSide: 45,
    beamRpm: 6,
    /** Ankle-deep water on the floor: ripples from the rain (per second) and from a hand below this height (m). */
    floodDepth: 0.02,
    rainRipples: 7,
    handDip: 0.6,
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
    x: -0.7,
    y: 2.55,
    z: -2.7,
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
    /** With no drawing, the window starts drawing itself after this long (a few seconds after Bigfoot asks; his line ends at 9 s), taking this long. */
    autoAfterSec: 13,
    autoDrawSec: 2.5,
    /** In the Director's film: the outline grows with the scripted hand's sweep (beat time it starts, how long; matches DRAW in the director). */
    directorDrawAt: 9.3,
    directorDrawSec: 2.8,
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
    /** Whether the DJ also throws gifts to Bigfoot (off: every gift goes to your hands). */
    giftsToBigfoot: false,
    giftFlightSec: 1.9,
    pileMax: 14,
    /** Size of the gifts the Yeti throws to Bigfoot (1 = a 24 cm box). */
    giftScale: 0.7,
    /** Now and then a goodie flies across into the room to be caught: cadence, flight time, arc. */
    viewerThrowEvery: 3.6,
    /** A gift waits this long (s) for your palm before floating down by itself; lower your hand this far below your eyes (m) to set it down; the next comes this long (s) after. */
    giftWaitSec: 6,
    giftSetDown: 0.62,
    giftAfterPlaced: 1.2,
    /** A palm counts as held out for a gift when it faces up at least this much (palm normal's up part, 0..1); a gift this close (m) late in its flight settles into it. */
    giftPalmUp: 0.5,
    giftSettle: 0.3,
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
    /** An orb under your ray (or hand) grows to this scale. */
    hoverScale: 1.2,
    /** Ledge center: this far along the wall from the TV center (negative = left), and this far down. */
    offsetRight: -1.95,
    /** Outside the showcase: the ledge starts this far beyond the TV's left edge. */
    edgeGap: 0.6,
    drop: 0.12,
    /** A pinched orb replays its act on the TV for this long. */
    replaySec: 12,
  },

  /** The garden (a dream world): a mown lawn, distant trees, a picnic blanket, butterflies on your palm. */
  garden: {
    /** Lawn radius (m); one light+dark stripe pair every this many metres x2; the grass relief's tiling. */
    radius: 70,
    stripeTile: 10,
    groundRepeat: 90,
    /** The sky dome's radius (m; beyond the trees and the lawn's edge). */
    skyRadius: 90,
    /** The picnic blanket (m): across, along, and how far ahead of you its centre is (in front of you, all in view). */
    matWidth: 1.4,
    matLength: 1.7,
    matAhead: 1.75,
    /** The film's camera looks toward this point ahead of you (m). */
    bigfootAhead: 2.1,
    /** Summer daylight: the sun and the sky fill. */
    sunLight: 3.0,
    skyLight: 1.5,
    /** Butterflies; an open palm held still this long (s) calls one; it leaves this long after the palm closes or moves. */
    butterflies: 7,
    palmHold: 0.6,
    approachSec: 2.2,
    leaveAfter: 0.5,
    /** A right fingertip this close (m) to the butterfly on your palm sends it away. */
    touchReach: 0.05,
    /** A butterfly on your palm sits this far above its surface (m). */
    perchAbove: 0.03,
    /** The hint for the garden's menu (right palm up) shows after a butterfly leaves, or this long (s) in. */
    menuHintAfter: 25,
  },

  /** Storm and sunshine at sea: the console on your left and the hand gestures. */
  seaConsole: {
    /** The console appears this long after the storm begins (headset). */
    appearAfter: 6,
    /** Where it floats: ahead, to your LEFT, and below your eyes (m); the film's camera sees it a little further off. */
    forward: 0.36,
    left: 0.26,
    below: 0.16,
    filmForward: 0.48,
    filmLeft: 0.24,
    filmBelow: 0.2,
    /** The party console in the film: a little closer than the sea's (m ahead, m left). */
    partyFilmForward: 0.42,
    partyFilmLeft: 0.21,
    /** Pill size and spacing (m). */
    pillW: 0.042,
    pillH: 0.2,
    pillGap: 0.064,
    /** A fingertip within this depth of the console (m) drags the pill it is over. */
    touchDepth: 0.035,
    /** How fast the sea follows a slider (1/s). */
    ease: 2.5,
    /** A raised palm brings the sun on at this rate (per second); seconds between fist thunderbolts. */
    palmSunRate: 0.35,
    thunderCooldown: 1.6,
    /** Goodnight settles the sea over this long, then home to bed this much later (s). */
    settleSec: 4,
    homeAfter: 3,
  },

  /** Proximity passthrough in the fully virtual worlds: the world fades as you move this far (m) from your spot, gone by this far; the same for a hand reaching out from your head; fade speed. */
  proximity: {
    headStart: 0.3,
    headFull: 0.55,
    handStart: 0.62,
    handFull: 0.8,
    fadeRate: 5,
  },

  performance: {
    /** On Quest: ask for this refresh rate (Hz) when the headset offers it; fall back to the steady one if quality has already stepped down this far and it still can't keep up. */
    preferredHz: 90,
    steadyHz: 72,
    fallbackAtLevel: 2,
    /** Fixed foveated rendering strength (0..1): the edges of the view drawn at lower resolution. */
    foveation: 1,
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
