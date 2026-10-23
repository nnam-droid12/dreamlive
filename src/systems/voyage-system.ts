import {
  BufferAttribute,
  BufferGeometry,
  Color,
  createSystem,
  CylinderGeometry,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Ritual } from '../components/ritual.js';
import { StageAnchor, StageSurface } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { foldAmount, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { PaperSeaLayout } from '../dreams/chapter1_paperSea.js';
import { createDreamFish } from '../scene-assets/dream-fish.scene-asset.js';
import { createDreamer } from '../scene-assets/dreamer.scene-asset.js';
import { createPaperBoat } from '../scene-assets/paper-boat.scene-asset.js';
import { makeDiscMaterial, makeTrailMaterial } from '../visuals/glow-materials.js';
import { waveHeight } from '../visuals/paper-sea.js';

const TRAIL_COUNT = 180;
const TRAIL_LIFE = 6;
const TRAIL_EVERY = 0.05;
const TINY_SCALE = 0.42;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Stage-normalized boat waypoints. */
const SPOT = {
  launch: [-0.45, -0.1],
  drift: [-0.15, -0.05],
  nearLighthouse: [-0.4, -0.5],
  stormDrift: [0.3, -0.35],
  dock: [0.2, -0.18],
} as const;

/**
 * The voyage: a paper boat carrying the tiny (awake) Dreamer across the sea.
 * Lighthouse branch: it sails toward the light. Fish branch: the big fish
 * surfaces, carries the boat on its back and leaves glowing trails. The star
 * branch adds a guiding light. Every path ends at an island of light.
 */
export class VoyageSystem extends createSystem({
  director: { required: [DreamDirector, Ritual, DevControls, StageSurface] },
  stage: { required: [StageAnchor] },
}) {
  private boat?: Object3D;
  private tiny?: Object3D;
  private tinyBody?: Object3D;
  private fish?: Object3D;
  private fishTail?: Object3D;
  private island?: Object3D;
  private guide?: Mesh;
  private guideMat?: MeshBasicMaterial;
  private trail?: { geo: BufferGeometry; mat: ShaderMaterial; next: number; timer: number };
  private beat = newBeatContext();
  private width = 0.6;
  private depth = 0.4;
  private time = 0;
  private storm = 0;
  private lastScene = '';
  private sceneStart = new Vector3();
  private boatPos = new Vector3();
  private target = new Vector3();
  private fishPos = new Vector3();
  private prev = new Vector3();
  private world3 = new Vector3();
  private heading = 0;
  private riding = false;
  private boatAppear = 0;
  private fishLevel = 0;
  private islandRise = 0;
  private guideLevel = 0;

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !readBeat(d, this.beat)) return;
    const delta = realDelta * (d.getValue(DevControls, 'timeScale') ?? 1);
    if (!this.boat) {
      const stage = this.queries.stage.entities.values().next().value;
      if (!stage) return;
      this.build(d, stage);
    }
    this.time += delta;
    const scene = this.beat.scene;
    const p = this.beat.progress;
    if (scene !== this.lastScene) this.onScene(scene);
    const fold = foldAmount(d.getValue(Ritual, 'phase') ?? '', d.getValue(Ritual, 'phaseTime') ?? 0, Tuning.waking.foldSec);
    this.storm += ((scene === 'storm' ? 1 : 0) - this.storm) * Math.min(1, delta * 0.8);

    this.boatAppear = scene === 'sea-rise' ? clamp01((p - 0.5) / 0.3) : Math.min(1, this.boatAppear + delta);
    this.chooseTarget(scene, p);
    this.prev.copy(this.boatPos);
    this.boatPos.lerp(this.target, Math.min(1, delta * 1.5));
    const dx = this.boatPos.x - this.prev.x;
    const dz = this.boatPos.z - this.prev.z;
    if (dx * dx + dz * dz > 1e-9) {
      let diff = Math.atan2(dx, dz) - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * Math.min(1, delta * 2.5);
    }
    const bob = waveHeight(this.boatPos.x, this.boatPos.z, this.time, this.storm);
    const b = this.boat!;
    b.position.set(this.boatPos.x, (this.riding ? 0.045 : 0.004) + bob, this.boatPos.z);
    b.rotation.set(
      Math.sin(this.time * 1.3) * (0.03 + this.storm * 0.12),
      this.heading,
      Math.sin(this.time * 1.7) * (0.04 + this.storm * 0.18),
    );
    b.scale.setScalar(Math.max(0.001, ease(this.boatAppear) * (1 - ease(fold))));
    if (this.tinyBody) {
      const lookUp = scene === 'island' ? ease(clamp01(p * 2)) : 0;
      this.tinyBody.rotation.x = -0.4 * lookUp;
    }

    this.updateFish(scene, delta, fold);
    this.updateIsland(scene, delta, fold);
    this.updateGuide(scene, delta, fold);
  }

  private chooseTarget(scene: string, p: number): void {
    const glide = (to: readonly [number, number], k: number) =>
      this.target.set(
        this.sceneStart.x + ((to[0] * this.width) / 2 - this.sceneStart.x) * ease(clamp01(k)),
        0,
        this.sceneStart.z + ((to[1] * this.depth) / 2 - this.sceneStart.z) * ease(clamp01(k)),
      );
    switch (scene) {
      case 'sea-rise':
        this.target.set((SPOT.launch[0] * this.width) / 2, 0, (SPOT.launch[1] * this.depth) / 2);
        if (this.boatAppear === 0) this.boatPos.copy(this.target);
        break;
      case 'drift':
        glide(SPOT.drift, p);
        break;
      case 'lighthouse':
        glide(SPOT.nearLighthouse, p / 0.6);
        if (p > 0.6) {
          const a = (p - 0.6) * 9;
          this.target.x += Math.sin(a) * 0.04;
          this.target.z += (1 - Math.cos(a)) * 0.03;
        }
        break;
      case 'fish': {
        if (p < 0.15) {
          this.target.copy(this.boatPos);
          break;
        }
        this.riding = true;
        const a = ((p - 0.15) / 0.85) * Math.PI * 2 - Math.PI / 2;
        this.target.set(Math.cos(a) * this.width * 0.26, 0, -this.depth * 0.08 + Math.sin(a) * this.depth * 0.22);
        break;
      }
      case 'storm':
        glide(SPOT.stormDrift, p);
        break;
      case 'star':
      case 'door':
      case 'island':
        glide(SPOT.dock, scene === 'island' ? 1 : p);
        break;
      default:
        this.target.copy(this.boatPos);
    }
  }

  private onScene(scene: string): void {
    this.lastScene = scene;
    this.sceneStart.copy(this.boatPos);
    if (scene === 'fish' && this.fish) {
      this.fish.getWorldPosition(this.world3);
      Sound.play('splash', this.world3);
    }
    if (scene === 'storm') this.riding = false;
  }

  private updateFish(scene: string, delta: number, fold: number): void {
    const f = this.fish!;
    const shown = scene === 'drift' || scene === 'choice-1' || scene === 'fish';
    this.fishLevel += ((shown ? 1 : 0) - this.fishLevel) * Math.min(1, delta * 0.8);
    f.visible = this.fishLevel > 0.01;
    if (!f.visible) return;
    const [u, v] = PaperSeaLayout.fishRise;
    if (scene === 'fish') {
      const toBoat = this.riding ? 1 : clamp01(this.beat.progress / 0.15);
      this.fishPos.set((u * this.width) / 2, 0, (v * this.depth) / 2).lerp(this.boatPos, ease(toBoat));
      f.position.set(this.fishPos.x, this.riding ? 0.004 : -0.02 + 0.024 * toBoat, this.fishPos.z);
      f.rotation.y = this.heading;
    } else {
      f.position.set((u * this.width) / 2 + Math.sin(this.time * 0.4) * 0.02, -0.035 + 0.015 * this.fishLevel, (v * this.depth) / 2);
      f.rotation.y = Math.PI * 0.75 + Math.sin(this.time * 0.4) * 0.3;
    }
    f.scale.setScalar(Math.max(0.001, this.fishLevel * (1 - ease(fold))));
    if (this.fishTail) this.fishTail.rotation.y = Math.sin(this.time * (this.riding ? 5 : 2.5)) * 0.45;

    const t = this.trail!;
    t.mat.uniforms.time.value = this.time;
    if (!this.riding) return;
    t.timer -= delta;
    if (t.timer > 0) return;
    t.timer = TRAIL_EVERY;
    const pos = t.geo.getAttribute('position') as BufferAttribute;
    const birth = t.geo.getAttribute('birth') as BufferAttribute;
    pos.setXYZ(t.next, f.position.x + (Math.random() - 0.5) * 0.02, 0.007, f.position.z + (Math.random() - 0.5) * 0.02);
    birth.setX(t.next, this.time);
    pos.needsUpdate = birth.needsUpdate = true;
    t.next = (t.next + 1) % TRAIL_COUNT;
  }

  private updateIsland(scene: string, delta: number, fold: number): void {
    const target = scene === 'island' ? 1 : 0;
    this.islandRise += (target - this.islandRise) * Math.min(1, delta * 0.7);
    const isl = this.island!;
    isl.visible = this.islandRise > 0.01;
    isl.position.y = -0.03 + 0.03 * ease(this.islandRise);
    isl.scale.set(1, Math.max(0.001, 1 - ease(fold)), 1);
  }

  private updateGuide(scene: string, delta: number, fold: number): void {
    const on = scene === 'star' || (scene === 'island' && this.guideLevel > 0.05);
    this.guideLevel += ((on ? 1 : 0) - this.guideLevel) * Math.min(1, delta * 1.2);
    const g = this.guide!;
    g.visible = this.guideLevel > 0.01;
    if (!g.visible) return;
    const [iu, iv] = PaperSeaLayout.island;
    const over = scene === 'island';
    g.position.set(
      over ? (iu * this.width) / 2 : this.boatPos.x,
      0.16 + Math.sin(this.time * 1.8) * 0.01,
      over ? (iv * this.depth) / 2 : this.boatPos.z - 0.03,
    );
    g.scale.setScalar(Math.max(0.001, this.guideLevel * (1 - ease(fold))));
    this.guideMat!.opacity = this.guideLevel;
  }

  private build(d: Entity, stage: Entity): void {
    this.width = d.getValue(StageSurface, 'width') ?? 0.6;
    this.depth = d.getValue(StageSurface, 'depth') ?? 0.4;
    const root = new Group();
    root.name = 'Voyage';
    this.world.createTransformEntity(root, { parent: stage });

    this.boat = createPaperBoat();
    this.boat.scale.setScalar(0.001);
    this.tiny = createDreamer();
    this.tiny.name = 'TinyDreamer';
    this.tiny.scale.setScalar(TINY_SCALE);
    this.tiny.traverse((o) => {
      if (o.name === 'Lid') o.rotation.x = -0.7;
      if (o.name === 'ContactGlow') o.visible = false;
    });
    this.tinyBody = this.tiny.getObjectByName('Body');
    this.boat.getObjectByName('Seat')?.add(this.tiny);
    root.add(this.boat);

    this.fish = createDreamFish();
    this.fish.scale.setScalar(0.001);
    this.fishTail = this.fish.getObjectByName('Tail');
    root.add(this.fish);

    const trailGeo = new BufferGeometry();
    trailGeo.setAttribute('position', new BufferAttribute(new Float32Array(TRAIL_COUNT * 3), 3));
    trailGeo.setAttribute('birth', new BufferAttribute(new Float32Array(TRAIL_COUNT).fill(-1000), 1));
    const trailMat = makeTrailMaterial(Palette.moonBlueSoft, TRAIL_LIFE);
    const trail = new Points(trailGeo, trailMat);
    trail.name = 'BioluminescentTrail';
    trail.frustumCulled = false;
    root.add(trail);
    this.trail = { geo: trailGeo, mat: trailMat, next: 0, timer: 0 };

    this.island = buildIsland();
    const [iu, iv] = PaperSeaLayout.island;
    this.island.position.set((iu * this.width) / 2, -0.03, (iv * this.depth) / 2);
    this.island.visible = false;
    root.add(this.island);

    this.guideMat = new MeshBasicMaterial({ color: Palette.starWhite, transparent: true });
    this.guide = new Mesh(new SphereGeometry(0.012, 12, 8), this.guideMat);
    this.guide.name = 'GuideStar';
    const halo = new Mesh(new PlaneGeometry(0.09, 0.09), makeDiscMaterial(Palette.starWhite));
    (halo.material as ShaderMaterial).uniforms.opacity.value = 0.8;
    this.guide.add(halo);
    this.guide.visible = false;
    root.add(this.guide);
  }
}

/** A small mound of warm light with a lantern post. Origin = water level. */
function buildIsland(): Group {
  const g = new Group();
  g.name = 'IslandOfLight';
  const mound = new Mesh(
    new SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new MeshStandardMaterial({
      color: Palette.paper,
      emissive: new Color(Palette.lanternGlow),
      emissiveIntensity: 0.35,
      roughness: 1,
      flatShading: true,
    }),
  );
  mound.scale.set(0.09, 0.035, 0.07);
  mound.castShadow = true;
  const glow = new Mesh(new PlaneGeometry(0.34, 0.3), makeDiscMaterial(Palette.lanternGlow));
  (glow.material as ShaderMaterial).uniforms.opacity.value = 0.7;
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.006;
  const post = new Mesh(new CylinderGeometry(0.002, 0.003, 0.06, 6), new MeshStandardMaterial({ color: Palette.paperShade }));
  post.position.set(0.02, 0.06, 0);
  const lamp = new Mesh(new SphereGeometry(0.008, 10, 8), new MeshBasicMaterial({ color: Palette.lanternGlow }));
  lamp.position.set(0.02, 0.092, 0);
  g.add(mound, glow, post, lamp);
  return g;
}
