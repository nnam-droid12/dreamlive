import { AssetManager, createSystem, DirectionalLight, SRGBColorSpace, Group, HemisphereLight, Mesh, Object3D, ShaderMaterial, Vector3, VisibilityState } from '@iwsdk/core';
import { SeaWeather } from './lib/sea-weather.js';
import { DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Session } from '../components/session.js';
import { Palette } from '../config/palette.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import type { DissolveUniforms } from '../visuals/dissolve.js';
import { buildNightSky, setSkyPhotos } from '../visuals/night-sky.js';

const cfg = Tuning.transform;
/** Rooftop Party beats after Bigfoot lands on the party roof: the room is a penthouse by then. */
const OPEN_SCENES = new Set(['arrive', 'party-wait', 'leap-back', 'gifts', 'to-bed']);
/** Beats after the party: a lit-up night for the leap home, the gifts and the fireworks. */
const NIGHT_SCENES = new Set(['leap-back', 'gifts', 'to-bed']);

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
  private dusk = 1;
  private sun!: DirectionalLight;
  private fill!: HemisphereLight;
  private skyline?: import('@iwsdk/core').Object3D;
  private sunDir = new Vector3(0.8, 0.1, -0.6).normalize();
  private a = new Vector3();
  private b = new Vector3();

  init(): void {
    this.sky = buildNightSky();
    this.skyMat = this.sky.material as ShaderMaterial;
    this.sky.visible = false;
    this.world.createTransformEntity(this.sky);
    void this.loadSkyPhotos();
    // Golden-hour light, always in the scene (intensity 0 when unused: adding lights later recompiles materials).
    const lights = new Group();
    lights.name = 'GoldenHourLights';
    this.sun = new DirectionalLight(Palette.sunLight, 0);
    this.fill = new HemisphereLight(Palette.duskSkyFill, Palette.duskGroundFill, 0);
    lights.add(this.sun, this.sun.target, this.fill);
    this.world.createTransformEntity(lights);
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
    // Any dream world outside (clouds, sea) opens the room to it as well.
    const world = d.hasComponent(Session) ? (d.getValue(Session, 'world') ?? '') : '';
    // The skyline photo outside the showcase glass belongs to New York, not to the other worlds.
    if (this.skyline) this.skyline.visible = !world;
    const open = !!world || after || (roof && (OPEN_SCENES.has(scene) || scene.startsWith('party-')));

    // The drawn window (DrawWindowSystem sets holeOpen); with no drawing it opens as he gets up.
    const drawn = d.getValue(RoomSlots, 'holeOpen') ?? 0;
    const autoHole = roof && (open || (scene === 'to-window' && this.beat.time > cfg.autoHoleAt) || scene === 'leap-out') ? 1 : 0;
    this.hole = Math.max(drawn, this.hole + (autoHole - this.hole) * Math.min(1, delta * cfg.holeRate));
    this.wall += ((open ? 1 : 0) - this.wall) * Math.min(1, delta * cfg.wallRate);
    // (Movie Night is a cinema: the ceiling closes over the room while the film plays.)
    const cinema = d.getValue(RoomSlots, 'movieDim') ?? 0;
    const ceilingTarget = open && this.wall > cfg.ceilingAfter && cinema < 0.05 ? 1 : 0;
    this.ceiling += (ceilingTarget - this.ceiling) * Math.min(1, delta * cfg.ceilingRate);
    // Time of day: the story's, unless the palm menu chose one.
    // A dream world sets its own sky: sunrise above the clouds, night for the storm.
    const worldSky = world === 'clouds' ? 'dawn' : world === 'sea' ? (SeaWeather.sun > 0.45 ? 'dawn' : 'night') : '';
    const sky = worldSky || (cinema > 0.05 ? 'night' : d.hasComponent(Session) ? (d.getValue(Session, 'skyOverride') ?? '') : '');
    const storyDawn = after ? 1 : scene === 'to-bed' ? cfg.dawnInBed * Math.min(1, this.beat.time / 9) : 0;
    const dawnTarget = sky === 'dawn' ? 1 : sky ? 0 : storyDawn;
    const storyDusk = !roof ? 1 : after || NIGHT_SCENES.has(scene) ? 0 : scene.startsWith('party-') && scene !== 'party-wait' ? cfg.duskLateParty : 1;
    const duskTarget = sky === 'sunset' ? 1 : sky ? 0 : storyDusk;
    this.dusk += (duskTarget - this.dusk) * Math.min(1, delta * cfg.duskRate);
    d.setValue(RoomSlots, 'dusk', this.dusk);
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
    // The showcase room always has glass to look through; on a headset the sky only shows through the dream.
    this.sky.visible = Showcase.enabled || outside || this.ceiling > 0.01 || this.wall > 0.01 || this.hole > 0.01;
    this.light(d);
    if (this.sky.visible) {
      this.player.head.getWorldPosition(this.sky.position);
      this.skyMat.uniforms.uTime.value = this.time;
      this.skyMat.uniforms.uDawn.value = this.dawn;
      this.skyMat.uniforms.uDusk.value = this.dusk;
      this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    }
  }

  /** Real sky photos (CC0, Poly Haven): golden hour, night, sunrise. The gradient shows until they arrive. */
  private async loadSkyPhotos(): Promise<void> {
    try {
      const base = `${import.meta.env.BASE_URL}env/sky/`;
      const [golden, night, sunrise] = await Promise.all(['golden', 'night', 'dawn'].map((n) => AssetManager.loadTexture(`${base}${n}.webp`)));
      for (const t of [golden, night, sunrise]) t.colorSpace = SRGBColorSpace;
      setSkyPhotos(this.sky, golden, night, sunrise);
    } catch {
      // The gradient sky remains.
    }
  }

  /** The low sun (golden hour, or sunrise) lights the room and the city from beyond the window. */
  private light(d: import('@iwsdk/core').Entity): void {
    const o = d.getVectorView(RoomSlots, 'windowOrigin');
    const out = d.getVectorView(RoomSlots, 'windowOut');
    const al = d.getVectorView(RoomSlots, 'windowAlong');
    const az = (cfg.sunAzimuthDeg * Math.PI) / 180;
    const el = (cfg.sunElevationDeg * Math.PI) / 180;
    // Left of straight out (the viewer faces out of the window; left is -along).
    this.sunDir.set(out[0] * Math.cos(az) - al[0] * Math.sin(az), 0, out[2] * Math.cos(az) - al[2] * Math.sin(az)).normalize();
    this.sunDir.multiplyScalar(Math.cos(el)).setY(Math.sin(el));
    this.sun.target.position.set(o[0], o[1], o[2]);
    this.sun.position.set(o[0] + this.sunDir.x * 40, o[1] + this.sunDir.y * 40 + 4, o[2] + this.sunDir.z * 40);
    // Movie Night turns the house lights down.
    const lights = 1 - 0.95 * (d.getValue(RoomSlots, 'movieDim') ?? 0);
    this.sun.intensity = (cfg.sunIntensity * this.dusk + cfg.dawnLight * cfg.sunIntensity * this.dawn) * lights;
    this.fill.intensity = cfg.fillIntensity * Math.max(this.dusk, this.dawn * cfg.dawnLight) * lights;
  }

  /** The showcase room's veil and ceiling, and the window bay's rectangle on the veil. */
  private find(d: import('@iwsdk/core').Entity): void {
    this.veil = this.scene.getObjectByName('DreamVeil') ?? undefined;
    this.skyline = this.scene.getObjectByName('Skyline') ?? undefined;
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
