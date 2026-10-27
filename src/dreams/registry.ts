import { chapterBigfoot } from './chapter_bigfoot.js';
import { chapterRooftop } from './chapter_rooftop.js';
import type { ChapterDef } from './types.js';

/** All dream chapters: the Rooftop Party (main event) and the TV dream (the extra). */
export const Chapters: readonly ChapterDef[] = [chapterRooftop, chapterBigfoot];

/** Odd nights play the Rooftop Party, even nights the TV dream; with unlock-all, Restart alternates. */
export function chooseChapter(night: number, unlockAll: boolean, generation: number): ChapterDef {
  const i = (Math.max(1, night) - 1 + (unlockAll ? generation : 0)) % Chapters.length;
  return Chapters[i];
}

export function findChapter(id: string): ChapterDef | undefined {
  return Chapters.find((c) => c.id === id);
}
