import { createComponent, Types } from '@iwsdk/core';

/** A kept dream moment. Lives on the Memory Shelf and in localStorage (src/memory/store.ts). */
export const MemoryOrb = createComponent('MemoryOrb', {
  chapterId: { type: Types.String, default: '' },
  momentId: { type: Types.String, default: '' },
  /** ISO timestamp of the night it was kept. */
  createdAt: { type: Types.String, default: '' },
  /** Order on the Memory Shelf (oldest lowest); -1 while still floating to it. */
  slot: { type: Types.Int16, default: -1 },
  /** Earned by catching tonight's goal: a golden orb. */
  gold: { type: Types.Boolean, default: false },
});
