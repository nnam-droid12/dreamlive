import type { ChapterDef, SeedDef } from './types.js';

/**
 * "Bigfoot's Rooftop Party" (the main event). Bigfoot slides the bedroom glass
 * open, leaps across the street to the neighbouring rooftop where a DJ party is
 * on, takes over the decks and throws goodies down to the street (a few fly into
 * the room to be caught). Twice the user's gaze picks the song. Then he leaps
 * back and goes to bed. Seeds hang just inside the window bay, facing the viewer.
 */
const songSeeds = (suffix: string): SeedDef[] => [
  { id: `disco${suffix}`, branch: `disco${suffix}`, anchor: 'window', position: [-0.75, -0.1, 1.2], color: 'pinkSoft', radius: 0.11, label: 'Disco' },
  { id: `afro${suffix}`, branch: `afro${suffix}`, anchor: 'window', position: [0, 0.35, 1.2], color: 'lanternAmber', radius: 0.11, label: 'Afrobeats' },
  { id: `house${suffix}`, branch: `house${suffix}`, anchor: 'window', position: [0.75, -0.1, 1.2], color: 'moonBlue', radius: 0.11, label: 'House' },
];
const party = (id: string, next: string) => ({ id, duration: 26, scene: `party-${id.replace(/-2$/, '')}`, tint: 'pinkSoft' as const, next });

export const chapterRooftop: ChapterDef = {
  id: 'rooftop-party',
  title: "Bigfoot's Rooftop Party",
  start: 'to-window',
  beats: {
    'to-window': { id: 'to-window', duration: 9, scene: 'to-window', tint: 'moonBlue', next: 'leap-out' },
    'leap-out': { id: 'leap-out', duration: 4, scene: 'leap-out', tint: 'moonBlue', next: 'arrive' },
    arrive: { id: 'arrive', duration: 4, scene: 'arrive', tint: 'pinkSoft', next: 'choice-1' },
    'choice-1': { id: 'choice-1', duration: 0, scene: 'party-wait', tint: 'pinkSoft', defaultSeed: 'afro', seeds: songSeeds('') },
    disco: party('disco', 'choice-2'),
    afro: party('afro', 'choice-2'),
    house: party('house', 'choice-2'),
    'choice-2': { id: 'choice-2', duration: 0, scene: 'party-wait', tint: 'pinkSoft', defaultSeed: 'disco-2', seeds: songSeeds('-2') },
    'disco-2': party('disco-2', 'leap-back'),
    'afro-2': party('afro-2', 'leap-back'),
    'house-2': party('house-2', 'leap-back'),
    'leap-back': { id: 'leap-back', duration: 5, scene: 'leap-back', tint: 'moonBlue', next: 'to-bed' },
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
