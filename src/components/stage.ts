import { createComponent, Types } from '@iwsdk/core';

/** How the dream stage was established. */
export const StageSource = {
  None: 'none',
  /** Palms calibrated on top of a detected table plane. */
  Table: 'table',
  /** Palms calibrated on a surface the headset did not report. */
  Palm: 'palm',
  /** Calibrated in mid-air: a cloud platform becomes the stage. */
  Air: 'air',
  /** Nobody tucked in; placed automatically so the dream never stalls. */
  Auto: 'auto',
} as const;

/** The calibrated dream stage: a rectangle on the real table (world space). */
export const StageSurface = createComponent('StageSurface', {
  source: { type: Types.Enum, enum: StageSource, default: StageSource.None },
  center: { type: Types.Vec3, default: [0, 0, 0] },
  /** Rotation about +Y; the stage's +Z axis points at the seated user. */
  yaw: { type: Types.Float32, default: 0 },
  width: { type: Types.Float32, default: 0.6 },
  depth: { type: Types.Float32, default: 0.4 },
});

/** What RoomUnderstandingSystem found in the real room. */
export const RoomSlots = createComponent('RoomSlots', {
  tableFound: { type: Types.Boolean, default: false },
  tableCenter: { type: Types.Vec3, default: [0, 0, 0] },
  tableYaw: { type: Types.Float32, default: 0 },
  tableWidth: { type: Types.Float32, default: 0 },
  tableDepth: { type: Types.Float32, default: 0 },
  wallFound: { type: Types.Boolean, default: false },
  wallCenter: { type: Types.Vec3, default: [0, 0, 0] },
  /** Unit normal pointing from the wall toward the user. */
  wallNormal: { type: Types.Vec3, default: [0, 0, 1] },
  ceilingFound: { type: Types.Boolean, default: false },
  ceilingHeight: { type: Types.Float32, default: 0 },
  planeCount: { type: Types.Int16, default: 0 },
  /** A real bed or couch (Quest scene labels) where Bigfoot sleeps: top-surface center and long axis. */
  restFound: { type: Types.Boolean, default: false },
  restCenter: { type: Types.Vec3, default: [0, 0, 0] },
  restAxis: { type: Types.Vec3, default: [1, 0, 0] },
  restLength: { type: Types.Float32, default: 0 },
  /** A real TV (Quest 'screen' label): the dream maps onto it. */
  screenFound: { type: Types.Boolean, default: false },
  screenCenter: { type: Types.Vec3, default: [0, 0, 0] },
  screenNormal: { type: Types.Vec3, default: [0, 0, 1] },
  screenWidth: { type: Types.Float32, default: 0 },
  /** Set by showcase mode: the layout is authored, so detection must not overwrite it. */
  locked: { type: Types.Boolean, default: false },
  /** Where wall moments happen: on the real wall ahead, or a paper backdrop. */
  anchorReady: { type: Types.Boolean, default: false },
  anchorIsBackdrop: { type: Types.Boolean, default: false },
  /** The anchor is the user's real TV (no virtual TV frame is hung). */
  anchorIsScreen: { type: Types.Boolean, default: false },
  /** Width of the dream picture at the anchor, meters (16:9). */
  anchorWidth: { type: Types.Float32, default: 2.18 },
  /** The window Bigfoot leaves through (Rooftop Party): floor point at its center,
   * unit vectors out of the window and along the wall. */
  windowReady: { type: Types.Boolean, default: false },
  windowOrigin: { type: Types.Vec3, default: [0, 0, 0] },
  windowOut: { type: Types.Vec3, default: [1, 0, 0] },
  windowAlong: { type: Types.Vec3, default: [0, 0, 1] },
  /** 0 closed .. 1 slid fully open (the music pours in as it opens). */
  windowOpen: { type: Types.Float32, default: 0 },
  anchorPoint: { type: Types.Vec3, default: [0, 0, 0] },
  /** Unit normal of the anchor surface, pointing toward the user. */
  anchorNormal: { type: Types.Vec3, default: [0, 0, 1] },
});

/** Tags the entity whose object3D is the stage root (origin = stage center, +Z toward user). */
export const StageAnchor = createComponent('StageAnchor', {});
