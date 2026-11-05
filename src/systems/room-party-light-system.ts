import {
  AdditiveBlending,
  Color,
  createSystem,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SpotLight,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { SONG_PALETTE, songOf } from '../dreams/chapter_rooftop.js';
import { NycLayout } from '../showcase/nyc-bedroom.js';
import { frameToWorld, Rooftop, WindowFrame } from '../showcase/rooftop-layout.js';

const cfg = Tuning.partyLight;
const UP = new Vector3(0, 1, 0);
/** Beats when the party is loud enough to reach the room (the viewer is at home for these). */
const LIVE = new Set(['arrive', 'party-wait', 'leap-back', 'gifts']);

interface Beam {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  phase: number;
}

/**
 * The party spills into your room. Laser beams fire from the Yeti's stage
 * across the street, in through the window, and sweep over your walls and
 * ceiling; in the showcase room two coloured spotlights wash the walls too.
 * Colours follow the song (yours, if you are DJing), flashes land on the beat.
 */
export class RoomPartyLightSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, RoomSlots] },
}) {
  private root!: Group;
  private beams: Beam[] = [];
  private spots: SpotLight[] = [];
  private spotTargets: Object3D[] = [];
  private frame: WindowFrame = { origin: new Vector3(), out: new Vector3(), along: new Vector3() };
  private placedVersion = -1;
  private beat = newBeatContext();
  private energy = 0;
  private time = 0;
  private from = new Vector3();
  private to = new Vector3();
  private dir = new Vector3();
  private quat = new Quaternion();
  private color = new Color();
  private back = { x: 0, y: 0, z: 0 };

  init(): void {
    this.root = new Group();
    this.root.name = 'RoomPartyLight';
    const geo = new CylinderGeometry(cfg.beamRadius, cfg.beamRadius, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);
    for (let i = 0; i < cfg.beams; i++) {
      const mat = new MeshBasicMaterial({ transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
      const mesh = new Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 20;
      this.root.add(mesh);
      this.beams.push({ mesh, mat, phase: (i / cfg.beams) * Math.PI * 2 });
    }
    if (Showcase.enabled) {
      // Always in the scene (intensity 0 when off): adding lights later recompiles every material.
      for (let i = 0; i < 2; i++) {
        const s = new SpotLight(0xffffff, 0, cfg.spotRange, cfg.spotAngle, 0.6, 1.2);
        const t = new Object3D();
        s.target = t;
        this.root.add(s, t);
        this.spots.push(s);
        this.spotTargets.push(t);
      }
    }
    this.world.createTransformEntity(this.root);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (d.getValue(RoomSlots, 'windowVersion') !== this.placedVersion) this.place(d);
    const delta = dreamDelta(d, realDelta);
    this.time += delta;

    const roof = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const phase = d.getValue(Ritual, 'phase');
    const scene = phase === RitualPhase.Asleep && readBeat(d, this.beat) ? this.beat.scene : '';
    const dj = d.hasComponent(Session) ? (d.getValue(Session, 'djSong') ?? '') : '';
    const replay = d.hasComponent(Session) ? (d.getValue(Session, 'replay') ?? '') : '';
    const home = !d.getValue(RoomSlots, 'viewOutside');
    const replaying = replay === 'disco' || replay === 'afro' || replay === 'house';
    const live = home && ((roof && (LIVE.has(scene) || scene.startsWith('party-') || (!!dj && phase === RitualPhase.Asleep))) || replaying);
    this.energy += ((live ? 1 : 0) - this.energy) * Math.min(1, delta * cfg.fadeRate);
    const on = this.energy > 0.01;
    this.root.visible = on;
    for (const s of this.spots) s.intensity = 0;
    if (!on) return;

    const song = dj || (replaying ? replay : songOf(scene)) || 'afro';
    const palette = SONG_PALETTE[song] ?? SONG_PALETTE.afro;
    const beat = Sound.beatPhase(this.time, 120);
    const flash = Math.pow(1 - beat, 3);
    const bar = Math.floor((this.time * 2) / 4);

    // Lasers: from the stage, through the window, sweeping the far walls and ceiling.
    frameToWorld(this.frame, { x: Rooftop.booth.x, y: Rooftop.booth.y + 2.2, z: Rooftop.booth.z }, this.from);
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      const s = this.time * cfg.sweepSpeed + b.phase;
      this.back.x = cfg.reachBack;
      this.back.z = Math.sin(s) * cfg.sweepWidth + Math.sin(s * 0.37 + i) * 0.6;
      this.back.y = 1.3 + Math.sin(s * 0.8 + i * 1.3) * 1.0;
      frameToWorld(this.frame, this.back, this.to);
      this.dir.subVectors(this.to, this.from);
      const len = this.dir.length();
      b.mesh.position.copy(this.from);
      b.mesh.quaternion.setFromUnitVectors(UP, this.dir.multiplyScalar(1 / len));
      b.mesh.scale.set(1, len, 1);
      b.mesh.visible = true;
      b.mat.color.setHex(palette[(i + bar) % palette.length]);
      b.mat.opacity = this.energy * (cfg.beamOpacity + cfg.beamFlash * flash);
    }

    // Spotlights (showcase room): coloured washes sliding across the walls and ceiling.
    const R = NycLayout.room;
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      const k = this.time * cfg.spotSpeed + i * Math.PI;
      this.from.copy(this.frame.origin).addScaledVector(this.frame.out, -0.4).addScaledVector(this.frame.along, i ? 1.2 : -1.2);
      this.from.y = R.height - 0.2;
      s.position.copy(this.from);
      this.spotTargets[i].position.set(R.minX + 0.2 + (1 + Math.sin(k * 0.6)) * 1.5, 0.6 + (1 + Math.sin(k * 1.3)) * 1.1, (R.minZ + R.maxZ) / 2 + Math.sin(k) * 2.6);
      this.color.setHex(palette[(i * 2 + bar) % palette.length]);
      s.color.copy(this.color);
      s.intensity = this.energy * (cfg.spotIntensity + cfg.spotFlash * flash);
    }
  }

  private place(d: import('@iwsdk/core').Entity): void {
    this.placedVersion = d.getValue(RoomSlots, 'windowVersion') ?? 0;
    this.frame.origin.fromArray(d.getVectorView(RoomSlots, 'windowOrigin'));
    this.frame.out.fromArray(d.getVectorView(RoomSlots, 'windowOut'));
    this.frame.along.fromArray(d.getVectorView(RoomSlots, 'windowAlong'));
    this.quat.identity();
  }
}
