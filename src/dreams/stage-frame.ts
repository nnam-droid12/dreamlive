import { Vector3 } from '@iwsdk/core';
import type { SeedDef } from './types.js';

const UP = new Vector3(0, 1, 0);
const right = new Vector3();

/** Stage-local position of a stage-anchored seed: u, v scale with the stage size. */
export function stageLocal(seed: SeedDef, width: number, depth: number, out: Vector3): Vector3 {
  return out.set((seed.position[0] * width) / 2, seed.position[1], (seed.position[2] * depth) / 2);
}

/** World position of a wall-anchored seed: [meters right, meters up, meters out]. */
export function wallWorld(
  seed: SeedDef,
  anchor: ArrayLike<number>,
  normal: ArrayLike<number>,
  out: Vector3,
): Vector3 {
  const n = out.set(normal[0], normal[1], normal[2]);
  right.crossVectors(UP, n).normalize();
  return out
    .set(anchor[0], anchor[1], anchor[2])
    .addScaledVector(right, seed.position[0])
    .addScaledVector(UP, seed.position[1])
    .addScaledVector(new Vector3(normal[0], normal[1], normal[2]), seed.position[2]);
}
