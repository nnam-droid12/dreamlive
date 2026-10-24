import { chapterBigfoot } from './chapter_bigfoot.js';
import type { ChapterDef } from './types.js';

/** All dream chapters, in unlock order. */
export const Chapters: readonly ChapterDef[] = [chapterBigfoot];

export function findChapter(id: string): ChapterDef | undefined {
  return Chapters.find((c) => c.id === id);
}
