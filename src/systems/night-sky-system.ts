import {
  BufferAttribute,
  BufferGeometry,
  createSystem,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
} from '@iwsdk/core';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { StageAnchor, StageSurface } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { makeStarMaterial, makeVignetteMaterial } from '../visuals/glow-materials.js';

const r = Tuning.ritual;
const VIGNETTE_RADIUS = 2.5;

/**
 * "Falling asleep": once the Dreamer sleeps, the real room dims behind a soft
 * head-locked vignette (never fully hidden) and stars drift above the table.
 */
export class NightSkySystem extends createSystem({
  director: { required: [Ritual, StageSurface] },
  stage: { required: [StageAnchor] },
}) {
  private vignette!: ShaderMaterial;
  private vignetteMesh!: Mesh;
  private stars?: { points: Points; mat: ShaderMaterial };
  private night = 0;
  private time = 0;

  init(): void {
    this.vignette = makeVignetteMaterial(Palette.nightTint);
    this.vignetteMesh = new Mesh(new SphereGeometry(VIGNETTE_RADIUS, 24, 16), this.vignette);
    this.vignetteMesh.name = 'NightVignette';
    this.vignetteMesh.renderOrder = -10;
    this.vignetteMesh.frustumCulled = false;
    this.vignetteMesh.visible = false;
    this.world.createTransformEntity(this.vignetteMesh, { parent: this.playerHeadEntity });
  }

  update(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    this.time += delta;
    const asleep = d.getValue(Ritual, 'phase') === RitualPhase.Asleep;
    if (asleep && !this.stars) this.buildStars(d.getValue(StageSurface, 'width') ?? 0.6);
    const target = asleep ? 1 : 0;
    this.night += Math.sign(target - this.night) * Math.min(Math.abs(target - this.night), delta / r.vignetteFadeSec);
    this.vignette.uniforms.opacity.value = r.vignetteOpacity * this.night;
    this.vignetteMesh.visible = this.night > 0.001;
    if (this.stars) {
      this.stars.mat.uniforms.opacity.value = this.night;
      this.stars.mat.uniforms.time.value = this.time;
    }
  }

  private buildStars(stageWidth: number): void {
    const root = this.queries.stage.entities.values().next().value?.object3D;
    if (!root) return;
    const n = r.starCount;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    // Deterministic scatter (golden-ratio sequence) so every night looks composed.
    const spread = Math.max(0.5, stageWidth * 0.9);
    for (let i = 0; i < n; i++) {
      const a = (i * 0.618034) % 1;
      const b = (i * 0.754878) % 1;
      const c = (i * 0.569840) % 1;
      pos[i * 3] = (a - 0.5) * spread * 1.6;
      pos[i * 3 + 1] = 0.22 + b * 0.5;
      pos[i * 3 + 2] = (c - 0.6) * spread;
      seed[i] = (i * 0.381966) % 1;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('seed', new BufferAttribute(seed, 1));
    const mat = makeStarMaterial(Palette.starWhite);
    const points = new Points(geo, mat);
    points.name = 'DriftingStars';
    points.frustumCulled = false;
    root.add(points);
    this.stars = { points, mat };
  }
}
