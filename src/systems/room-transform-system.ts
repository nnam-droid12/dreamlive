import { createSystem, Mesh, Object3D, ShaderMaterial, Vector3, VisibilityState } from '@iwsdk/core';
import { DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import type { DissolveUniforms } from '../visuals/dissolve.js';
import { buildNightSky } from '../visuals/night-sky.js';

const cfg = Tuning.transform;
/** Rooftop Party beats after Bigfoot lands on the party roof: the room is a penthouse by then. */
const OPEN_SCENES = new Set(['arrive', 'party-wait', 'leap-back', 'gifts', 'to-bed']);

/**
 * The dream transforms the room. It begins as an ordinary bedroom; the window
 * drawn for Bigfoot dissolves open first, then (once he lands at the party) the
 * whole window wall dissolves into glass over New York and the ceiling opens
 * into a starry night sky, which warms into sunrise as he goes back to bed.
 * The penthouse stays for the rest of the session. Values are published on
 * RoomSlots (wallOpen, ceilingOpen, dawn, holeOpen) for the other systems.
 */
export class RoomTransformSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, RoomSlots] },
}) {
  private sky!: Mesh;
  private skyMat!: ShaderMaterial;
  private veil?: Object3D;
  private veilU?: DissolveUniforms;
  private ceilingU?: DissolveUniforms;
  private found = false;
  private windowVersion = 0;
  private beat = newBeatContext();
  private time = 0;
  private wall = 0;
  private ceiling = 0;
  private dawn = 0;
  private hole = 0;
  private a = new Vector3();
  private b = new Vector3();

  init(): void {
    this.sky = buildNightSky();
    this.skyMat = this.sky.material as ShaderMaterial;
    this.sky.visible = false;
    this.world.createTransformEntity(this.sky);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.found) this.find(d);
    if (this.found && d.getValue(RoomSlots, 'windowVersion') !== this.windowVersion) {
      this.windowVersion = d.getValue(RoomSlots, 'windowVersion') ?? 0;
      this.setHoleAt(d);
    }
    const delta = dreamDelta(d, realDelta);
    this.time += realDelta;

    const phase = d.getValue(Ritual, 'phase');
    const roof = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const dreaming = phase === RitualPhase.Asleep && readBeat(d, this.beat);
    const scene = dreaming ? this.beat.scene : '';
    const after = roof && (phase === RitualPhase.Waking || phase === RitualPhase.Awake);
    const open = after || (roof && (OPEN_SCENES.has(scene) || scene.startsWith('party-')));

    // The drawn window (DrawWindowSystem sets holeOpen); with no drawing it opens as he gets up.
    const drawn = d.getValue(RoomSlots, 'holeOpen') ?? 0;
    const autoHole = roof && (open || (scene === 'to-window' && this.beat.time > cfg.autoHoleAt) || scene === 'leap-out') ? 1 : 0;
    this.hole = Math.max(drawn, this.hole + (autoHole - this.hole) * Math.min(1, delta * cfg.holeRate));
    this.wall += ((open ? 1 : 0) - this.wall) * Math.min(1, delta * cfg.wallRate);
    const ceilingTarget = open && this.wall > cfg.ceilingAfter ? 1 : 0;
    this.ceiling += (ceilingTarget - this.ceiling) * Math.min(1, delta * cfg.ceilingRate);
    const dawnTarget = after ? 1 : scene === 'to-bed' ? cfg.dawnInBed * Math.min(1, this.beat.time / 9) : 0;
    this.dawn += (dawnTarget - this.dawn) * Math.min(1, delta * cfg.dawnRate);

    d.setValue(RoomSlots, 'wallOpen', this.wall);
    d.setValue(RoomSlots, 'ceilingOpen', this.ceiling);
    d.setValue(RoomSlots, 'dawn', this.dawn);
    if (this.veilU) {
      this.veilU.progress.value = this.wall;
      this.veilU.holeOpen.value = this.hole;
    }
    if (this.ceilingU) this.ceilingU.progress.value = this.ceiling;

    const outside = !!d.getValue(RoomSlots, 'viewOutside');
    this.sky.visible = outside || this.ceiling > 0.01 || this.wall > 0.01 || this.hole > 0.01;
    if (this.sky.visible) {
      this.player.head.getWorldPosition(this.sky.position);
      this.skyMat.uniforms.uTime.value = this.time;
      this.skyMat.uniforms.uDawn.value = this.dawn;
    }
  }

  /** The showcase room's veil and ceiling, and the window bay's rectangle on the veil. */
  private find(d: import('@iwsdk/core').Entity): void {
    this.veil = this.scene.getObjectByName('DreamVeil') ?? undefined;
    const ceiling = this.scene.getObjectByName('DreamCeiling') ?? undefined;
    if (!this.veil || !ceiling || !d.getValue(RoomSlots, 'windowReady')) return;
    this.found = true;
    this.veilU = this.veil.userData.dissolve as DissolveUniforms;
    this.ceilingU = ceiling.userData.dissolve as DissolveUniforms;
    this.setHoleAt(d);
  }

  /** Puts the opening on the veil over the window bay (window frame origin, bay width). */
  setHoleAt(d: import('@iwsdk/core').Entity): void {
    if (!this.veil || !this.veilU) return;
    const o = d.getVectorView(RoomSlots, 'windowOrigin');
    const al = d.getVectorView(RoomSlots, 'windowAlong');
    const half = Rooftop.bay.width / 2;
    this.veil.updateMatrixWorld(true);
    this.veil.worldToLocal(this.a.set(o[0] - al[0] * half, 0.05, o[2] - al[2] * half));
    this.veil.worldToLocal(this.b.set(o[0] + al[0] * half, Rooftop.bay.height - 0.05, o[2] + al[2] * half));
    this.veilU.hole.value.set(Math.min(this.a.x, this.b.x), Math.min(this.a.y, this.b.y), Math.max(this.a.x, this.b.x), Math.max(this.a.y, this.b.y));
  }
}
