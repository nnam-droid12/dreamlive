import type { ChapterDef, SeedDef } from './types.js';

/**
 * "Bigfoot's Rooftop Party" (the main event). Bigfoot slides his bedroom glass
 * open and leaps up onto the roof of the taller skyscraper opposite, where his
 * Yeti cousin is DJing a party. He dances with the crowd (the user's gaze picks
 * the song), leaps back down home, then catches the gifts the DJ throws across
 * and stacks them on his floor (a few come to the user to catch).
 * The song lights hang in front of the viewer, wherever the tour has taken them.
 */
const songSeeds = (suffix: string): SeedDef[] => [
  { id: `disco${suffix}`, branch: `disco${suffix}`, anchor: 'view', position: [-0.55, -0.1, 0], color: 'pinkSoft', radius: 0.09, label: 'Disco' },
  { id: `afro${suffix}`, branch: `afro${suffix}`, anchor: 'view', position: [0, 0.22, 0], color: 'lanternAmber', radius: 0.09, label: 'Afrobeats' },
  { id: `house${suffix}`, branch: `house${suffix}`, anchor: 'view', position: [0.55, -0.1, 0], color: 'moonBlue', radius: 0.09, label: 'House' },
];
const party = (id: string) => ({ id, duration: 24, scene: `party-${id}`, tint: 'pinkSoft' as const, next: 'leap-back' });

export const chapterRooftop: ChapterDef = {
  id: 'rooftop-party',
  title: "Bigfoot's Rooftop Party",
  start: 'draw-window',
  beats: {
    // The user draws Bigfoot's window on the wall (or, with no input, it draws itself).
    'draw-window': { id: 'draw-window', duration: 14, scene: 'draw-window', tint: 'moonBlue', endOn: 'window-drawn', next: 'to-window' },
    'to-window': { id: 'to-window', duration: 9, scene: 'to-window', tint: 'moonBlue', next: 'leap-out' },
    'leap-out': { id: 'leap-out', duration: 4.6, scene: 'leap-out', tint: 'moonBlue', next: 'arrive' },
    arrive: { id: 'arrive', duration: 4, scene: 'arrive', tint: 'pinkSoft', next: 'choice-1' },
    'choice-1': { id: 'choice-1', duration: 0, scene: 'party-wait', tint: 'pinkSoft', defaultSeed: 'afro', seeds: songSeeds('') },
    disco: party('disco'),
    afro: party('afro'),
    house: party('house'),
    'leap-back': { id: 'leap-back', duration: 6.4, scene: 'leap-back', tint: 'moonBlue', next: 'gifts' },
    gifts: { id: 'gifts', duration: 22, scene: 'gifts', tint: 'lanternGlow', next: 'to-bed' },
    'to-bed': { id: 'to-bed', duration: 9, scene: 'to-bed', tint: 'lanternGlow' },
  },
};

/** The song a party scene or seed belongs to ('disco' | 'afro' | 'house'), or ''. */
export const songOf = (id: string): string => id.replace(/^party-/, '').replace(/-2$/, '');

/** Light palette per song (lasers, dance floor, party light). */
export const SONG_PALETTE: Record<string, readonly number[]> = {
  disco: [0xff5fb8, 0xffd27a, 0xb38bff, 0x35e0ff],
  afro: [0xffb45e, 0xff6a3d, 0x3dd68c, 0xffd27a],
  house: [0x35e0ff, 0x3d7bff, 0xb38bff, 0xffffff],
};

export const SONG_TITLE: Record<string, string> = {
  disco: 'a disco party on the rooftop',
  afro: 'an Afrobeats party on the rooftop',
  house: 'a house party on the rooftop',
};
