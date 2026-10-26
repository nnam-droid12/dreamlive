import {
  createSystem,
  Entity,
  Mesh,
  PointLight,
  Points,
  ShaderMaterial,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { makeLightBeam, makeSpillPoints, SpillMode } from '../visuals/spill-effects.js';

const cfg = Tuning.spill;
const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);
const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
type Act = 'surf' | 'dj' | 'ski';
const LIGHT_COLOR: Record<Act, number> = { surf: Palette.seaShallow, dj: Palette.pinkSoft, ski: Palette.moonBlueSoft };

/**
 * The dream breaks the frame: while an act plays on the TV (or a memory replays),
 * it pours into the room. Surf throws sea spray out of the screen, the rooftop
 * party sweeps light beams and drops confetti on a 120 BPM pulse, the ski run
 * snows all around the viewer. A colored light from the TV washes the room.
 */
export class DreamSpillSystem extends createSystem({
  director: { required: [Ritual, RoomSlots, DreamDirector, DevControls, Session] },
}) {
  private built = false;
  private beat = newBeatContext();
  private fields = new Map<Act, Points>();
  private beams: Mesh[] = [];
  private light!: PointLight;
  private level: Record<Act, number> = { surf: 0, dj: 0, ski: 0 };
  private time = 0;
  private anchor = new Vector3();
  private normal = new Vector3();
  private right = new Vector3();
  private dir = new Vector3();
  private beamTopY = 0;
  private beamHalfW = 0;

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'anchorReady')) return;
    if (!this.built) this.build(d);
    const delta = dreamDelta(d, realDelta);
    this.time += delta;

    // Which act is spilling, and how strongly (ramps in and out with the act).
    let act: Act | undefined;
    let target = 0;
    if (d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat)) {
      const scene = this.beat.scene;
      if (scene === 'surf' || scene === 'dj' || scene === 'ski') {
        act = scene;
        target = smooth(cfg.rampIn[0], cfg.rampIn[1], this.beat.progress) * (1 - smooth(cfg.rampOut[0], cfg.rampOut[1], this.beat.progress));
      }
    } else {
      const replay = d.getValue(Session, 'replay') ?? '';
      if (replay === 'surf' || replay === 'dj' || replay === 'ski') {
        act = replay;
        const t = d.getValue(Session, 'replayTime') ?? 0;
        target = cfg.replayLevel * smooth(0, 1.5, t) * (1 - smooth(Tuning.memoryShelf.replaySec - 1.5, Tuning.memoryShelf.replaySec, t));
      }
    }

    let lightLevel = 0;
    for (const a of ['surf', 'dj', 'ski'] as const) {
      const goal = a === act ? target : 0;
      this.level[a] += (goal - this.level[a]) * Math.min(1, cfg.fadeRate * realDelta);
      const field = this.fields.get(a)!;
      const mat = field.material as ShaderMaterial;
      mat.uniforms.time.value = this.time;
      mat.uniforms.opacity.value = this.level[a];
      field.visible = this.level[a] > 0.01;
      lightLevel = Math.max(lightLevel, this.level[a]);
      if (a === act) this.light.color.setHex(LIGHT_COLOR[a]);
    }

    // DJ: beams sweep from the TV's top corners; the light pulses on the beat.
    const dj = this.level.dj;
    const beat = Math.pow(1 - ((this.time * cfg.bpm) / 60) % 1, 3);
    for (let i = 0; i < this.beams.length; i++) {
      const beam = this.beams[i];
      beam.visible = dj > 0.01;
      if (!beam.visible) continue;
      const side = i % 2 ? 1 : -1;
      const yaw = Math.sin(this.time * 0.8 + i * 1.7) * 0.7 + side * 0.25;
      const pitch = 0.35 + Math.sin(this.time * 0.6 + i) * 0.3;
      this.dir.copy(this.normal).multiplyScalar(Math.cos(yaw)).addScaledVector(this.right, Math.sin(yaw));
      this.dir.multiplyScalar(Math.cos(pitch)).addScaledVector(UP, Math.sin(pitch)).normalize();
      beam.quaternion.setFromUnitVectors(DOWN, this.dir);
      (beam.material as ShaderMaterial).uniforms.opacity.value = dj * (0.55 + 0.45 * beat);
    }

    const pulse = act === 'dj' ? 0.55 + 0.45 * beat : 0.85 + 0.15 * Math.sin(this.time * 2.2);
    this.light.intensity = lightLevel * cfg.lightIntensity * pulse;
    this.light.visible = this.light.intensity > 0.001;
  }

  private build(d: Entity): void {
    this.built = true;
    this.anchor.fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    this.normal.fromArray(d.getVectorView(RoomSlots, 'anchorNormal')).setY(0).normalize();
    this.right.crossVectors(UP, this.normal).normalize();
    const w = d.getValue(RoomSlots, 'anchorWidth') ?? 2.18;
    const h = (w * 9) / 16;
    const head = this.player.head.getWorldPosition(new Vector3());
    const room = new Vector3().subVectors(head, this.anchor).setY(0);
    const depth = Math.max(1.5, room.length());

    // Surf: spray from the whole screen toward the viewer.
    const spray = makeSpillPoints(SpillMode.Spray, cfg.sprayCount, [0xdff4ff, Palette.moonBlueSoft, 0xffffff], 0.012);
    this.frame(spray, this.anchor.clone().addScaledVector(this.normal, 0.05), [w * 0.85, h * 0.7, 1]);
    // DJ: confetti between the TV and the viewer.
    const confetti = makeSpillPoints(SpillMode.Confetti, cfg.confettiCount, [Palette.pinkSoft, Palette.lanternAmber, Palette.moonBlue], 0.016);
    this.frame(confetti, this.anchor.clone().addScaledVector(this.normal, depth * 0.45).setY(1.4), [w * 1.4, 2.8, depth * 0.8]);
    // Ski: snow all around the viewer, out to the TV.
    const snow = makeSpillPoints(SpillMode.Snow, cfg.snowCount, [0xffffff, Palette.moonBlueSoft, 0xffffff], 0.014);
    this.frame(snow, this.anchor.clone().addScaledVector(this.normal, depth * 0.55).setY(1.5), [Math.max(4, w * 2), 3, depth * 1.4]);
    this.fields.set('surf', spray).set('dj', confetti).set('ski', snow);
    for (const p of [spray, confetti, snow]) this.world.createTransformEntity(p);

    this.beamTopY = this.anchor.y + h / 2;
    this.beamHalfW = w / 2 - 0.1;
    for (let i = 0; i < 4; i++) {
      const color = [Palette.pinkSoft, Palette.moonBlue, Palette.lanternAmber, Palette.pinkSoft][i];
      const beam = makeLightBeam(color, cfg.beamLength, cfg.beamRadius);
      const side = i % 2 ? 1 : -1;
      beam.position.copy(this.anchor).addScaledVector(this.right, side * this.beamHalfW * (i < 2 ? 1 : 0.4)).addScaledVector(this.normal, 0.06).setY(this.beamTopY);
      this.beams.push(beam);
      this.world.createTransformEntity(beam);
    }

    // The TV's glow on the room. Present from the start (intensity 0) so adding it never recompiles shaders.
    this.light = new PointLight(0xffffff, 0, cfg.lightDistance, 1.6);
    this.light.position.copy(this.anchor).addScaledVector(this.normal, 0.9);
    this.world.createTransformEntity(this.light);
  }

  private frame(p: Points, origin: Vector3, extent: [number, number, number]): void {
    const u = (p.material as ShaderMaterial).uniforms;
    (u.origin.value as Vector3).copy(origin);
    (u.axR.value as Vector3).copy(this.right);
    (u.axN.value as Vector3).copy(this.normal);
    (u.extent.value as Vector3).set(...extent);
  }
}
