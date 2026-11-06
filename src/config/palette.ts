/**
 * Dreamlive "soft-glow paper dream" palette. Every color in the project
 * comes from here (hex numbers, usable directly with Three.js Color).
 */

export const Palette = {
  indigoDeep: 0x1b1840,
  indigo: 0x2e2a6b,
  moonBlue: 0x9fb8ff,
  moonBlueSoft: 0xd4e0ff,
  lanternAmber: 0xffb45e,
  lanternGlow: 0xffd89a,
  pinkSoft: 0xf6a8c8,
  /** Weather: rain streaks, snowflakes, fog. */
  rain: 0xaec4e8,
  snow: 0xf4f8ff,
  fog: 0x39415a,
  /** Landmark towers: deco limestone, gilded crown, supertall glass, lit windows, aircraft beacons. */
  decoStone: 0x8f8678,
  decoGold: 0xffc46b,
  supertallGlass: 0x10182a,
  windowWarm: 0xffd9a0,
  windowCool: 0xcfe4ff,
  beacon: 0xff2a1e,
  /** Sky dome: night, golden sunset (dusk) and sunrise (dawn) gradients, the sun, clouds. */
  skyNightTop: 0x03051a,
  skyNightLow: 0x1c2554,
  skyDuskTop: 0x2b3f8e,
  skyDuskMid: 0xe9808c,
  skyDuskLow: 0xffb758,
  skyDawnTop: 0x3b5ea8,
  skyDawnLow: 0xffa766,
  sunDisc: 0xfff3cf,
  sunGlow: 0xffa45c,
  cloudLit: 0xffc9a8,
  cloudNight: 0x262c48,
  /** Golden-hour light: the low sun, and the warm sky/ground fill. */
  sunLight: 0xffb873,
  duskSkyFill: 0xffe0c2,
  duskGroundFill: 0x5a4436,
  /** Tracked hands: frosted-glass body and glowing outline (Meta system-hand look). */
  handGlass: 0xeaf2ff,
  handOutline: 0xdfeaff,
  paper: 0xf3ecdf,
  paperShade: 0xc9c0b3,
  starWhite: 0xfff8e8,
  dreamerFur: 0xece8ff,
  dreamerEye: 0xfdfcff,
  dreamerPupil: 0x1b1840,
  /** Multiplied over passthrough during the dream to dim the room. */
  nightTint: 0x0d0b26,
  seaDeep: 0x26307a,
  seaShallow: 0x5a73d6,
  /** A dream that opens on a later night. */
  lockedGrey: 0x8a8f99,
  /** Memory Shelf ledge (walnut). */
  shelfWood: 0x5b3b24,
} as const;

export type PaletteKey = keyof typeof Palette;

/** Colour sets for particle effects (palm menu): firework shells and confetti. */
export const PaletteSets = {
  fireworks: [0xff4d6d, 0xffd166, 0x6ee7ff, 0xb388ff, 0x7cff9e, 0xffffff],
  confetti: [0xff6fae, 0xffd27a, 0x8fd3ff, 0xa8ff9e, 0xffffff],
  /** Party crowd outfits (one per dancer, cycling): warm, bright, golden-hour friendly. */
  crowdOutfits: [0xe8b38a, 0x5f8fd6, 0xd65f7a, 0xf2d27a, 0x6fc9a8, 0xb98ae0, 0xf0f0ea, 0x3d3f52, 0xe07a4a],
} as const;
