import {
  CanvasTexture,
  Color,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Pressed,
  RayInteractable,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DevControls, DreamDirector, DreamSeed, GazeTarget, SeedState } from '../components/dream.js';
import { Gestures } from '../components/hands.js';
import { Caption } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots, StageAnchor, StageSurface } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { isUnlocked } from '../dreams/chapter_bigfoot.js';
import { findChapter } from '../dreams/registry.js';
import { stageLocal, wallWorld } from '../dreams/stage-frame.js';
import type { SeedDef } from '../dreams/types.js';
import { makeDiscMaterial, makeDwellRingMaterial } from '../visuals/glow-materials.js';
import { dreamDelta } from '../dreams/beat-context.js';

const dream = Tuning.dream;
const FALL_DISTANCE = 0.3;
const FALL_SEC = 14;
const CATCH_PULL = 3;
const LOCKED_CAPTION = 'This dream opens tomorrow night.';
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
type SeedStateValue = (typeof SeedState)[keyof typeof SeedState];

interface SeedVisual {
  root: Object3D;
  core: Mesh;
  coreMat: MeshStandardMaterial;
  halo: Mesh;
  haloMat: ShaderMaterial;
  ring: Mesh;
  ringMat: ShaderMaterial;
  base: Vector3;
  def: SeedDef;
  age: number;
  focus: number;
  wasFocused: boolean;
  phase: number;
  caught: boolean;
  bloomSounded: boolean;
}

/**
 * Dream Seeds: spawns the seeds of the current choice beat (on the stage or on
 * the wall anchor) and makes attention visible — a soft chime and an instant
 * brighten when looked at, a dwell ring that sweeps closed, a gentle drain when
 * you look away. Dwell, a pinch, or (for catchable seeds) cupped hands bloom it.
 */
export class DreamSeedSystem extends createSystem({
  director: { required: [DreamDirector, DevControls, StageSurface, RoomSlots, Gestures, Session, Caption] },
  stage: { required: [StageAnchor] },
  seeds: { required: [DreamSeed, GazeTarget] },
  pressed: { required: [DreamSeed, Pressed] },
}) {
  private visuals = new Map<Entity, SeedVisual>();
  private spawnedBeat = '';
  private time = 0;
  private camPos = new Vector3();
  private seedPos = new Vector3();
  private cup = new Vector3();
  private blooming = new Set<string>();
  private snapshot: Entity[] = [];
  private generation = 0;
  private toldLocked = false;

  init(): void {
    this.cleanupFuncs.push(
      this.queries.pressed.subscribe('qualify', (e) => {
        const state = e.getValue(DreamSeed, 'state');
        if (state !== SeedState.Idle && state !== SeedState.Appearing) return;
        if (e.getValue(DreamSeed, 'locked')) return;
        if (this.blooming.has(e.getValue(DreamSeed, 'beatId') ?? '')) return;
        this.bloom(e, 'pinch');
      }),
    );
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const delta = dreamDelta(d, realDelta);
    this.time += delta;
    if (d.getValue(Session, 'generation') !== this.generation) {
      // "Restart dream": the same choice beat must spawn its seeds again.
      this.generation = d.getValue(Session, 'generation') ?? 0;
      this.spawnedBeat = '';
    }
    const beatId = d.getValue(DreamDirector, 'beatId') ?? '';
    const completed = !!d.getValue(DreamDirector, 'completed');
    const beat = findChapter(d.getValue(DreamDirector, 'chapterId') ?? '')?.beats[beatId];
    if (beat?.seeds && this.spawnedBeat !== beatId && !completed) {
      this.spawnedBeat = beatId;
      for (const seed of beat.seeds) this.spawn(d, seed, beatId);
    }

    this.blooming.clear();
    this.snapshot.length = 0;
    for (const s of this.queries.seeds.entities) {
      this.snapshot.push(s);
      if (s.getValue(DreamSeed, 'state') === SeedState.Blooming) {
        this.blooming.add(s.getValue(DreamSeed, 'beatId') ?? '');
      }
    }
    this.camera.getWorldPosition(this.camPos);
    const cupped = !!d.getValue(Gestures, 'cupped');
    if (cupped) this.cup.fromArray(d.getVectorView(Gestures, 'cupCenter'));

    for (const s of this.snapshot) {
      const v = this.visuals.get(s);
      if (!v) continue;
      const seedBeat = s.getValue(DreamSeed, 'beatId') ?? '';
      let state = s.getValue(DreamSeed, 'state') as SeedStateValue;
      const current = seedBeat === beatId && !completed;
      const siblingBlooming = state !== SeedState.Blooming && this.blooming.has(seedBeat);
      if (state !== SeedState.Fading && (!current || siblingBlooming)) {
        state = this.setState(s, SeedState.Fading);
      }
      const t = (s.getValue(DreamSeed, 'stateTime') ?? 0) + delta;
      s.setValue(DreamSeed, 'stateTime', t);
      if (state === SeedState.Fading && t >= dream.seedFadeSec) {
        this.visuals.delete(s);
        s.dispose();
        continue;
      }
      v.age += delta;
      if (s.getValue(DreamSeed, 'locked')) {
        this.animateLocked(d, s, v, state, t);
        continue;
      }
      if (state === SeedState.Idle) this.move(s, v, cupped, delta);
      this.animate(s, v, state, t, delta);
    }
  }

  /** Falling motion and the cupped-hands catch for seeds that support them. */
  private move(s: Entity, v: SeedVisual, cupped: boolean, delta: number): void {
    if (v.def.motion === 'fall' && !v.caught) {
      v.root.position.y = v.base.y - FALL_DISTANCE * ease(clamp01(v.age / FALL_SEC));
    }
    if (!v.def.catchable || !cupped) return;
    v.root.getWorldPosition(this.seedPos);
    const dx = this.cup.x - this.seedPos.x;
    const dz = this.cup.z - this.seedPos.z;
    if (Math.hypot(dx, dz) > Tuning.gestures.catchRadius || this.cup.y > this.seedPos.y + 0.05) return;
    v.caught = true;
    this.seedPos.lerp(this.cup, Math.min(1, CATCH_PULL * delta));
    const close = this.seedPos.distanceTo(this.cup) < 0.05;
    v.root.parent?.worldToLocal(this.seedPos);
    v.root.position.copy(this.seedPos);
    if (close) this.bloom(s, 'catch');
  }

  private animate(s: Entity, v: SeedVisual, state: SeedStateValue, t: number, delta: number): void {
    const focused = state === SeedState.Idle && !!s.getValue(GazeTarget, 'focused');
    if (focused && !v.wasFocused) {
      v.root.getWorldPosition(this.seedPos);
      Sound.play('chime', this.seedPos, 0.6);
    }
    v.wasFocused = focused;
    v.focus += ((focused ? 1 : 0) - v.focus) * Math.min(1, 8 * delta);
    let dwell = s.getValue(DreamSeed, 'dwell') ?? 0;
    let scale = 1;
    let glow = 0.5 + 1.1 * v.focus;
    let halo = 0.45 + 0.5 * v.focus;
    let ring = 0;

    if (state === SeedState.Appearing) {
      scale = ease(clamp01(t / dream.seedAppearSec));
      halo *= scale;
      ring = 0.6 * scale;
      if (t >= dream.seedAppearSec) this.setState(s, SeedState.Idle);
    } else if (state === SeedState.Idle) {
      const dwellSec = Tuning.gaze.dwellSec;
      if (focused) {
        dwell += delta / dwellSec;
        s.setValue(DreamSeed, 'lookTotal', (s.getValue(DreamSeed, 'lookTotal') ?? 0) + delta);
      } else {
        dwell -= (delta * dream.dwellDecayRatio) / dwellSec;
      }
      dwell = clamp01(dwell);
      s.setValue(DreamSeed, 'dwell', dwell);
      scale = 1 + 0.18 * v.focus + 0.04 * Math.sin(this.time * 2 + v.phase);
      // The faint ring track is always shown on an idle seed: it marks it as "look here".
      ring = 0.6 + 0.4 * Math.max(v.focus, dwell);
      if (dwell >= 1) this.bloom(s, 'gaze');
    } else if (state === SeedState.Blooming) {
      if (!v.bloomSounded) {
        v.bloomSounded = true;
        v.root.getWorldPosition(this.seedPos);
        Sound.play(s.getValue(DreamSeed, 'bloomedBy') === 'catch' ? 'catch' : 'bloom', this.seedPos);
      }
      const k = clamp01(t / dream.seedBloomSec);
      scale = 1.18 + 1.2 * ease(k);
      glow = 0.6 + 2.4 * (1 - k);
      halo = 1 - 0.4 * k;
    } else {
      const k = clamp01(t / dream.seedFadeSec);
      scale = (1 - ease(k)) * (1 + 0.18 * v.focus);
      halo *= 1 - k;
    }

    v.core.scale.setScalar(Math.max(0.001, scale));
    v.coreMat.emissiveIntensity = glow;
    v.haloMat.uniforms.opacity.value = halo;
    v.halo.scale.setScalar(Math.max(0.001, 0.6 + 0.4 * scale));
    v.ringMat.uniforms.opacity.value = ring;
    v.ringMat.uniforms.progress.value = dwell;
    v.halo.lookAt(this.camPos);
    v.ring.lookAt(this.camPos);
  }

  /** A dream that isn't open yet: a dim, still light; a look explains why. */
  private animateLocked(d: Entity, s: Entity, v: SeedVisual, state: SeedStateValue, t: number): void {
    let scale = 0.75;
    if (state === SeedState.Appearing) {
      scale *= ease(clamp01(t / dream.seedAppearSec));
      if (t >= dream.seedAppearSec) this.setState(s, SeedState.Idle);
    } else if (state === SeedState.Fading) {
      scale *= 1 - ease(clamp01(t / dream.seedFadeSec));
    } else if (s.getValue(GazeTarget, 'focused') && !this.toldLocked) {
      this.toldLocked = true;
      d.setValue(Caption, 'text', LOCKED_CAPTION);
      d.setValue(Caption, 'ttl', 4);
    }
    v.core.scale.setScalar(Math.max(0.001, scale));
    v.coreMat.emissiveIntensity = 0.12;
    v.haloMat.uniforms.opacity.value = 0.12 * scale;
    v.ringMat.uniforms.opacity.value = 0;
    v.halo.lookAt(this.camPos);
  }

  private bloom(s: Entity, how: 'gaze' | 'pinch' | 'catch'): void {
    this.setState(s, SeedState.Blooming);
    s.setValue(DreamSeed, 'bloomedBy', how);
  }

  private setState(s: Entity, state: SeedStateValue): SeedStateValue {
    s.setValue(DreamSeed, 'state', state);
    s.setValue(DreamSeed, 'stateTime', 0);
    if (state === SeedState.Blooming) this.blooming.add(s.getValue(DreamSeed, 'beatId') ?? '');
    return state;
  }

  private spawn(d: Entity, seed: SeedDef, beatId: string): void {
    const stage = this.queries.stage.entities.values().next().value;
    const onWall = seed.anchor === 'wall';
    if (!stage && !onWall) return;
    const pos = new Vector3();
    if (onWall) {
      if (!d.getValue(RoomSlots, 'anchorReady')) return;
      wallWorld(seed, d.getVectorView(RoomSlots, 'anchorPoint'), d.getVectorView(RoomSlots, 'anchorNormal'), pos);
    } else {
      stageLocal(seed, d.getValue(StageSurface, 'width') ?? 0.6, d.getValue(StageSurface, 'depth') ?? 0.4, pos);
    }
    const locked = !isUnlocked(seed.branch, d.getValue(Session, 'night') ?? 1, !!d.getValue(Session, 'unlockAll'));
    const color = new Color(locked ? Palette.lockedGrey : Palette[seed.color]);
    const root = new Group();
    root.name = `Seed-${seed.id}`;
    root.position.copy(pos);
    const coreMat = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.6 });
    const core = new Mesh(new SphereGeometry(seed.radius, 20, 14), coreMat);
    core.castShadow = !onWall;
    core.scale.setScalar(0.001);
    const haloMat = makeDiscMaterial(locked ? Palette.lockedGrey : Palette[seed.color]);
    const halo = new Mesh(new PlaneGeometry(seed.radius * 5, seed.radius * 5), haloMat);
    const ringMat = makeDwellRingMaterial(Palette.starWhite);
    const ring = new Mesh(new PlaneGeometry(seed.radius * 3.4, seed.radius * 3.4), ringMat);
    ring.renderOrder = 3;
    root.add(core, halo, ring);
    if (seed.label) core.add(seedLabel(locked ? `${seed.label} - tomorrow` : seed.label, seed.radius));
    const entity = onWall || !stage
      ? this.world.createTransformEntity(root)
      : this.world.createTransformEntity(root, { parent: stage });
    entity.addComponent(DreamSeed, { seedId: seed.id, branch: seed.branch, beatId, state: SeedState.Appearing, locked });
    entity.addComponent(GazeTarget, { radius: seed.radius });
    if (!locked) entity.addComponent(RayInteractable);
    this.visuals.set(entity, {
      root, core, coreMat, halo, haloMat, ring, ringMat,
      base: pos.clone(),
      def: seed,
      age: 0,
      focus: 0,
      wasFocused: false,
      phase: seed.position[0] * 10,
      caught: false,
      bloomSounded: false,
    });
  }
}

/** A readable name tag under a seed (camera-facing). Lives in the seed's core, so it grows and fades with it. */
function seedLabel(text: string, radius: number): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const g = canvas.getContext('2d');
  if (g) {
    g.font = '600 52px system-ui, "Segoe UI", Roboto, sans-serif';
    const w = Math.min(500, g.measureText(text).width + 56);
    g.fillStyle = 'rgba(14, 12, 40, 0.72)';
    g.beginPath();
    g.roundRect((512 - w) / 2, 12, w, 88, 44);
    g.fill();
    g.fillStyle = '#fdfcff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 58);
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false }));
  sprite.name = 'SeedLabel';
  const width = radius * 3.6;
  sprite.scale.set(width, (width * 112) / 512, 1);
  sprite.position.y = -radius * 2.1;
  sprite.renderOrder = 4;
  return sprite;
}
