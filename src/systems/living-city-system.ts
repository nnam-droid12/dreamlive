import { createSystem, Entity, Vector3, VisibilityState } from '@iwsdk/core';
import { DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import { CityLife } from '../visuals/city-life.js';

const cfg = Tuning.city;

/**
 * Keeps New York alive around the party: traffic below, a helicopter circling
 * with its searchlight, birds at sunrise, and a fireworks finale as Bigfoot
 * leaps home and again as the last gift lands.
 */
export class LivingCitySystem extends createSystem({
  director: { required: [Ritual, DreamDirector, RoomSlots, Session] },
}) {
  private city!: CityLife;
  private placedVersion = -1;
  private beat = newBeatContext();
  private time = 0;
  private energy = 0;
  private fired = new Set<string>();
  private generation = -1;

  init(): void {
    const s = Rooftop.street.y;
    this.city = new CityLife({
      streetY: s,
      lanes: cfg.lanes,
      carsPerLane: cfg.carsPerLane,
      carSpeed: cfg.carSpeed,
      carColors: cfg.carColors,
      heli: { center: new Vector3(cfg.heli.x, 0, cfg.heli.z), radius: cfg.heli.radius, height: cfg.heli.height, speed: cfg.heli.speed },
      birds: cfg.birds,
      flock: { from: new Vector3(cfg.flock.from.x, cfg.flock.from.y, cfg.flock.from.z), to: new Vector3(cfg.flock.to.x, cfg.flock.to.y, cfg.flock.to.z), sec: cfg.flock.sec },
    });
    this.world.createTransformEntity(this.city.root);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (d.getValue(RoomSlots, 'windowVersion') !== this.placedVersion) this.place(d);
    const delta = dreamDelta(d, realDelta);
    this.time += delta;

    const roof = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const asleep = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat);
    const scene = asleep ? this.beat.scene : '';
    const live = roof && (scene.startsWith('party-') || scene === 'arrive' || scene === 'leap-back' || scene === 'gifts');
    this.energy += ((live ? 1 : 0.3) - this.energy) * Math.min(1, delta);
    const w = d.getValue(Session, 'world') ?? '';
    this.city.root.visible = !w || w === 'street';
    this.city.update(this.time, delta, this.energy, d.getValue(RoomSlots, 'dawn') ?? 0, d.getValue(RoomSlots, 'dusk') ?? 0);

    // The finale: fireworks as he lands home, and again as the last gift lands. Once per dream.
    const gen = d.getValue(Session, 'generation') ?? 0;
    if (gen !== this.generation || !roof) {
      this.generation = gen;
      if (!roof || scene === 'draw-window') this.fired.clear();
    }
    if (roof) {
      this.cue(d, scene === 'leap-back' && this.beat.time > cfg.finaleLeapAt, 'leap');
      this.cue(d, scene === 'gifts' && this.beat.time > cfg.finaleGiftsAt, 'gifts');
    }
  }

  private cue(d: Entity, when: boolean, id: string): void {
    if (!when || this.fired.has(id)) return;
    this.fired.add(id);
    d.setValue(Session, 'fireworkShots', (d.getValue(Session, 'fireworkShots') ?? 0) + 1);
  }

  private place(d: Entity): void {
    this.placedVersion = d.getValue(RoomSlots, 'windowVersion') ?? 0;
    const o = d.getVectorView(RoomSlots, 'windowOrigin');
    const out = d.getVectorView(RoomSlots, 'windowOut');
    this.city.root.position.set(o[0], o[1], o[2]);
    this.city.root.rotation.set(0, Math.atan2(-out[2], out[0]), 0);
  }
}
