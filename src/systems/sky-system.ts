import {
  BufferAttribute,
  BufferGeometry,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
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
import { RoomSlots, StageAnchor, StageSurface } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { foldAmount, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { createStorybookDoor } from '../scene-assets/storybook-door.scene-asset.js';
import { makeSoftRectMaterial, makeStarMaterial } from '../visuals/glow-materials.js';

const DOOR_DROP = 0.32;
const LANTERNS = 6;
const SKY_STARS = 240;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/**
 * Wall and sky moments: the storybook door on the real wall (choice 2; on the
 * door branch it opens and a ribbon of light carries lanterns down to the sea)
 * and the closing sky of stars on the real ceiling (or a dome over the table).
 */
export class SkySystem extends createSystem({
  director: { required: [DreamDirector, Ritual, DevControls, StageSurface, RoomSlots] },
  stage: { required: [StageAnchor] },
}) {
  private door?: Object3D;
  private panel?: Object3D;
  private doorLight?: MeshBasicMaterial;
  private ribbon?: Mesh;
  private ribbonMat?: ShaderMaterial;
  private lanterns: Mesh[] = [];
  private sky?: { points: Points; mat: ShaderMaterial };
  private beat = newBeatContext();
  private doorLevel = 0;
  private open = 0;
  private skyLevel = 0;
  private time = 0;
  private lastScene = '';
  private doorBase = new Vector3();
  private seaEdge = new Vector3();
  private tmp = new Vector3();

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !readBeat(d, this.beat)) return;
    const delta = realDelta * (d.getValue(DevControls, 'timeScale') ?? 1);
    this.time += delta;
    const scene = this.beat.scene;
    const fold = foldAmount(d.getValue(Ritual, 'phase') ?? '', d.getValue(Ritual, 'phaseTime') ?? 0, Tuning.waking.foldSec);
    if (scene === 'choice-2' && !this.door) this.buildDoor(d);
    if (scene === 'island' && !this.sky) this.buildSky(d);
    if (scene !== this.lastScene) {
      this.lastScene = scene;
      if (scene === 'door' && this.door) {
        this.door.getWorldPosition(this.tmp);
        Sound.play('door', this.tmp);
      }
    }
    if (this.door) this.updateDoor(scene, delta, fold);
    if (this.sky) {
      const target = scene === 'island' && fold === 0 ? 1 : 0;
      this.skyLevel += (target - this.skyLevel) * Math.min(1, delta * (target ? 0.5 : 1.2));
      this.sky.mat.uniforms.opacity.value = this.skyLevel;
      this.sky.mat.uniforms.time.value = this.time;
      this.sky.points.visible = this.skyLevel > 0.005;
    }
  }

  private updateDoor(scene: string, delta: number, fold: number): void {
    const opening = scene === 'door' || (scene === 'island' && this.open > 0.5);
    const shown = scene === 'choice-2' || opening;
    this.doorLevel += ((shown ? 1 : 0) - this.doorLevel) * Math.min(1, delta * 1.5);
    const level = this.doorLevel * (1 - ease(fold));
    this.door!.visible = level > 0.01;
    this.door!.scale.set(1, Math.max(0.001, ease(level)), 1);
    if (opening) this.open = Math.min(1, this.open + delta * 0.5);
    this.panel!.rotation.y = -1.7 * ease(this.open);
    this.doorLight!.opacity = 0.25 + 0.75 * this.open;

    const flow = scene === 'door' ? clamp01(this.beat.progress * 1.3) : opening ? 1 : 0;
    this.ribbonMat!.uniforms.opacity.value = 0.55 * this.open * level;
    this.ribbon!.visible = this.open > 0.05 && level > 0.01;
    for (let i = 0; i < this.lanterns.length; i++) {
      const k = clamp01(flow * 1.6 - i * 0.12);
      const l = this.lanterns[i];
      l.visible = k > 0 && level > 0.01;
      this.tmp.lerpVectors(this.doorBase, this.seaEdge, ease(k));
      this.tmp.y += Math.sin(k * Math.PI) * 0.08 + Math.sin(this.time * 2 + i) * 0.004;
      this.tmp.x += Math.sin(i * 2.3) * 0.06 * k;
      l.position.copy(this.tmp);
      l.scale.setScalar(Math.max(0.001, level));
    }
  }

  private buildDoor(d: Entity): void {
    if (!d.getValue(RoomSlots, 'anchorReady')) return;
    const anchor = new Vector3().fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    const normal = new Vector3().fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    const group = new Group();
    group.name = 'DoorMoment';
    this.world.createTransformEntity(group);
    this.door = createStorybookDoor();
    this.door.position.copy(anchor).addScaledVector(normal, 0.008);
    this.door.position.y -= DOOR_DROP;
    this.door.lookAt(this.tmp.copy(this.door.position).add(normal));
    this.door.scale.set(1, 0.001, 1);
    this.panel = this.door.getObjectByName('Panel');
    this.doorLight = (this.door.getObjectByName('Light') as Mesh).material as MeshBasicMaterial;
    group.add(this.door);

    this.doorBase.copy(this.door.position).addScaledVector(normal, 0.05);
    this.doorBase.y += 0.02;
    const c = d.getVectorView(StageSurface, 'center');
    const depth = d.getValue(StageSurface, 'depth') ?? 0.4;
    this.seaEdge.set(c[0], c[1] + 0.012, c[2]);
    this.tmp.subVectors(this.doorBase, this.seaEdge).setY(0).normalize();
    this.seaEdge.addScaledVector(this.tmp, depth * 0.35);

    this.ribbonMat = makeSoftRectMaterial(Palette.lanternGlow);
    this.ribbonMat.uniforms.feather.value = 0.35;
    const length = this.doorBase.distanceTo(this.seaEdge);
    this.ribbon = new Mesh(new PlaneGeometry(0.1, length), this.ribbonMat);
    this.ribbon.name = 'LightRibbon';
    this.ribbon.position.lerpVectors(this.doorBase, this.seaEdge, 0.5);
    this.ribbon.lookAt(this.seaEdge);
    this.ribbon.rotateX(Math.PI / 2);
    this.ribbon.visible = false;
    group.add(this.ribbon);

    const geo = new SphereGeometry(0.009, 10, 8);
    for (let i = 0; i < LANTERNS; i++) {
      const lantern = new Mesh(geo, new MeshBasicMaterial({ color: i % 2 ? Palette.lanternGlow : Palette.pinkSoft }));
      lantern.name = 'FloatingLantern';
      lantern.visible = false;
      group.add(lantern);
      this.lanterns.push(lantern);
    }
  }

  private buildSky(d: Entity): void {
    const c = d.getVectorView(StageSurface, 'center');
    const ceiling = d.getValue(RoomSlots, 'ceilingHeight') ?? 0;
    const lift = ceiling - c[1];
    const useCeiling = !!d.getValue(RoomSlots, 'ceilingFound') && lift > 1.2 && lift < 2.8;
    const pos = new Float32Array(SKY_STARS * 3);
    const seed = new Float32Array(SKY_STARS);
    for (let i = 0; i < SKY_STARS; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / SKY_STARS);
      if (useCeiling) {
        pos.set([c[0] + Math.cos(a) * r * 1.6, ceiling - 0.03, c[2] + Math.sin(a) * r * 1.6], i * 3);
      } else {
        // No usable ceiling: a compact cap of stars high over the table, never near the face.
        const height = 0.55 + 0.35 * ((i * 0.618034) % 1);
        pos.set([c[0] + Math.cos(a) * r * 0.5, c[1] + height, c[2] + Math.sin(a) * r * 0.5], i * 3);
      }
      seed[i] = (i * 0.381966) % 1;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('seed', new BufferAttribute(seed, 1));
    const mat = makeStarMaterial(Palette.starWhite);
    mat.uniforms.size.value = useCeiling ? 40 : 9;
    const points = new Points(geo, mat);
    points.name = useCeiling ? 'CeilingStarSky' : 'StarDome';
    points.frustumCulled = false;
    this.world.createTransformEntity(points);
    this.sky = { points, mat };
  }
}
