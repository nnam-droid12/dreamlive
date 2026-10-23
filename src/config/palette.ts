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
  paper: 0xf3ecdf,
  paperShade: 0xc9c0b3,
  starWhite: 0xfff8e8,
  dreamerFur: 0xece8ff,
  dreamerEye: 0xfdfcff,
  dreamerPupil: 0x1b1840,
  /** Multiplied over passthrough during the dream to dim the room. */
  nightTint: 0x0d0b26,
} as const;

export type PaletteKey = keyof typeof Palette;
