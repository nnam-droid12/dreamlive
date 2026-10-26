import type { ChapterDef, SeedDef } from './types.js';

/**
 * "Bigfoot's Big Dream". Bigfoot sleep-walks off the bed and dives into the TV;
 * his dream plays inside it. Twice, the user's gaze picks the act (surf a wave
 * through New York, DJ a rooftop party, ski down a skyscraper); during each act
 * things fly out of the screen to be caught. Then he climbs back out to bed.
 *
 * Seeds hang 1.2 m in front of the TV (wall anchor), spread wide enough to stay
 * distinct from a seated viewer ~4 m away, and well inside the central FoV cone.
 */
const actSeeds = (suffix: string): SeedDef[] => [
  { id: `surf${suffix}`, branch: `surf${suffix}`, anchor: 'wall', position: [-0.85, -0.12, 1.2], color: 'moonBlue', radius: 0.11, label: 'Surf the city' },
  { id: `dj${suffix}`, branch: `dj${suffix}`, anchor: 'wall', position: [0, 0.38, 1.2], color: 'pinkSoft', radius: 0.11, label: 'Rooftop DJ' },
  { id: `ski${suffix}`, branch: `ski${suffix}`, anchor: 'wall', position: [0.85, -0.12, 1.2], color: 'starWhite', radius: 0.11, label: 'Ski the tower' },
];

export const chapterBigfoot: ChapterDef = {
  id: 'bigfoot-dream',
  title: "Bigfoot's Big Dream",
  start: 'sleepwalk',
  beats: {
    sleepwalk: { id: 'sleepwalk', duration: 13, scene: 'sleepwalk', tint: 'moonBlue', next: 'tv-intro' },
    'tv-intro': { id: 'tv-intro', duration: 5, scene: 'intro', tint: 'moonBlue', next: 'choice-1' },
    'choice-1': { id: 'choice-1', duration: 0, scene: 'intro', tint: 'moonBlue', defaultSeed: 'dj', seeds: actSeeds('') },
    surf: { id: 'surf', duration: 30, scene: 'surf', tint: 'moonBlue', next: 'choice-2' },
    dj: { id: 'dj', duration: 30, scene: 'dj', tint: 'pinkSoft', next: 'choice-2' },
    ski: { id: 'ski', duration: 30, scene: 'ski', tint: 'starWhite', next: 'choice-2' },
    'choice-2': { id: 'choice-2', duration: 0, scene: 'intro', tint: 'moonBlue', defaultSeed: 'surf-2', seeds: actSeeds('-2') },
    'surf-2': { id: 'surf-2', duration: 30, scene: 'surf', tint: 'moonBlue', next: 'finale' },
    'dj-2': { id: 'dj-2', duration: 30, scene: 'dj', tint: 'pinkSoft', next: 'finale' },
    'ski-2': { id: 'ski-2', duration: 30, scene: 'ski', tint: 'starWhite', next: 'finale' },
    finale: { id: 'finale', duration: 14, scene: 'finale', tint: 'lanternGlow' },
  },
};

/** The act a scene/seed id belongs to ('surf' | 'dj' | 'ski'), or ''. */
export const actOf = (id: string): string => id.replace(/-2$/, '');

/**
 * The real night each act opens (night 1 = first visit). All three are open on
 * the first night; each later night is a new dream night instead (nights.ts).
 * Future acts can be listed here with a later night.
 */
export const ACT_NIGHT: Record<string, number> = { surf: 1, dj: 1, ski: 1 };

/** What each kept memory shows when replayed from the shelf. */
export const ACT_TITLE: Record<string, string> = {
  surf: 'Surfing a wave through New York',
  dj: 'DJing a rooftop party',
  ski: 'Skiing down a skyscraper',
};

/** Whether a seed/branch/act is open tonight. */
export const isUnlocked = (id: string, night: number, unlockAll: boolean): boolean =>
  unlockAll || night >= (ACT_NIGHT[actOf(id)] ?? 1);
