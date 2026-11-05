import { Vector3 } from '@iwsdk/core';

/**
 * The Rooftop Party, laid out in the "window frame": origin on the floor at the
 * center of the window bay Bigfoot exits through; +x points out of the window
 * into the city, +y up, +z along the window wall. In the showcase room the frame
 * sits on the glass wall; on a headset it sits on the dream window in the real wall.
 *
 * Staging: the party is on the roof of a taller skyscraper opposite Bigfoot's
 * window. The Yeti DJ's booth stands at its near edge, facing the crowd (+z),
 * with Bigfoot's window down to his left, so his gifts arc down across the street.
 */
export const Rooftop = {
  /** The bay that slides open: width along the wall, and the ledge outside it. */
  bay: { width: 1.6, height: 3.0 },
  ledge: { depth: 0.9 },
  /** Inside the room, just before the glass; and out on the ledge. */
  insideSpot: new Vector3(-0.55, 0, 0),
  ledgeSpot: new Vector3(0.5, 0, 0),
  /** Bigfoot's own tower: its roof, and the extent of the room's glass along the wall. */
  home: { roofY: 3.4, glassZ0: -2.4, glassZ1: 4.0, baseY: -45 },
  /** The taller skyscraper opposite: near facade, footprint, roof height above his floor. */
  building: { nearX: 7.0, farX: 22.0, minZ: -7.0, maxZ: 8.0, roofY: 6.0, baseY: -45 },
  /** The DJ's low stage and booth at the near edge (booth faces the crowd, +z). */
  stage: { x0: 7.6, x1: 10.0, z0: -5.4, z1: -2.6, height: 0.4 },
  booth: new Vector3(8.8, 6.4, -4.4),
  djSpot: new Vector3(8.8, 6.4, -5.05),
  /** The dance floor beyond the booth. */
  crowd: { x0: 8.4, x1: 12.2, z0: -1.6, z1: 5.6 },
  /** Where his leap up lands, and where he dances in the crowd. */
  landing: new Vector3(8.0, 6.0, -0.6),
  danceSpot: new Vector3(10.0, 6.0, -0.9),
  /** Leaping home he takes off from the roof's near edge. */
  edgeSpot: new Vector3(7.6, 6.0, -0.4),
  /** Landmark towers (frame x, z; yaw): close enough that their crowns rise above the party roof as seen from the room. */
  landmarks: { deco: { x: 44, z: -21, yaw: 0.3 }, glass: { x: 54, z: 22, yaw: -0.2 } },
  /** The street ("ground floor") between the two towers. */
  street: { y: -45, x0: 0.8, x1: 6.2 },
  /** Seconds and extra height of the leaps (up, and back down). */
  leapUp: { sec: 2.4, arc: 2.6 },
  leapDown: { sec: 2.2, arc: 1.4 },
  /** Gifts he catches pile up on his floor here, in the room beside the window. */
  pile: new Vector3(-1.5, 0, 1.2),
  /** Where a thrown gift meets his hands (relative to the inside spot, chest height). */
  catchHeight: 1.25,
  /** A raised VIP deck beside the stage: the party viewpoint, close to the DJ and the front row. */
  deck: { x0: 12.8, x1: 15.2, z0: -2.2, z1: 0.4, height: 1.0 },
  /**
   * Viewpoints for the comfortable "tour" (floor point + the point looked at):
   * the VIP deck over the party, and the party roof's edge looking down and across.
   */
  views: {
    party: { at: new Vector3(14.0, 7.0, -0.9), look: new Vector3(9.3, 7.0, -2.6) },
    edge: { at: new Vector3(7.5, 6.0, 2.6), look: new Vector3(0, 1.5, -0.4) },
  },
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
