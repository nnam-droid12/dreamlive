import { createSystem, Entity, FogExp2, Group, Mesh, Quaternion, ShaderMaterial, Vector3, VisibilityState } from '@iwsdk/core';
import { LoopHandle, Sound } from '../audio/engine.js';
import { RoomSlots } from '../components/stage.js';
import { Session } from '../components/session.js';
import { Palette, PaletteSets } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta } from '../dreams/beat-context.js';
import { frameToWorld, WindowFrame } from '../showcase/rooftop-layout.js';
import { Bursts } from '../visuals/bursts.js';
import { buildRainGlass } from '../visuals/rain-glass.js';
import { Showcase } from '../config/showcase.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import { Weather, WeatherKind } from '../visuals/weather.js';

const cfg = Tuning.fx;

/**
 * Effects the user triggers from the palm menu (and the story's finale can
 * fire too): firework volleys over the city beyond the party roof, confetti
 * that pops in front of the viewer, and weather outside the window (rain with
 * its hiss, snow, fog). Everything sits in the window frame, so it follows a
 * redrawn window.
 */
export class SkyFxSystem extends createSystem({
  director: { required: [Session, RoomSlots] },
}) {
  private fireworks!: Bursts;
  private confetti!: Bursts;
  private weather!: Weather;
  private weatherRoot!: Group;
  private fog!: FogExp2;
  private rainGlass!: Mesh;
  private rainGlassMat!: ShaderMaterial;
  private fogAmount = 0;
  private rainLoop?: LoopHandle;
  private frame: WindowFrame = { origin: new Vector3(), out: new Vector3(), along: new Vector3() };
  private placedVersion = -1;
  private seenConfetti = 0;
  private seenFireworks = 0;
  private pending = 0;
  private pendingGap = 0;
  private time = 0;
  private at = new Vector3();
  private head = new Vector3();
  private fwd = new Vector3();
  private quat = new Quaternion();
  private p = { x: 0, y: 0, z: 0 };

  init(): void {
    this.fireworks = new Bursts(cfg.volley * cfg.shellSparks * 2, cfg.shellSize, true);
    this.fireworks.points.name = 'Fireworks';
    this.confetti = new Bursts(cfg.confetti * 3, cfg.confettiSize, false);
    this.confetti.points.name = 'Confetti';
    this.world.createTransformEntity(this.fireworks.points);
    this.world.createTransformEntity(this.confetti.points);
    this.weather = new Weather(cfg.weatherBox, cfg.rainDrops, cfg.snowFlakes, Palette.rain, Palette.snow);
    this.weatherRoot = new Group();
    this.weatherRoot.name = 'WeatherRoot';
    this.weatherRoot.add(this.weather.group);
    this.world.createTransformEntity(this.weatherRoot);
    this.fog = new FogExp2(Palette.fog, 0);
    // Rain running down the glass: the showcase room's whole glass wall, or the dream window on a headset.
    const H = Rooftop.home;
    const w = Showcase.enabled ? H.glassZ1 - H.glassZ0 : Rooftop.bay.width;
    const h = Showcase.enabled ? 3 : Rooftop.bay.height;
    this.rainGlass = buildRainGlass(w, h, Palette.rain);
    this.rainGlassMat = this.rainGlass.material as ShaderMaterial;
    this.rainGlass.rotation.y = -Math.PI / 2;
    this.rainGlass.position.set(0.02, h / 2, Showcase.enabled ? (H.glassZ0 + H.glassZ1) / 2 : 0);
    this.weatherRoot.add(this.rainGlass);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (d.getValue(RoomSlots, 'windowVersion') !== this.placedVersion) this.place(d);
    const delta = dreamDelta(d, realDelta);
    this.time += delta;

    const c = d.getValue(Session, 'confettiShots') ?? 0;
    if (c !== this.seenConfetti) {
      this.seenConfetti = c;
      this.popConfetti();
    }
    const f = d.getValue(Session, 'fireworkShots') ?? 0;
    if (f !== this.seenFireworks) {
      this.seenFireworks = f;
      this.pending += cfg.volley;
      this.pendingGap = 0;
    }
    if (this.pending > 0) {
      this.pendingGap -= delta;
      if (this.pendingGap <= 0) {
        this.pending--;
        this.pendingGap = cfg.volleyGapSec;
        this.shell();
      }
    }
    this.fireworks.update(delta);
    this.confetti.update(delta);

    // A dream world brings its own weather: clear above the clouds, rain in the storm.
    const world = d.getValue(Session, 'world') ?? '';
    const worldWeather = world === 'clouds' ? 'clear' : world === 'sea' ? 'rain' : '';
    const kind = (worldWeather || (d.getValue(Session, 'weather') ?? 'clear')) as WeatherKind;
    this.weather.update(kind, delta, this.time, cfg.weatherRate, cfg.rainSpeed, cfg.snowSpeed);
    this.rain(this.weather.rainLevel);
    this.rainGlass.visible = this.weather.rainLevel > 0.01;
    this.rainGlassMat.uniforms.uAmount.value = this.weather.rainLevel;
    this.rainGlassMat.uniforms.uTime.value = this.time;
    this.fogAmount += ((kind === 'fog' ? 1 : kind === 'rain' ? 0.35 : 0) - this.fogAmount) * Math.min(1, delta * cfg.weatherRate);
    this.fog.density = cfg.fogDensity * this.fogAmount;
    const want = this.fogAmount > 0.01 ? this.fog : null;
    if (this.scene.fog !== want) this.scene.fog = want;
  }

  /** The effects live in the window frame: outside the glass, over the city. */
  private place(d: Entity): void {
    this.placedVersion = d.getValue(RoomSlots, 'windowVersion') ?? 0;
    this.frame.origin.fromArray(d.getVectorView(RoomSlots, 'windowOrigin'));
    this.frame.out.fromArray(d.getVectorView(RoomSlots, 'windowOut'));
    this.frame.along.fromArray(d.getVectorView(RoomSlots, 'windowAlong'));
    // Frame axes: local +x out of the window, +z along the wall.
    this.weatherRoot.position.copy(this.frame.origin);
    this.weatherRoot.rotation.set(0, Math.atan2(-this.frame.out.z, this.frame.out.x), 0);
  }

  private shell(): void {
    const s = cfg.sky;
    this.p.x = s.x0 + Math.random() * (s.x1 - s.x0);
    this.p.y = s.y0 + Math.random() * (s.y1 - s.y0);
    this.p.z = s.z0 + Math.random() * (s.z1 - s.z0);
    frameToWorld(this.frame, this.p, this.at);
    // Each shell is one or two colours from the palette.
    const i = Math.floor(Math.random() * PaletteSets.fireworks.length);
    const colors = [PaletteSets.fireworks[i], PaletteSets.fireworks[(i + 1 + Math.floor(Math.random() * 2)) % PaletteSets.fireworks.length]];
    this.fireworks.burst(this.at, { count: cfg.shellSparks, speed: cfg.shellSpeed, colors, gravity: 2.2, drag: 0.9, life: cfg.shellLife });
    Sound.play('firework', this.at, 0.9);
  }

  /** Confetti pops just above and in front of the viewer and flutters down. */
  private popConfetti(): void {
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.quat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.quat).setY(0).normalize();
    this.at.copy(this.head).addScaledVector(this.fwd, 0.7);
    this.at.y += 0.45;
    this.confetti.burst(this.at, { count: cfg.confetti, speed: cfg.confettiSpeed, colors: PaletteSets.confetti, gravity: 0.9, drag: 1.6, life: cfg.confettiLife, lift: 0.6 });
    Sound.play('pop', this.at, 0.8);
  }

  private rain(level: number): void {
    if (level > 0.02 && !this.rainLoop) {
      this.rainLoop = Sound.loop('rain', this.frame.origin, 0);
    }
    if (!this.rainLoop) return;
    this.rainLoop.setGain(level * 0.8);
    if (level <= 0.02) {
      this.rainLoop.stop();
      this.rainLoop = undefined;
    }
  }
}
