import { chapter1PaperSea } from './chapter1_paperSea.js';
import type { ChapterDef } from './types.js';

/** All dream chapters, in unlock order. */
export const Chapters: readonly ChapterDef[] = [chapter1PaperSea];

export function findChapter(id: string): ChapterDef | undefined {
  return Chapters.find((c) => c.id === id);
}
