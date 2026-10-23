import {
  Color,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Pressed,
  RayInteractable,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { DreamDirector, DreamSeed, GazeTarget, SeedState } from '../components/dream.js';
import { StageAnchor } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { findChapter } from '../dreams/registry.js';
import type { SeedDef } from '../dreams/types.js';
import { makeDiscMaterial, makeDwellRingMaterial } from '../visuals/glow-materials.js';

const dream = Tuning.dream;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
type SeedStateValue = (typeof SeedState)[keyof typeof SeedState];

interface SeedVisual {
  core: Mesh;
  coreMat: MeshStandardMaterial;
  halo: Mesh;
  haloMat: ShaderMaterial;
  ring: Mesh;
  ringMat: ShaderMaterial;
  focus: number;
  phase: number;
}

/**
 * Dream Seeds: spawns the seeds of the current choice beat, and makes
 * attention visible: a focused seed brightens and swells at once while a
 * dwell ring sweeps closed; looking away drains it gently. A completed dwell
 * or a pinch (ray select) blooms the seed; its siblings fade.
 */
export class DreamSeedSystem extends createSystem({
  director: { required: [DreamDirector] },
  stage: { required: [StageAnchor] },
  seeds: { required: [DreamSeed, GazeTarget] },
  pressed: { required: [DreamSeed, Pressed] },
}) {
  private visuals = new Map<Entity, SeedVisual>();
  private spawnedBeat = '';
  private time = 0;
  private camPos = new Vector3();
  private blooming = new Set<string>();
  private snapshot: Entity[] = [];

  init(): void {
    this.cleanupFuncs.push(
      this.queries.pressed.subscribe('qualify', (e) => {
        const state = e.getValue(DreamSeed, 'state');
        if (state !== SeedState.Idle && state !== SeedState.Appearing) return;
        if (this.blooming.has(e.getValue(DreamSeed, 'beatId') ?? '')) return;
        this.setState(e, SeedState.Blooming);
        e.setValue(DreamSeed, 'bloomedBy', 'pinch');
      }),
    );
  }

  update(delta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    this.time += delta;
    const beatId = d.getValue(DreamDirector, 'beatId') ?? '';
    const completed = !!d.getValue(DreamDirector, 'completed');
    const beat = findChapter(d.getValue(DreamDirector, 'chapterId') ?? '')?.beats[beatId];
    if (beat?.seeds && this.spawnedBeat !== beatId && !completed) {
      this.spawnedBeat = beatId;
      for (const seed of beat.seeds) this.spawn(seed, beatId);
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
      this.animate(s, v, state, t, delta);
    }
  }

  private animate(s: Entity, v: SeedVisual, state: SeedStateValue, t: number, delta: number): void {
    const focused = state === SeedState.Idle && !!s.getValue(GazeTarget, 'focused');
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
      if (dwell >= 1) {
        this.setState(s, SeedState.Blooming);
        s.setValue(DreamSeed, 'bloomedBy', 'gaze');
      }
    } else if (state === SeedState.Blooming) {
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

  private setState(s: Entity, state: SeedStateValue): SeedStateValue {
    s.setValue(DreamSeed, 'state', state);
    s.setValue(DreamSeed, 'stateTime', 0);
    if (state === SeedState.Blooming) this.blooming.add(s.getValue(DreamSeed, 'beatId') ?? '');
    return state;
  }

  private spawn(seed: SeedDef, beatId: string): void {
    const stage = this.queries.stage.entities.values().next().value;
    if (!stage) return;
    const color = new Color(Palette[seed.color]);
    const root = new Group();
    root.name = `Seed-${seed.id}`;
    root.position.set(seed.position[0], seed.position[1], seed.position[2]);
    const coreMat = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.6 });
    const core = new Mesh(new SphereGeometry(seed.radius, 20, 14), coreMat);
    core.castShadow = true;
    core.scale.setScalar(0.001);
    const haloMat = makeDiscMaterial(Palette[seed.color]);
    const halo = new Mesh(new PlaneGeometry(seed.radius * 5, seed.radius * 5), haloMat);
    const ringMat = makeDwellRingMaterial(Palette.starWhite);
    const ring = new Mesh(new PlaneGeometry(seed.radius * 3.4, seed.radius * 3.4), ringMat);
    ring.renderOrder = 3;
    root.add(core, halo, ring);
    const entity = this.world.createTransformEntity(root, { parent: stage });
    entity.addComponent(DreamSeed, { seedId: seed.id, branch: seed.branch, beatId, state: SeedState.Appearing });
    entity.addComponent(GazeTarget, { radius: seed.radius });
    entity.addComponent(RayInteractable);
    this.visuals.set(entity, { core, coreMat, halo, haloMat, ring, ringMat, focus: 0, phase: seed.position[0] * 10 });
  }
}
