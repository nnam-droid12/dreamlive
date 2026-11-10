import { Quaternion, Vector3 } from '@iwsdk/core';

/**
 * Director films: where the Director placed each emulated hand (rig space), so
 * systems that run before it in the frame read this frame's hands, not the
 * emulator's resting pose. Unused (`on` false) outside Director films.
 */
export const FilmHands = {
  on: false,
  left: { p: new Vector3(), q: new Quaternion() },
  right: { p: new Vector3(), q: new Quaternion() },
};
