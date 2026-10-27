import { Vector3 } from '@iwsdk/core';

/**
 * The Rooftop Party, laid out in the "window frame": origin on the floor at the
 * center of the window bay Bigfoot exits through; +x points out of the window
 * into the city, +y up, +z along the window wall. In the showcase room the frame
 * sits on the glass wall; on a headset it sits on the dream window in the real wall.
 *
 * Staging: the DJ is on a raised stage at the far side of the roof, facing the
 * window; the crowd fills the floor between the stage and the near edge, facing
 * him; the street ("ground floor") is the gap between the two buildings.
 */
export const Rooftop = {
  /** The bay that slides open: width along the wall, and the ledge outside it. */
  bay: { width: 1.6, height: 3.0 },
  ledge: { depth: 0.9 },
  /** Inside the room, just before the glass; and out on the ledge. */
  insideSpot: new Vector3(-0.55, 0, 0),
  ledgeSpot: new Vector3(0.5, 0, 0),
  /** The neighbouring high-rise: near facade, footprint along the wall, roof height. */
  building: { nearX: 3.0, farX: 19.0, minZ: -12.0, maxZ: 3.0, roofY: 0.0, baseY: -45 },
  /** The DJ stage (far side of the roof): extent and height above the roof. */
  stage: { x0: 7.0, x1: 9.0, z0: -4.4, z1: 0.4, height: 0.6 },
  /** The booth on the stage, facing the window (-x); he stands just behind it. */
  booth: new Vector3(7.6, 0.6, -2.0),
  djSpot: new Vector3(8.25, 0.6, -2.0),
  /** The dance floor between the near edge and the stage. */
  crowd: { x0: 3.9, x1: 6.6, z0: -4.2, z1: -0.2 },
  /** Where his leap lands (near corner, beside the crowd). */
  landing: new Vector3(3.6, 0, 1.2),
  /** The street ("ground floor") between the buildings, where most goodies land. */
  street: { y: -45, x0: 0.6, x1: 2.4 },
  /** Seconds and height of the leap across. */
  leap: { sec: 1.6, arc: 1.8 },
} as const;

/** A placed window frame (world space). */
export interface WindowFrame {
  origin: Vector3;
  /** Unit vectors: out of the window, and along the wall. */
  out: Vector3;
  along: Vector3;
}

/** Window-frame point → world space. */
export function frameToWorld(f: WindowFrame, p: { x: number; y: number; z: number }, out: Vector3): Vector3 {
  return out.copy(f.origin).addScaledVector(f.out, p.x).addScaledVector(f.along, p.z).setY(f.origin.y + p.y);
}
