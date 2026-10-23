import {
  createSystem,
  DirectionalLight,
  Entity,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PlaneGeometry,
  ShaderMaterial,
  ShadowMaterial,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { StageAnchor, StageSource, StageSurface } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { makeDiscMaterial, makeRingMaterial, makeSoftRectMaterial } from '../visuals/glow-materials.js';

const r = Tuning.ritual;
const RING_SIZE = 0.16;
const MERGED_SIZE = 0.42;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/**
 * Builds the stage once calibrated: the two-rings-merge animation, the night
 * tint on the real table, the moonlight + shadow catcher that ground dream
 * objects, and the cloud platform for mid-air stages.
 */
export class StageEffectsSystem extends createSystem({
  director: { required: [Ritual, StageSurface] },
}) {
  private root?: Group;
  private rings: { mesh: Mesh; mat: ShaderMaterial; start: Vector3 }[] = [];
  private merged?: { mesh: Mesh; mat: ShaderMaterial };
  private tint?: ShaderMaterial;
  private time = 0;
  private sinceStage = 0;

  update(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const phase = d.getValue(Ritual, 'phase');
    if (!this.root) {
      if (phase === RitualPhase.Idle || phase === RitualPhase.Arrival) return;
      this.buildStage(d);
    }
    this.time += delta;
    this.sinceStage += delta;
    this.animateRings();
    if (this.tint) {
      this.tint.uniforms.opacity.value = r.tintOpacity * ease(clamp01(this.sinceStage / r.tintFadeSec));
    }
  }

  private buildStage(d: Entity): void {
    const center = d.getVectorView(StageSurface, 'center');
    const width = d.getValue(StageSurface, 'width') ?? Tuning.stage.defaultWidth;
    const depth = d.getValue(StageSurface, 'depth') ?? Tuning.stage.defaultDepth;
    const source = d.getValue(StageSurface, 'source');
    const root = new Group();
    root.name = 'Stage';
    root.position.set(center[0], center[1], center[2]);
    root.rotation.y = d.getValue(StageSurface, 'yaw') ?? 0;
    this.world.createTransformEntity(root).addComponent(StageAnchor);
    root.updateMatrixWorld(true);
    this.root = root;

    if (source === StageSource.Air) root.add(buildCloudPlatform(width, depth));

    this.tint = makeSoftRectMaterial(Palette.nightTint);
    const tint = new Mesh(new PlaneGeometry(width, depth), this.tint);
    tint.name = 'NightTint';
    tint.rotation.x = -Math.PI / 2;
    tint.position.y = 0.002;
    tint.renderOrder = 1;
    root.add(tint);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    const catcher = new Mesh(
      new PlaneGeometry(width, depth),
      new ShadowMaterial({ opacity: r.shadowOpacity, color: Palette.indigoDeep }),
    );
    catcher.name = 'ShadowCatcher';
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.003;
    catcher.receiveShadow = true;
    root.add(catcher);

    const moon = new DirectionalLight(Palette.moonBlueSoft, 1.4);
    moon.name = 'Moonlight';
    moon.position.set(0.25, 1.1, -0.35);
    moon.castShadow = true;
    moon.shadow.mapSize.set(512, 512);
    const half = Math.max(width, depth) * 0.6;
    const cam = moon.shadow.camera;
    cam.left = cam.bottom = -half;
    cam.right = cam.top = half;
    cam.near = 0.1;
    cam.far = 2;
    moon.shadow.radius = 4;
    moon.shadow.bias = -0.0005;
    root.add(moon);
    moon.target.position.set(0, 0, 0);
    root.add(moon.target);

    const ringGeo = new PlaneGeometry(1, 1);
    const palms = [d.getVectorView(Ritual, 'leftPalm'), d.getVectorView(Ritual, 'rightPalm')];
    for (const p of palms) {
      const mat = makeRingMaterial(Palette.starWhite);
      const mesh = new Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      const start = root.worldToLocal(new Vector3(p[0], p[1], p[2]));
      start.y = 0.004;
      mesh.position.copy(start);
      root.add(mesh);
      this.rings.push({ mesh, mat, start });
    }
    const mergedMat = makeRingMaterial(Palette.moonBlueSoft);
    const merged = new Mesh(ringGeo, mergedMat);
    merged.name = 'MergedRing';
    merged.rotation.x = -Math.PI / 2;
    merged.position.y = 0.005;
    merged.visible = false;
    root.add(merged);
    this.merged = { mesh: merged, mat: mergedMat };
  }

  private animateRings(): void {
    const t = this.sinceStage;
    const growEnd = r.ringGrowSec;
    const mergeEnd = growEnd + r.ringMergeSec;
    const fadeEnd = mergeEnd + r.ringFadeSec;
    for (const ring of this.rings) {
      ring.mat.uniforms.time.value = this.time;
      if (t < growEnd) {
        const g = ease(t / growEnd);
        ring.mesh.scale.setScalar(RING_SIZE * (0.4 + 0.6 * g));
        ring.mat.uniforms.opacity.value = g;
      } else if (t < mergeEnd) {
        const m = ease((t - growEnd) / r.ringMergeSec);
        ring.mesh.position.set(ring.start.x * (1 - m), ring.start.y, ring.start.z * (1 - m));
        ring.mesh.scale.setScalar(RING_SIZE * (1 + 0.6 * m));
        ring.mat.uniforms.opacity.value = 1 - 0.6 * m;
      } else {
        ring.mesh.visible = false;
      }
    }
    if (!this.merged) return;
    this.merged.mat.uniforms.time.value = this.time;
    const show = t >= growEnd + r.ringMergeSec * 0.7 && t < fadeEnd;
    this.merged.mesh.visible = show;
    if (show) {
      const f = clamp01((t - growEnd - r.ringMergeSec * 0.7) / (fadeEnd - growEnd - r.ringMergeSec * 0.7));
      this.merged.mesh.scale.setScalar(MERGED_SIZE * (0.5 + 0.5 * ease(f)));
      this.merged.mat.uniforms.opacity.value = Math.sin(Math.PI * f);
    }
  }
}

/** A soft glowing cloud slab that stands in for a table when calibrated in mid-air. */
function buildCloudPlatform(width: number, depth: number): Group {
  const cloud = new Group();
  cloud.name = 'CloudPlatform';
  const fluff = new MeshStandardMaterial({
    color: Palette.moonBlueSoft,
    emissive: Palette.moonBlue,
    emissiveIntensity: 0.25,
    roughness: 1,
    transparent: true,
    opacity: 0.9,
  });
  const geo = new SphereGeometry(1, 14, 10);
  const puffs = 9;
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * Math.PI * 2;
    const puff = new Mesh(geo, fluff);
    puff.position.set(Math.cos(a) * width * 0.36, -0.025, Math.sin(a) * depth * 0.34);
    puff.scale.set(width * 0.2, 0.03, depth * 0.24);
    puff.receiveShadow = true;
    cloud.add(puff);
  }
  const core = new Mesh(geo, fluff);
  core.position.y = -0.022;
  core.scale.set(width * 0.48, 0.022, depth * 0.48);
  core.receiveShadow = true;
  cloud.add(core);
  const glow = new Mesh(new PlaneGeometry(width * 1.3, depth * 1.3), makeDiscMaterial(Palette.moonBlue));
  (glow.material as ShaderMaterial).uniforms.opacity.value = 0.5;
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.05;
  cloud.add(glow);
  return cloud;
}
