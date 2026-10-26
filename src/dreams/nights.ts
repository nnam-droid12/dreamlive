import type { BigfootAnim } from '../characters/bigfoot.js';

/**
 * Every real night is a different dream night: the TV worlds change sky and
 * mood, Bigfoot has new moves, and the golden-memory goal rises. The table
 * cycles after the last entry. Night 1 = the first visit's calendar date.
 */
export interface DreamNight {
  title: string;
  /** Sky gradient [top, bottom] per TV world; worlds not listed keep their own. */
  sky: Partial<Record<'intro' | 'surf' | 'dj' | 'ski', [string, string]>>;
  /** Bigfoot's move per act; acts not listed keep the world's default. */
  moves: Partial<Record<'surf' | 'dj' | 'ski', BigfootAnim>>;
  /** Catches during the dream that turn the night's memory orb gold. */
  goldGoal: number;
}

export const DREAM_NIGHTS: readonly DreamNight[] = [
  { title: 'First Dream', sky: {}, moves: {}, goldGoal: 3 },
  {
    title: 'Sunset Dream',
    sky: { intro: ['#2b1a3f', '#ff9a6b'], surf: ['#ff8a5c', '#ffd29a'], dj: ['#3a1240', '#ff6f61'], ski: ['#ff9e7a', '#ffe0c0'] },
    moves: { dj: 'dance2', surf: 'cheer' },
    goldGoal: 3,
  },
  {
    title: 'Aurora Dream',
    sky: { intro: ['#04131f', '#1f8f7a'], surf: ['#061a2b', '#2fbf9f'], dj: ['#071d2a', '#27d6a0'], ski: ['#061a2b', '#3fe0b0'] },
    moves: { ski: 'leap', dj: 'dance' },
    goldGoal: 4,
  },
  {
    title: 'Pink Moon',
    sky: { intro: ['#2a0f2f', '#ff8fc7'], surf: ['#3a1440', '#ff9fd0'], dj: ['#2a0f2f', '#ff5fa8'], ski: ['#3a1440', '#ffc0e0'] },
    moves: { surf: 'leap', dj: 'dance2' },
    goldGoal: 4,
  },
  {
    title: 'Thunder Party',
    sky: { intro: ['#0d0b1f', '#5a3dbd'], surf: ['#0d0b1f', '#3d4fbd'], dj: ['#0d0b1f', '#7a3dbd'], ski: ['#0d0b1f', '#4d6dcd'] },
    moves: { dj: 'leap', ski: 'cheer' },
    goldGoal: 5,
  },
  {
    title: 'Golden Morning',
    sky: { intro: ['#ffb84d', '#fff3d1'], surf: ['#6ec6ff', '#fff3d1'], dj: ['#ff9f43', '#ffe8b0'], ski: ['#8fd3ff', '#ffffff'] },
    moves: { surf: 'cheer', dj: 'dance2', ski: 'leap' },
    goldGoal: 5,
  },
  {
    title: 'Starfall',
    sky: { intro: ['#000814', '#1d3557'], surf: ['#000814', '#274c77'], dj: ['#000814', '#3a0ca3'], ski: ['#000814', '#1d3557'] },
    moves: { surf: 'leap', dj: 'dance', ski: 'cheer' },
    goldGoal: 6,
  },
];

export const dreamNight = (night: number): DreamNight =>
  DREAM_NIGHTS[(Math.max(1, Math.floor(night)) - 1) % DREAM_NIGHTS.length];
