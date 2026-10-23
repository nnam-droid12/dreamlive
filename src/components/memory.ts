import { createComponent, Types } from '@iwsdk/core';

/** A kept dream moment. Persisted to the Memory Shelf in Phase 4. */
export const MemoryOrb = createComponent('MemoryOrb', {
  chapterId: { type: Types.String, default: '' },
  momentId: { type: Types.String, default: '' },
  /** ISO timestamp of the night it was kept. */
  createdAt: { type: Types.String, default: '' },
});
