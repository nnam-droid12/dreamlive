import type { ChapterDef } from './types.js';

/** Stage-normalized spots shared by the data and the set pieces. */
export const PaperSeaLayout = {
  lighthouse: [-0.62, -0.78] as const,
  fishRise: [0.5, 0.2] as const,
  island: [0, -0.25] as const,
  lanternHeight: 0.191,
} as const;

/**
 * Chapter 1, "The Paper Sea". The table becomes a moonlit sea; the tiny
 * Dreamer sails a paper boat. Choice 1: the lighthouse light or the big gentle
 * fish. A storm (rain falling upward) can be hushed with a flat palm. Choice 2:
 * a falling star (catch it in cupped hands) or a door on the real wall. Ends on
 * an island of light under a sky of stars. Choice spots never overlap the
 * previous choice's, so lingering eyes don't pick by accident.
 */
export const chapter1PaperSea: ChapterDef = {
  id: 'paper-sea',
  title: 'The Paper Sea',
  start: 'sea-rises',
  beats: {
    'sea-rises': { id: 'sea-rises', duration: 16, scene: 'sea-rise', tint: 'moonBlue', next: 'drift' },
    drift: { id: 'drift', duration: 12, scene: 'drift', tint: 'moonBlue', next: 'choice-1' },
    'choice-1': {
      id: 'choice-1',
      duration: 0,
      scene: 'choice-1',
      tint: 'moonBlue',
      defaultSeed: 'lighthouse',
      seeds: [
        {
          id: 'lighthouse',
          branch: 'lighthouse',
          position: [PaperSeaLayout.lighthouse[0], PaperSeaLayout.lanternHeight, PaperSeaLayout.lighthouse[1]],
          color: 'lanternAmber',
          radius: 0.026,
        },
        {
          id: 'fish',
          branch: 'fish',
          position: [PaperSeaLayout.fishRise[0], 0.03, PaperSeaLayout.fishRise[1]],
          color: 'moonBlueSoft',
          radius: 0.032,
        },
      ],
    },
    lighthouse: { id: 'lighthouse', duration: 42, scene: 'lighthouse', tint: 'lanternAmber', next: 'storm' },
    fish: { id: 'fish', duration: 42, scene: 'fish', tint: 'moonBlueSoft', next: 'storm' },
    storm: { id: 'storm', duration: 20, scene: 'storm', tint: 'indigo', next: 'calm', endOn: 'hush' },
    calm: { id: 'calm', duration: 5, scene: 'calm', tint: 'moonBlue', next: 'choice-2' },
    'choice-2': {
      id: 'choice-2',
      duration: 0,
      scene: 'choice-2',
      tint: 'indigo',
      defaultSeed: 'star',
      seeds: [
        { id: 'star', branch: 'star', position: [0.5, 0.34, 0.05], color: 'starWhite', radius: 0.024, motion: 'fall', catchable: true },
        { id: 'door', branch: 'door', anchor: 'wall', position: [0, -0.07, 0.03], color: 'pinkSoft', radius: 0.06 },
      ],
    },
    star: { id: 'star', duration: 30, scene: 'star', tint: 'starWhite', next: 'island' },
    door: { id: 'door', duration: 30, scene: 'door', tint: 'pinkSoft', next: 'island' },
    island: { id: 'island', duration: 38, scene: 'island', tint: 'lanternGlow' },
  },
};
