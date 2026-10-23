import type { ChapterDef } from './types.js';

/**
 * Chapter 1, "The Paper Sea" — branching structure. Phase 2 ships placeholder
 * scenes and short durations; Phase 3 replaces the scene keys with the real
 * sea, boat, lighthouse, fish, storm, star and door, and sets final timings.
 */
export const chapter1PaperSea: ChapterDef = {
  id: 'paper-sea',
  title: 'The Paper Sea',
  start: 'sea-rises',
  beats: {
    'sea-rises': { id: 'sea-rises', duration: 6, scene: 'sea', tint: 'moonBlue', next: 'choice-1' },
    'choice-1': {
      id: 'choice-1',
      duration: 0,
      scene: 'sea',
      tint: 'moonBlue',
      defaultSeed: 'lighthouse',
      seeds: [
        { id: 'lighthouse', branch: 'lighthouse', position: [-0.17, 0.2, -0.12], color: 'lanternAmber', radius: 0.035 },
        { id: 'fish', branch: 'fish', position: [0.17, 0.14, -0.06], color: 'moonBlueSoft', radius: 0.035 },
      ],
    },
    lighthouse: { id: 'lighthouse', duration: 8, scene: 'lighthouse', tint: 'lanternAmber', next: 'storm' },
    fish: { id: 'fish', duration: 8, scene: 'fish', tint: 'moonBlueSoft', next: 'storm' },
    storm: { id: 'storm', duration: 6, scene: 'storm', tint: 'indigo', next: 'choice-2' },
    'choice-2': {
      id: 'choice-2',
      duration: 0,
      scene: 'storm-clears',
      tint: 'indigo',
      defaultSeed: 'star',
      seeds: [
        { id: 'star', branch: 'star', position: [-0.15, 0.26, -0.1], color: 'starWhite', radius: 0.03 },
        { id: 'door', branch: 'door', position: [0.16, 0.18, -0.16], color: 'pinkSoft', radius: 0.035 },
      ],
    },
    star: { id: 'star', duration: 8, scene: 'star', tint: 'starWhite', next: 'island' },
    door: { id: 'door', duration: 8, scene: 'door', tint: 'pinkSoft', next: 'island' },
    island: { id: 'island', duration: 6, scene: 'island', tint: 'lanternGlow' },
  },
};
